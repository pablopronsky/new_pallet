"use client";

import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { providerSnapshotCollection } from "@/lib/firestore";
import type { ProviderSnapshot } from "@/types/domain";

export interface UseProviderSnapshotResult {
  snapshots: ProviderSnapshot[];
  loading: boolean;
  error: Error | null;
}

export function useProviderSnapshot(): UseProviderSnapshotResult {
  const [snapshots, setSnapshots] = useState<ProviderSnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(providerSnapshotCollection(), orderBy("nombre"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSnapshots(snap.docs.map((d) => d.data()));
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

  return { snapshots, loading, error };
}
