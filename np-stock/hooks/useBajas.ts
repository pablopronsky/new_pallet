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
import { StockAvailabilityError } from "@/lib/calculations";
import { BAJA_MOTIVOS, BAJA_TIPOS } from "@/lib/bajas";
import { BRANCHES } from "@/lib/constants";
import { db } from "@/lib/firebase";
import {
  bajasCollection,
  COLLECTIONS,
  distributionDoc,
  productDoc,
} from "@/lib/firestore";
import type {
  BajaMotivo,
  BajaStock,
  BajaTipo,
  Branch,
  BranchBoxes,
} from "@/types/domain";

export interface CreateBajaInput {
  productId: string;
  sucursal: Branch;
  cajas: number;
  tipo: BajaTipo;
  motivo?: BajaMotivo;
  fecha: Date;
  notas?: string;
}

export interface UseBajasResult {
  bajas: BajaStock[];
  loading: boolean;
  error: Error | null;
  createBaja: (input: CreateBajaInput) => Promise<void>;
  submitting: boolean;
}

function isBranch(value: string): value is Branch {
  return BRANCHES.includes(value as Branch);
}

function isBajaMotivo(value: string): value is BajaMotivo {
  return BAJA_MOTIVOS.includes(value as BajaMotivo);
}

function isBajaTipo(value: string): value is BajaTipo {
  return BAJA_TIPOS.includes(value as BajaTipo);
}

function validateBaja(input: CreateBajaInput): void {
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

  if (!isBajaTipo(input.tipo)) {
    throw new Error("tipo is invalid");
  }

  if (input.tipo === "baja_sucursal" && !input.motivo) {
    throw new Error("motivo is required for baja_sucursal");
  }

  if (input.motivo && !isBajaMotivo(input.motivo)) {
    throw new Error("motivo is invalid");
  }

  if (!(input.fecha instanceof Date) || Number.isNaN(input.fecha.getTime())) {
    throw new Error("fecha must be a valid Date");
  }
}

export function useBajas(): UseBajasResult {
  const { user } = useAuth();
  const [bajas, setBajas] = useState<BajaStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const q = query(bajasCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBajas(snap.docs.map((d) => d.data()));
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

  const createBaja = useCallback(
    async (input: CreateBajaInput): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      validateBaja(input);

      setSubmitting(true);
      setError(null);

      try {
        const bajaRef = doc(collection(db, COLLECTIONS.bajas));
        const distRef = distributionDoc(input.productId);
        const productRef = productDoc(input.productId);
        const notas = input.notas?.trim();

        await runTransaction(db, async (tx) => {
          const [distSnap, productSnap] = await Promise.all([
            tx.get(distRef),
            tx.get(productRef),
          ]);
          if (!distSnap.exists()) {
            throw new Error(
              `No distribution found for product ${input.productId}`,
            );
          }
          if (!productSnap.exists()) {
            throw new Error(`No product found for id ${input.productId}`);
          }

          const distribution = distSnap.data();
          const product = productSnap.data();
          const currentBoxes = distribution.cajasPorSucursal[input.sucursal] ?? 0;

          if (input.cajas > currentBoxes) {
            throw new StockAvailabilityError({
              totalAvailable: currentBoxes,
              currentSold: 0,
              newSale: input.cajas,
            });
          }

          const updatedBoxes: BranchBoxes = {
            ...distribution.cajasPorSucursal,
            [input.sucursal]: currentBoxes - input.cajas,
          };

          tx.update(distRef, {
            cajasPorSucursal: updatedBoxes,
            updatedAt: serverTimestamp(),
          });

          const generaDeuda = input.tipo === "baja_sucursal";
          const costoUSDPorCaja =
            typeof product.costoUSD === "number" &&
            Number.isFinite(product.costoUSD)
              ? product.costoUSD
              : 0;
          if (generaDeuda && costoUSDPorCaja <= 0) {
            throw new Error(
              `El producto ${product.nombre} no tiene costo USD válido para generar deuda`,
            );
          }

          tx.set(bajaRef, {
            productId: input.productId,
            sucursal: input.sucursal,
            cajas: input.cajas,
            tipo: input.tipo,
            generaDeuda,
            costoUSDPorCaja,
            deudaUSD: generaDeuda ? input.cajas * costoUSDPorCaja : 0,
            fecha: Timestamp.fromDate(input.fecha),
            createdBy: user.uid,
            ...(input.motivo ? { motivo: input.motivo } : {}),
            ...(notas ? { notas } : {}),
            createdAt: serverTimestamp(),
          });
        });
      } catch (err) {
        const e =
          err instanceof Error ? err : new Error("No se pudo crear la baja");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [user],
  );

  return { bajas, loading, error, createBaja, submitting };
}
