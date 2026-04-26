"use client";

import { useEffect, useState, useCallback } from "react";
import { onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { configDoc } from "@/lib/firestore";
import { useAuth } from "@/hooks/useAuth";
import { logError } from "@/lib/errors";
import type { AppConfig } from "@/types/domain";

export interface UseConfigResult {
  config: AppConfig | null;
  loading: boolean;
  error: Error | null;
  updateTipoCambio: (value: number) => Promise<void>;
  saving: boolean;
}

export function useConfig(): UseConfigResult {
  const { user } = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      configDoc(),
      (snap) => {
        setConfig(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const updateTipoCambio = useCallback(
    async (value: number): Promise<void> => {
      if (value <= 0) throw new Error("tipoCambioUSD must be greater than 0");
      setSaving(true);
      setError(null);
      try {
        await updateDoc(configDoc(), {
          tipoCambioUSD: value,
          updatedAt: serverTimestamp(),
          ...(user ? { updatedBy: user.uid } : {}),
        });
      } catch (err) {
        logError("useConfig.updateTipoCambio", err);
        const e = err instanceof Error ? err : new Error("Error al guardar tipo de cambio");
        setError(e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  return { config, loading, error, updateTipoCambio, saving };
}
