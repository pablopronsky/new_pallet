"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Timestamp,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auditsCollection, auditDoc } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { BRANCHES } from "@/lib/constants";
import { logError } from "@/lib/errors";
import type { Audit, AuditItem, Branch } from "@/types/domain";

export interface CreateAuditItemInput {
  productId: string;
  sucursal: Branch;
  cajasSistema: number;
  cajasContadas: number;
  notas?: string;
}

export interface CreateAuditInput {
  sucursal: Branch;
  items: CreateAuditItemInput[];
  notas?: string;
  fecha?: Date;
}

export interface CreateAuditResult {
  auditId: string;
}

export interface UseAuditsResult {
  audits: Audit[];
  loading: boolean;
  error: Error | null;
  createAudit: (input: CreateAuditInput) => Promise<CreateAuditResult>;
  markAuditResolved: (auditId: string) => Promise<void>;
  submitting: boolean;
  resolvingIds: Set<string>;
}

function validateItem(item: CreateAuditItemInput, index: number): AuditItem {
  if (!item.productId.trim()) {
    throw new Error(`items[${index}].productId must not be empty`);
  }
  if (!(BRANCHES as readonly string[]).includes(item.sucursal)) {
    throw new Error(
      `items[${index}].sucursal "${item.sucursal}" is not a valid branch`,
    );
  }
  if (
    typeof item.cajasSistema !== "number" ||
    !Number.isFinite(item.cajasSistema) ||
    !Number.isInteger(item.cajasSistema) ||
    item.cajasSistema < 0
  ) {
    throw new Error(
      `items[${index}].cajasSistema must be a non-negative integer`,
    );
  }
  if (
    typeof item.cajasContadas !== "number" ||
    !Number.isFinite(item.cajasContadas) ||
    !Number.isInteger(item.cajasContadas) ||
    item.cajasContadas < 0
  ) {
    throw new Error(
      `items[${index}].cajasContadas must be a non-negative integer`,
    );
  }

  const base: AuditItem = {
    productId: item.productId.trim(),
    sucursal: item.sucursal,
    cajasSistema: item.cajasSistema,
    cajasContadas: item.cajasContadas,
    diferencia: item.cajasContadas - item.cajasSistema,
  };
  const notas = item.notas?.trim();
  return notas ? { ...base, notas } : base;
}

export function useAudits(): UseAuditsResult {
  const { user } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(auditsCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAudits(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const createAudit = useCallback(
    async (input: CreateAuditInput): Promise<CreateAuditResult> => {
      if (!user) throw new Error("Not authenticated");
      if (!(BRANCHES as readonly string[]).includes(input.sucursal)) {
        throw new Error(`sucursal "${input.sucursal}" is not a valid branch`);
      }
      if (!input.items.length) {
        throw new Error("An audit must include at least one item");
      }

      setSubmitting(true);
      setError(null);
      try {
        const items: AuditItem[] = input.items.map((it, idx) =>
          validateItem(it, idx),
        );
        if (items.some((item) => item.sucursal !== input.sucursal)) {
          throw new Error("All audit items must match the selected branch");
        }

        const generalNotas = input.notas?.trim();
        // Note: this only creates an audit record. It does not modify
        // distribucion.cajasPorSucursal and does not create sales.
        const payload: Omit<Audit, "id"> = {
          items,
          sucursal: input.sucursal,
          fecha: Timestamp.fromDate(input.fecha ?? new Date()),
          createdBy: user.uid,
          cerrada: true,
          resuelta: false,
          ...(generalNotas ? { notas: generalNotas } : {}),
        };

        const ref = await addDoc(auditsCollection(), payload);
        return { auditId: ref.id };
      } catch (err) {
        logError("useAudits.createAudit", err);
        const e =
          err instanceof Error ? err : new Error("Error al crear auditoría");
        setError(e);
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [user],
  );

  const markAuditResolved = useCallback(
    async (auditId: string): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      if (!auditId.trim()) throw new Error("auditId must not be empty");

      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.add(auditId);
        return next;
      });
      setError(null);
      try {
        await updateDoc(auditDoc(auditId), {
          resuelta: true,
          resolvedAt: serverTimestamp(),
          resolvedBy: user.uid,
        });
      } catch (err) {
        logError("useAudits.markAuditResolved", err);
        const e =
          err instanceof Error
            ? err
            : new Error("Error al marcar auditoría como resuelta");
        setError(e);
        throw e;
      } finally {
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(auditId);
          return next;
        });
      }
    },
    [user],
  );

  return {
    audits,
    loading,
    error,
    createAudit,
    markAuditResolved,
    submitting,
    resolvingIds,
  };
}
