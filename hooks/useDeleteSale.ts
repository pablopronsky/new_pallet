"use client";

import { useCallback, useState } from "react";
import { runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { distributionDoc, saleDoc } from "@/lib/firestore";
import { logError } from "@/lib/errors";
import type { ProductDistribution } from "@/types/domain";

export interface UseDeleteSaleResult {
  deleteSale: (saleId: string) => Promise<void>;
  deletingIds: Set<string>;
  isDeleting: (saleId: string) => boolean;
  error: Error | null;
}

export function useDeleteSale(): UseDeleteSaleResult {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Error | null>(null);

  const markDeleting = (saleId: string, on: boolean) => {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(saleId);
      else next.delete(saleId);
      return next;
    });
  };

  const deleteSale = useCallback(async (saleId: string): Promise<void> => {
    markDeleting(saleId, true);
    setError(null);
    try {
      await runTransaction(db, async (tx) => {
        const saleRef = saleDoc(saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) {
          throw new Error("Sale not found");
        }
        const sale = saleSnap.data();

        const distRef = distributionDoc(sale.productId);
        const distSnap = await tx.get(distRef);

        if (distSnap.exists()) {
          const distribution = distSnap.data();
          const current = distribution.cajasPorSucursal[sale.sucursal] ?? 0;
          const updatedCajasPorSucursal: ProductDistribution["cajasPorSucursal"] = {
            ...distribution.cajasPorSucursal,
            [sale.sucursal]: current + sale.cajas,
          };
          tx.update(distRef, {
            cajasPorSucursal: updatedCajasPorSucursal,
            updatedAt: serverTimestamp(),
          });
        }

        tx.delete(saleRef);
      });
    } catch (err) {
      logError("useDeleteSale.deleteSale", err);
      const e = err instanceof Error ? err : new Error("Failed to delete sale");
      setError(e);
      throw e;
    } finally {
      markDeleting(saleId, false);
    }
  }, []);

  const isDeleting = useCallback(
    (saleId: string) => deletingIds.has(saleId),
    [deletingIds],
  );

  return { deleteSale, deletingIds, isDeleting, error };
}
