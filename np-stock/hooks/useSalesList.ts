"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { salesCollection } from "@/lib/firestore";
import type { Sale } from "@/types/domain";

export interface UseSalesListResult {
  sales: Sale[];
  loading: boolean;
  error: Error | null;
}

export function useSalesList(): UseSalesListResult {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      salesCollection(),
      (snap) => {
        setSales(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { sales, loading, error };
}
