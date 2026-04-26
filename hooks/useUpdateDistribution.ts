"use client";

import { useCallback, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/firestore";
import { BRANCHES } from "@/lib/constants";
import type { BranchBoxes } from "@/types/domain";

export interface UseUpdateDistributionResult {
  updateDistribution: (
    productId: string,
    cajasPorSucursal: BranchBoxes,
  ) => Promise<void>;
  saving: boolean;
  error: Error | null;
}

export function useUpdateDistribution(): UseUpdateDistributionResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateDistribution = useCallback(
    async (productId: string, cajasPorSucursal: BranchBoxes): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        if (!productId.trim()) {
          throw new Error("productId must not be empty");
        }
        for (const branch of BRANCHES) {
          const value = cajasPorSucursal[branch];
          if (typeof value !== "number") {
            throw new Error(`cajasPorSucursal.${branch} must be a number`);
          }
          if (!Number.isFinite(value)) {
            throw new Error(`cajasPorSucursal.${branch} must be finite`);
          }
          if (!Number.isInteger(value)) {
            throw new Error(`cajasPorSucursal.${branch} must be an integer`);
          }
          if (value < 0) {
            throw new Error(`cajasPorSucursal.${branch} must be >= 0`);
          }
        }

        // Use setDoc (merge) so this creates the doc if it doesn't exist yet.
        // This is a plain stock adjustment — it must not create, edit, or
        // delete sales records.
        const ref = doc(db, COLLECTIONS.distribucion, productId);
        await setDoc(
          ref,
          { productId, cajasPorSucursal, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } catch (err) {
        const e =
          err instanceof Error
            ? err
            : new Error("Error al guardar distribución");
        setError(e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { updateDistribution, saving, error };
}
