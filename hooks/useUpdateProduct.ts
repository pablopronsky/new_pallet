"use client";

import { useCallback, useState } from "react";
import { updateDoc, serverTimestamp } from "firebase/firestore";
import { productDoc } from "@/lib/firestore";
import { logError } from "@/lib/errors";
import type { ProductCategory } from "@/types/domain";

const VALID_CATEGORIES: ProductCategory[] = ["SPC", "Laminado", "SPC Budget"];

export interface UpdateProductInput {
  nombre?: string;
  categoria?: ProductCategory;
  costoUSD?: number;
  precioVentaUSD?: number;
  esBudget?: boolean;
  activo?: boolean;
}

export interface UseUpdateProductResult {
  updateProduct: (id: string, data: UpdateProductInput) => Promise<void>;
  saving: boolean;
  error: Error | null;
}

export function useUpdateProduct(): UseUpdateProductResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateProduct = useCallback(
    async (id: string, data: UpdateProductInput): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        if (!id.trim()) {
          throw new Error("id must not be empty");
        }
        if (data.nombre !== undefined && !data.nombre.trim()) {
          throw new Error("nombre must not be empty");
        }
        if (
          data.categoria !== undefined &&
          !VALID_CATEGORIES.includes(data.categoria)
        ) {
          throw new Error(
            `categoria must be one of: ${VALID_CATEGORIES.join(", ")}`,
          );
        }
        if (
          data.costoUSD !== undefined &&
          (!Number.isFinite(data.costoUSD) || data.costoUSD < 0)
        ) {
          throw new Error("costoUSD must be a finite number >= 0");
        }
        if (
          data.precioVentaUSD !== undefined &&
          (!Number.isFinite(data.precioVentaUSD) || data.precioVentaUSD < 0)
        ) {
          throw new Error("precioVentaUSD must be a finite number >= 0");
        }
        if (data.esBudget !== undefined && typeof data.esBudget !== "boolean") {
          throw new Error("esBudget must be a boolean");
        }
        if (data.activo !== undefined && typeof data.activo !== "boolean") {
          throw new Error("activo must be a boolean");
        }

        const payload: UpdateProductInput = { ...data };
        if (payload.nombre !== undefined) {
          payload.nombre = payload.nombre.trim();
        }

        await updateDoc(productDoc(id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        logError("useUpdateProduct.updateProduct", err);
        const e =
          err instanceof Error ? err : new Error("Error al guardar producto");
        setError(e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { updateProduct, saving, error };
}
