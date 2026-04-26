"use client";

import { useCallback, useState } from "react";
import { getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { bajaDebtUSD } from "@/lib/bajas";
import {
  bajasCollection,
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
import { logError } from "@/lib/errors";
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
      const [productsSnap, distributionsSnap, salesSnap, bajasSnap] =
        await Promise.all([
        getDocs(productsCollection()),
        getDocs(distributionCollection()),
        getDocs(salesCollection()),
        getDocs(bajasCollection()),
      ]);

      const products = productsSnap.docs.map((doc) => doc.data());
      const productById = products.reduce<Record<string, (typeof products)[number]>>(
        (acc, product) => {
          acc[product.id] = product;
          return acc;
        },
        {},
      );
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
      const bajaDebtByProduct = bajasSnap.docs.reduce<Record<string, number>>(
        (acc, doc) => {
          const baja = doc.data();
          acc[baja.productId] =
            (acc[baja.productId] ?? 0) +
            bajaDebtUSD(baja, productById[baja.productId]);
          return acc;
        },
        {},
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
          deudaUSD:
            calculateDebtUSD(product, cajasVendidas) +
            (bajaDebtByProduct[product.id] ?? 0),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (err) {
      logError("useGenerateProviderSnapshot.generateProviderSnapshot", err);
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
