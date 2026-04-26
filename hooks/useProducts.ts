"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { productsCollection } from "@/lib/firestore";
import type { Product } from "@/types/domain";

export interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: Error | null;
}

export function useProducts(options: { activeOnly?: boolean } = {}): UseProductsResult {
  const { activeOnly = true } = options;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = activeOnly
      ? query(productsCollection(), where("activo", "==", true))
      : productsCollection();

    const unsub = onSnapshot(
      q,
      (snap) => {
        setProducts(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [activeOnly]);

  return { products, loading, error };
}
