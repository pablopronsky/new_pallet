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
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { logError } from "@/lib/errors";
import { db } from "@/lib/firebase";
import {
  COLLECTIONS,
  distributionDoc,
  trasladosCollection,
} from "@/lib/firestore";
import type { Branch, BranchBoxes, TrasladoStock } from "@/types/domain";

export interface CreateTrasladoInput {
  productId: string;
  sucursalOrigen: Branch;
  sucursalDestino: Branch;
  cajas: number;
  fecha: Date;
  notas?: string;
}

export interface UseTrasladosResult {
  traslados: TrasladoStock[];
  loading: boolean;
  error: Error | null;
  createTraslado: (input: CreateTrasladoInput) => Promise<void>;
  submitting: boolean;
}

function isBranch(value: string): value is Branch {
  return BRANCHES.includes(value as Branch);
}

function validateTraslado(input: CreateTrasladoInput): void {
  if (!input.productId.trim()) {
    throw new Error("productId is required");
  }

  if (!isBranch(input.sucursalOrigen)) {
    throw new Error("sucursalOrigen is invalid");
  }

  if (!isBranch(input.sucursalDestino)) {
    throw new Error("sucursalDestino is invalid");
  }

  if (input.sucursalOrigen === input.sucursalDestino) {
    throw new Error("sucursalOrigen and sucursalDestino must be different");
  }

  if (!Number.isFinite(input.cajas) || !Number.isInteger(input.cajas)) {
    throw new Error("cajas must be a finite integer");
  }

  if (input.cajas <= 0) {
    throw new Error("cajas must be greater than 0");
  }

  if (!(input.fecha instanceof Date) || Number.isNaN(input.fecha.getTime())) {
    throw new Error("fecha must be a valid Date");
  }
}

export function useTraslados(): UseTrasladosResult {
  const { user } = useAuth();
  const [traslados, setTraslados] = useState<TrasladoStock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const q = query(trasladosCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTraslados(snap.docs.map((d) => d.data()));
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

  const createTraslado = useCallback(
    async (input: CreateTrasladoInput): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      validateTraslado(input);

      setSubmitting(true);
      setError(null);

      try {
        const trasladoRef = doc(collection(db, COLLECTIONS.traslados));
        const distRef = distributionDoc(input.productId);
        const notas = input.notas?.trim();

        await runTransaction(db, async (tx) => {
          const distSnap = await tx.get(distRef);
          if (!distSnap.exists()) {
            throw new Error(
              `No distribution found for product ${input.productId}`,
            );
          }

          const distribution = distSnap.data();
          const originStock =
            distribution.cajasPorSucursal[input.sucursalOrigen] ?? 0;

          if (input.cajas > originStock) {
            throw new Error(
              `Stock insuficiente en ${BRANCH_LABELS[input.sucursalOrigen]}: disponibles ${originStock}, solicitado ${input.cajas}`,
            );
          }

          const destinationStock =
            distribution.cajasPorSucursal[input.sucursalDestino] ?? 0;
          const updatedBoxes: BranchBoxes = {
            ...distribution.cajasPorSucursal,
            [input.sucursalOrigen]: originStock - input.cajas,
            [input.sucursalDestino]: destinationStock + input.cajas,
          };

          tx.update(distRef, {
            cajasPorSucursal: updatedBoxes,
            updatedAt: serverTimestamp(),
          });

          tx.set(trasladoRef, {
            productId: input.productId,
            sucursalOrigen: input.sucursalOrigen,
            sucursalDestino: input.sucursalDestino,
            cajas: input.cajas,
            fecha: Timestamp.fromDate(input.fecha),
            createdBy: user.uid,
            ...(notas ? { notas } : {}),
            createdAt: serverTimestamp(),
          });
        });
      } catch (err) {
        logError("useTraslados.createTraslado", err);
        const e =
          err instanceof Error
            ? err
            : new Error("No se pudo crear el traslado");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [user],
  );

  return { traslados, loading, error, createTraslado, submitting };
}
