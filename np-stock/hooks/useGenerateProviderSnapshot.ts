"use client";

import { useCallback, useState } from "react";
import { getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import {
  distributionCollection,
  productsCollection,
  providerSnapshotDoc,
  salesCollection,
} from "@/lib/firestore";
import {
  calculateDebtUSD,
  calculateSoldBoxesByProduct,
  calculateTotalAvailableBoxes,
} from "@/lib/calculations";
import { db } from "@/lib/firebase";
import type { ProductDistribution } from "@/types/domain";

export interface UseGenerateProviderSnapshotResult {
  generateProviderSnapshot: () => Promise<void>;
  generating: boolean;
  error: Error | null;
}

export function useGenerateProviderSnapshot(): UseGenerateProviderSnapshotResult {
  const { role } = useAuth();
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const generateProviderSnapshot = useCallback(async (): Promise<void> => {
    if (role !== "admin") {
      throw new Error("Solo admin puede actualizar el resumen proveedor");
    }

    setGenerating(true);
    setError(null);

    try {
      const [productsSnap, distributionsSnap, salesSnap] = await Promise.all([
        getDocs(productsCollection()),
        getDocs(distributionCollection()),
        getDocs(salesCollection()),
      ]);

      const products = productsSnap.docs.map((doc) => doc.data());
      const distributionsByProduct = distributionsSnap.docs.reduce<
        Record<string, ProductDistribution>
      >((acc, doc) => {
        const distribution = doc.data();
        acc[distribution.productId] = distribution;
        return acc;
      }, {});
      const soldByProduct = calculateSoldBoxesByProduct(
        salesSnap.docs.map((doc) => doc.data()),
      );

      const batch = writeBatch(db);

      for (const product of products) {
        const cajasVendidas = soldByProduct[product.id] ?? 0;
        const distribution = distributionsByProduct[product.id];
        const cajasRestantes = distribution
          ? calculateTotalAvailableBoxes(distribution)
          : 0;

        batch.set(providerSnapshotDoc(product.id), {
          productId: product.id,
          nombre: product.nombre,
          categoria: product.categoria,
          esBudget: product.esBudget,
          cajasVendidas,
          cajasRestantes,
          deudaUSD: calculateDebtUSD(product, cajasVendidas),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      const e =
        err instanceof Error
          ? err
          : new Error("No se pudo actualizar el resumen proveedor");
      setError(e);
      throw e;
    } finally {
      setGenerating(false);
    }
  }, [role]);

  return { generateProviderSnapshot, generating, error };
}
