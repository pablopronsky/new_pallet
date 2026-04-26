"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { distributionCollection } from "@/lib/firestore";
import type { ProductDistribution } from "@/types/domain";

export interface UseDistributionResult {
  distributions: ProductDistribution[];
  byProductId: Record<string, ProductDistribution>;
  loading: boolean;
  error: Error | null;
}

export function useDistribution(): UseDistributionResult {
  const [distributions, setDistributions] = useState<ProductDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      distributionCollection(),
      (snap) => {
        setDistributions(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const byProductId = useMemo(() => {
    const map: Record<string, ProductDistribution> = {};
    for (const d of distributions) map[d.productId] = d;
    return map;
  }, [distributions]);

  return { distributions, byProductId, loading, error };
}
