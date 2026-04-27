"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import {
  COLLECTIONS,
  liquidacionesProveedorCollection,
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/errors";
import type { LiquidacionProveedor } from "@/types/domain";

export interface CreateLiquidacionProveedorInput {
  fecha: Date;
  montoUSD: number;
  notas?: string;
}

export interface UseLiquidacionesProveedorResult {
  liquidaciones: LiquidacionProveedor[];
  loading: boolean;
  error: Error | null;
  createLiquidacion: (
    input: CreateLiquidacionProveedorInput,
  ) => Promise<void>;
  submitting: boolean;
}

function validateLiquidacion(input: CreateLiquidacionProveedorInput): void {
  if (!Number.isFinite(input.montoUSD) || input.montoUSD <= 0) {
    throw new Error("La liquidación debe tener un monto USD mayor a cero.");
  }

  if (!(input.fecha instanceof Date) || Number.isNaN(input.fecha.getTime())) {
    throw new Error("La fecha de la liquidación no es válida.");
  }

  if (input.notas !== undefined && typeof input.notas !== "string") {
    throw new Error("Las notas de la liquidación no son válidas.");
  }
}

export function useLiquidacionesProveedor(): UseLiquidacionesProveedorResult {
  const { user, role } = useAuth();
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionProveedor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const q = query(liquidacionesProveedorCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLiquidaciones(snap.docs.map((d) => d.data()));
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

  const createLiquidacion = useCallback(
    async (input: CreateLiquidacionProveedorInput): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      if (role !== "admin") {
        throw new Error("No tenés permisos para registrar liquidaciones.");
      }
      validateLiquidacion(input);

      setSubmitting(true);
      setError(null);

      try {
        const liquidacionRef = doc(
          collection(db, COLLECTIONS.liquidacionesProveedor),
        );
        const notas = input.notas?.trim();

        await setDoc(liquidacionRef, {
          proveedor: "allcovering",
          fecha: Timestamp.fromDate(input.fecha),
          montoUSD: input.montoUSD,
          createdBy: user.uid,
          ...(notas ? { notas } : {}),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        logError("useLiquidacionesProveedor.createLiquidacion", err);
        const e =
          err instanceof Error
            ? err
            : new Error("No se pudo registrar la liquidación.");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [role, user],
  );

  return {
    liquidaciones,
    loading,
    error,
    createLiquidacion,
    submitting,
  };
}
