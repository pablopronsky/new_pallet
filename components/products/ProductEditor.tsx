"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  BUDGET_PRODUCT_LABEL,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/constants";
import type { Product, ProductCategory } from "@/types/domain";
import type { UpdateProductInput } from "@/hooks/useUpdateProduct";

const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "SPC", label: PRODUCT_CATEGORY_LABELS.SPC },
  { value: "Laminado", label: PRODUCT_CATEGORY_LABELS.Laminado },
  { value: "SPC Budget", label: PRODUCT_CATEGORY_LABELS["SPC Budget"] },
];

export interface ProductEditorProps {
  product: Product;
  saving: boolean;
  onSave: (data: UpdateProductInput) => void;
  onClose: () => void;
}

interface FormState {
  nombre: string;
  categoria: ProductCategory;
  costoUSD: string;
  precioVentaUSD: string;
  esBudget: boolean;
  activo: boolean;
}

type FormErrors = Partial<Record<"nombre" | "costoUSD" | "precioVentaUSD", string>>;

export function ProductEditor({ product, saving, onSave, onClose }: ProductEditorProps) {
  const [form, setForm] = useState<FormState>({
    nombre: product.nombre,
    categoria: product.categoria,
    costoUSD: String(product.costoUSD),
    precioVentaUSD: String(product.precioVentaUSD),
    esBudget: product.esBudget,
    activo: product.activo,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    setForm({
      nombre: product.nombre,
      categoria: product.categoria,
      costoUSD: String(product.costoUSD),
      precioVentaUSD: String(product.precioVentaUSD),
      esBudget: product.esBudget,
      activo: product.activo,
    });
    setErrors({});
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.nombre.trim()) next.nombre = "Requerido";
    const costo = parseFloat(form.costoUSD);
    const precio = parseFloat(form.precioVentaUSD);
    if (isNaN(costo) || costo < 0) next.costoUSD = "Debe ser >= 0";
    if (isNaN(precio) || precio < 0) next.precioVentaUSD = "Debe ser >= 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    onSave({
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      costoUSD: parseFloat(form.costoUSD),
      precioVentaUSD: parseFloat(form.precioVentaUSD),
      esBudget: form.esBudget,
      activo: form.activo,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-text-primary">
          Editar producto
        </h2>
        <p className="mb-5 text-xs text-text-muted">ID: {product.id}</p>

        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            name="nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            error={errors.nombre}
            disabled={saving}
          />

          <Select
            label="Categoría"
            name="categoria"
            value={form.categoria}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                categoria: e.target.value as ProductCategory,
              }))
            }
            options={CATEGORY_OPTIONS}
            disabled={saving}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Costo USD"
              name="costoUSD"
              type="number"
              min={0}
              step="0.01"
              value={form.costoUSD}
              onChange={(e) =>
                setForm((f) => ({ ...f, costoUSD: e.target.value }))
              }
              error={errors.costoUSD}
              disabled={saving}
            />
            <Input
              label="Precio venta USD"
              name="precioVentaUSD"
              type="number"
              min={0}
              step="0.01"
              value={form.precioVentaUSD}
              onChange={(e) =>
                setForm((f) => ({ ...f, precioVentaUSD: e.target.value }))
              }
              error={errors.precioVentaUSD}
              disabled={saving}
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.esBudget}
                onChange={(e) =>
                  setForm((f) => ({ ...f, esBudget: e.target.checked }))
                }
                disabled={saving}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Es {BUDGET_PRODUCT_LABEL.toLowerCase()}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activo: e.target.checked }))
                }
                disabled={saving}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
