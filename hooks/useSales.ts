"use client";

import { useCallback, useState } from "react";
import {
  Timestamp,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  distributionDoc,
  salesCollection,
} from "@/lib/firestore";
import {
  StockAvailabilityError,
  validateStockAvailability,
} from "@/lib/calculations";
import { useAuth } from "@/hooks/useAuth";
import type { Branch, ProductDistribution, Sale } from "@/types/domain";

export interface CreateSaleInput {
  productId: string;
  sucursal: Branch;
  cajas: number;
  montoUSD?: number;
  montoARS?: number;
  tipoCambioUSD: number;
  fecha: Date;
  notas?: string;
}

export interface CreateSaleResult {
  saleId: string;
  montoUSD: number;
  montoARS: number;
}

interface ResolvedAmounts {
  montoUSD: number;
  montoARS: number;
}

function resolveAmounts(input: CreateSaleInput): ResolvedAmounts {
  const { montoUSD, montoARS, tipoCambioUSD } = input;

  if (tipoCambioUSD <= 0) {
    throw new Error("tipoCambioUSD must be greater than 0");
  }

  const hasUSD = typeof montoUSD === "number";
  const hasARS = typeof montoARS === "number";

  if (!hasUSD && !hasARS) {
    throw new Error("Either montoUSD or montoARS is required");
  }

  if (hasUSD && montoUSD! < 0) throw new Error("montoUSD cannot be negative");
  if (hasARS && montoARS! < 0) throw new Error("montoARS cannot be negative");

  if (hasUSD) {
    return {
      montoUSD: montoUSD!,
      montoARS: hasARS ? montoARS! : montoUSD! * tipoCambioUSD,
    };
  }

  return {
    montoUSD: montoARS! / tipoCambioUSD,
    montoARS: montoARS!,
  };
}

export interface UseSalesResult {
  createSale: (input: CreateSaleInput) => Promise<CreateSaleResult>;
  submitting: boolean;
  error: Error | null;
}

export function useSales(): UseSalesResult {
  const { user, role, profile } = useAuth();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createSale = useCallback(
    async (input: CreateSaleInput): Promise<CreateSaleResult> => {
      if (!user) throw new Error("Not authenticated");
      if (input.cajas <= 0 || !Number.isInteger(input.cajas)) {
        throw new Error("cajas must be a positive integer");
      }

      const vendedorBranch =
        role === "vendedor" ? profile?.sucursalAsignada : undefined;

      if (role === "vendedor") {
        if (!profile) {
          throw new Error("User profile is required");
        }
        if (!vendedorBranch) {
          throw new Error("Sucursal asignada is required");
        }
        if (input.sucursal !== vendedorBranch) {
          throw new Error("No podés vender stock de otra sucursal");
        }
      }

      const saleSucursal = vendedorBranch ?? input.sucursal;

      setSubmitting(true);
      setError(null);

      try {
        const amounts = resolveAmounts(input);
        const distRef = distributionDoc(input.productId);
        const newSaleRef = doc(salesCollection());

        // distribucion.cajasPorSucursal is live remaining stock per branch.
        // Every sale subtracts from the effective branch and writes the sale as
        // a historical record. Readers must not subtract sales from distribucion
        // again, or stock would be double-counted.
        await runTransaction(db, async (tx) => {
          const distSnap = await tx.get(distRef);
          if (!distSnap.exists()) {
            throw new Error(
              `No distribution found for product ${input.productId}`,
            );
          }

          const distribution = distSnap.data();
          const branchBoxes =
            distribution.cajasPorSucursal[saleSucursal] ?? 0;

          // Validate against the target branch's current stock only.
          validateStockAvailability({
            totalAvailable: branchBoxes,
            currentSold: 0,
            newSale: input.cajas,
          });

          const updatedCajasPorSucursal: ProductDistribution["cajasPorSucursal"] =
            {
              ...distribution.cajasPorSucursal,
              [saleSucursal]: branchBoxes - input.cajas,
            };

          tx.update(distRef, {
            cajasPorSucursal: updatedCajasPorSucursal,
            updatedAt: serverTimestamp(),
          });

          const salePayload: Omit<Sale, "id"> = {
            productId: input.productId,
            sucursal: saleSucursal,
            cajas: input.cajas,
            montoUSD: amounts.montoUSD,
            montoARS: amounts.montoARS,
            tipoCambioUSD: input.tipoCambioUSD,
            fecha: Timestamp.fromDate(input.fecha),
            createdBy: user.uid,
            ...(input.notas ? { notas: input.notas } : {}),
          };

          tx.set(newSaleRef, salePayload);
        });

        return {
          saleId: newSaleRef.id,
          montoUSD: amounts.montoUSD,
          montoARS: amounts.montoARS,
        };
      } catch (err) {
        const e =
          err instanceof StockAvailabilityError
            ? err
            : err instanceof Error
              ? err
              : new Error("Failed to create sale");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [profile, role, user],
  );

  return { createSale, submitting, error };
}
