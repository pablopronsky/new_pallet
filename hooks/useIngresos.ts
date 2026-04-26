"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { BRANCHES } from "@/lib/constants";
import { logError } from "@/lib/errors";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  distributionDoc,
  ingresosCollection,
  productDoc,
} from "@/lib/firestore";
import type { Branch, BranchBoxes, IngresoStock } from "@/types/domain";

export interface CreateIngresoInput {
  productId: string;
  sucursal: Branch;
  cajas: number;
  costoUSDPorCaja: number;
  fecha: Date;
  notas?: string;
}

export interface UseIngresosResult {
  ingresos: IngresoStock[];
  loading: boolean;
  error: Error | null;
  createIngreso: (input: CreateIngresoInput) => Promise<void>;
  submitting: boolean;
}

function isBranch(value: string): value is Branch {
  return BRANCHES.includes(value as Branch);
}

function validateIngreso(input: CreateIngresoInput): void {
  if (!input.productId.trim()) {
    throw new Error("productId is required");
  }

  if (!isBranch(input.sucursal)) {
    throw new Error("sucursal is invalid");
  }

  if (!Number.isFinite(input.cajas) || !Number.isInteger(input.cajas)) {
    throw new Error("cajas must be a finite integer");
  }

  if (input.cajas <= 0) {
    throw new Error("cajas must be greater than 0");
  }

  if (
    !Number.isFinite(input.costoUSDPorCaja) ||
    input.costoUSDPorCaja <= 0
  ) {
    throw new Error("costoUSDPorCaja must be greater than 0");
  }

  if (!(input.fecha instanceof Date) || Number.isNaN(input.fecha.getTime())) {
    throw new Error("fecha must be a valid Date");
  }
}

function emptyBranchBoxes(): BranchBoxes {
  return BRANCHES.reduce(
    (acc, branch) => {
      acc[branch] = 0;
      return acc;
    },
    {} as BranchBoxes,
  );
}

export function useIngresos(): UseIngresosResult {
  const { user, role } = useAuth();
  const [ingresos, setIngresos] = useState<IngresoStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const q = query(ingresosCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIngresos(snap.docs.map((d) => d.data()));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const createIngreso = useCallback(
    async (input: CreateIngresoInput): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      validateIngreso(input);

      setSubmitting(true);
      setError(null);

      try {
        const ingresoRef = doc(collection(db, COLLECTIONS.ingresos));
        const distRef = distributionDoc(input.productId);
        const productRef = productDoc(input.productId);
        const notas = input.notas?.trim();
        const costoTotalUSD = input.cajas * input.costoUSDPorCaja;

        await runTransaction(db, async (tx) => {
          const [distSnap, productSnap] = await Promise.all([
            tx.get(distRef),
            role === "admin" ? tx.get(productRef) : Promise.resolve(null),
          ]);
          const currentBoxes = distSnap.exists()
            ? distSnap.data().cajasPorSucursal
            : emptyBranchBoxes();
          const updatedBoxes: BranchBoxes = {
            ...emptyBranchBoxes(),
            ...currentBoxes,
            [input.sucursal]: (currentBoxes[input.sucursal] ?? 0) + input.cajas,
          };

          tx.set(
            distRef,
            {
              productId: input.productId,
              cajasPorSucursal: updatedBoxes,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );

          if (role === "admin" && productSnap?.exists()) {
            const product = productSnap.data();
            if (
              !Number.isFinite(product.costoUSD) ||
              product.costoUSD <= 0 ||
              product.costoUSD !== input.costoUSDPorCaja
            ) {
              tx.update(productRef, {
                costoUSD: input.costoUSDPorCaja,
                updatedAt: serverTimestamp(),
              });
            }
          }

          tx.set(ingresoRef, {
            productId: input.productId,
            sucursal: input.sucursal,
            cajas: input.cajas,
            costoUSDPorCaja: input.costoUSDPorCaja,
            costoTotalUSD,
            fecha: Timestamp.fromDate(input.fecha),
            createdBy: user.uid,
            ...(notas ? { notas } : {}),
            createdAt: serverTimestamp(),
          });
        });
      } catch (err) {
        logError("useIngresos.createIngreso", err);
        const e =
          err instanceof Error ? err : new Error("No se pudo crear el ingreso");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [role, user],
  );

  return { ingresos, loading, error, createIngreso, submitting };
}
