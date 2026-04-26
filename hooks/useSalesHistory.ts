"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { salesCollection } from "@/lib/firestore";
import type { Branch, Sale } from "@/types/domain";

export interface SalesHistoryFilters {
  productId?: string;
  sucursal?: Branch;
  from?: Date;
  to?: Date;
}

export interface UseSalesHistoryResult {
  sales: Sale[];
  loading: boolean;
  error: Error | null;
}

export function useSalesHistory(filters: SalesHistoryFilters): UseSalesHistoryResult {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = filters.sucursal
      ? query(salesCollection(), where("sucursal", "==", filters.sucursal))
      : query(salesCollection(), orderBy("fecha", "desc"));
    const unsub = onSnapshot(
      q,
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
  }, [filters.sucursal]);

  const filtered = useMemo(() => {
    const fromMs = filters.from ? filters.from.getTime() : null;
    const toMs = filters.to ? filters.to.getTime() : null;

    return sales.filter((s) => {
      if (filters.productId && s.productId !== filters.productId) return false;
      if (filters.sucursal && s.sucursal !== filters.sucursal) return false;

      const saleMs = s.fecha.toMillis();
      if (fromMs !== null && saleMs < fromMs) return false;
      if (toMs !== null && saleMs > toMs) return false;

      return true;
    }).sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  }, [sales, filters.productId, filters.sucursal, filters.from, filters.to]);

  return { sales: filtered, loading, error };
}
