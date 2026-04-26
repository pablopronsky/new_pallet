"use client";

import { useEffect, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { ProductEditor } from "@/components/products/ProductEditor";
import { useProducts } from "@/hooks/useProducts";
import { useDistribution } from "@/hooks/useDistribution";
import { useConfig } from "@/hooks/useConfig";
import { useUpdateProduct } from "@/hooks/useUpdateProduct";
import { useUpdateDistribution } from "@/hooks/useUpdateDistribution";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { formatUSD } from "@/lib/formatters";
import type { Branch, BranchBoxes, Product } from "@/types/domain";

// ---------------------------------------------------------------------------
// Inline feedback banner
// ---------------------------------------------------------------------------

function FeedbackBanner({
  message,
  tone,
}: {
  message: string;
  tone: "success" | "error";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exchange rate section
// ---------------------------------------------------------------------------

function ExchangeRateSection() {
  const { config, loading, saving, error, updateTipoCambio } = useConfig();
  const [draft, setDraft] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && config) {
      setDraft(String(config.tipoCambioUSD));
    }
  }, [loading, config]);

  async function handleSave() {
    const value = parseFloat(draft);
    if (isNaN(value) || value <= 0) return;
    try {
      await updateTipoCambio(value);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // error is surfaced via hook's `error` state
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipo de cambio</CardTitle>
      </CardHeader>

      {loading ? (
        <p className="text-sm text-text-muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {success && (
            <FeedbackBanner
              message="Tipo de cambio actualizado."
              tone="success"
            />
          )}
          {error && (
            <FeedbackBanner message={error.message} tone="error" />
          )}
          <div className="flex items-end gap-3">
            <div className="w-48">
              <Input
                label="USD → ARS"
                name="tipoCambioUSD"
                type="number"
                min={1}
                step="1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !draft || parseFloat(draft) <= 0}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Products section
// ---------------------------------------------------------------------------

interface ProductsSectionProps {
  products: Product[];
  loading: boolean;
  error: Error | null;
}

function ProductsSection({ products, loading, error }: ProductsSectionProps) {
  const { updateProduct, saving, error: updateError } = useUpdateProduct();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave(
    data: Parameters<typeof updateProduct>[1],
  ) {
    if (!editingProduct) return;
    try {
      await updateProduct(editingProduct.id, data);
      setEditingProduct(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // error is surfaced via hook's `updateError` state
    }
  }

  async function handleToggleActivo(product: Product) {
    try {
      await updateProduct(product.id, { activo: !product.activo });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // error is surfaced via hook's `updateError` state
    }
  }

  const columns: SimpleColumn<Product>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (p) => (
        <span className="font-medium text-text-primary">{p.nombre}</span>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      render: (p) => (
        <span className="text-text-secondary">{p.categoria}</span>
      ),
    },
    {
      key: "costoUSD",
      header: "Costo USD",
      className: "text-right",
      render: (p) => (
        <span className="tabular-nums">{formatUSD(p.costoUSD)}</span>
      ),
    },
    {
      key: "precioVentaUSD",
      header: "Precio venta USD",
      className: "text-right",
      render: (p) => (
        <span className="tabular-nums">{formatUSD(p.precioVentaUSD)}</span>
      ),
    },
    {
      key: "esBudget",
      header: "Budget",
      render: (p) =>
        p.esBudget ? (
          <Badge tone="warning">Budget</Badge>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "activo",
      header: "Estado",
      render: (p) => (
        <Badge tone={p.activo ? "success" : "neutral"}>
          {p.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setEditingProduct(p)}
            disabled={saving}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleActivo(p)}
            disabled={saving}
          >
            {p.activo ? "Desactivar" : "Activar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          {loading && (
            <span className="text-xs text-text-muted">Cargando…</span>
          )}
        </CardHeader>

        <div className="flex flex-col gap-3">
          {success && (
            <FeedbackBanner message="Producto actualizado." tone="success" />
          )}
          {updateError && (
            <FeedbackBanner message={updateError.message} tone="error" />
          )}
          {error && (
            <FeedbackBanner message={error.message} tone="error" />
          )}
        </div>

        <div className={success || updateError || error ? "mt-3" : ""}>
          <SimpleTable<Product>
            columns={columns}
            rows={products}
            rowKey={(p) => p.id}
            empty="Sin productos"
          />
        </div>
      </Card>

      {editingProduct && (
        <ProductEditor
          product={editingProduct}
          saving={saving}
          onSave={handleSave}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Distribution section
// ---------------------------------------------------------------------------

function zeroedBranches(): BranchBoxes {
  return BRANCHES.reduce(
    (acc, b) => {
      acc[b] = 0;
      return acc;
    },
    {} as BranchBoxes,
  );
}

interface DistributionSectionProps {
  products: Product[];
  productsLoading: boolean;
}

function DistributionSection({
  products,
  productsLoading,
}: DistributionSectionProps) {
  const {
    distributions,
    byProductId,
    loading: distLoading,
  } = useDistribution();
  const { updateDistribution, saving, error } = useUpdateDistribution();

  const [drafts, setDrafts] = useState<Record<string, BranchBoxes>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [successProductId, setSuccessProductId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // Populate drafts once distributions are loaded, and add entries for new
  // products that appear without overwriting existing local edits.
  useEffect(() => {
    if (distLoading) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const dist of distributions) {
        if (!(dist.productId in next)) {
          next[dist.productId] = { ...dist.cajasPorSucursal };
        }
      }
      return next;
    });
  }, [distLoading, distributions]);

  function handleBoxesChange(
    productId: string,
    branch: Branch,
    value: number,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? byProductId[productId]?.cajasPorSucursal ?? zeroedBranches()),
        [branch]: value,
      },
    }));
  }

  async function handleSave(productId: string) {
    const cajas =
      drafts[productId] ??
      byProductId[productId]?.cajasPorSucursal ??
      zeroedBranches();
    setSavingProductId(productId);
    setSaveError(null);
    try {
      await updateDistribution(productId, cajas);
      setSuccessProductId(productId);
      setTimeout(() => setSuccessProductId(null), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err : new Error("Error al guardar distribución"),
      );
    } finally {
      setSavingProductId(null);
    }
  }

  const loading = productsLoading || distLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock por sucursal</CardTitle>
        {loading && (
          <span className="text-xs text-text-muted">Cargando…</span>
        )}
      </CardHeader>

      <p className="mb-4 text-xs text-text-muted">
        Ajuste manual del stock restante por sucursal. No genera ventas.
      </p>

      {(error || saveError) && (
        <div className="mb-3">
          <FeedbackBanner
            message={(error ?? saveError)!.message}
            tone="error"
          />
        </div>
      )}

      {!loading && (
        <div className="w-full overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                {BRANCHES.map((b) => (
                  <th key={b} className="px-4 py-3 font-medium">
                    {BRANCH_LABELS[b]}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => {
                const rowBoxes =
                  drafts[product.id] ??
                  byProductId[product.id]?.cajasPorSucursal ??
                  zeroedBranches();
                const isRowSaving = saving && savingProductId === product.id;
                return (
                  <tr key={product.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {product.nombre}
                        </span>
                        {successProductId === product.id && (
                          <Badge tone="success">Guardado</Badge>
                        )}
                      </div>
                    </td>
                    {BRANCHES.map((branch) => (
                      <td key={branch} className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={rowBoxes[branch] ?? 0}
                          disabled={isRowSaving}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            handleBoxesChange(
                              product.id,
                              branch,
                              isNaN(v) || v < 0 ? 0 : v,
                            );
                          }}
                          className="h-9 w-24 rounded-xl border border-border bg-surface-2 px-3 text-sm tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSave(product.id)}
                        disabled={saving}
                      >
                        {isRowSaving ? "Guardando…" : "Guardar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan={BRANCHES.length + 2}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    Sin productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ConfigContent() {
  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts({ activeOnly: false });

  return (
    <div className="flex flex-col gap-8">
      <ExchangeRateSection />
      <ProductsSection
        products={products}
        loading={productsLoading}
        error={productsError}
      />
      <DistributionSection
        products={products}
        productsLoading={productsLoading}
      />
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-text-secondary">
          Productos, stock y tipo de cambio
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin"]}>
          <ConfigContent />
        </RoleGuard>
      </div>
    </>
  );
}
