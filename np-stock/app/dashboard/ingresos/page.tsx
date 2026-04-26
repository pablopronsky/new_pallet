"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useIngresos } from "@/hooks/useIngresos";
import { useProducts } from "@/hooks/useProducts";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { formatDateAR, formatNumberAR, formatUSD } from "@/lib/formatters";
import type { Branch, IngresoStock } from "@/types/domain";

interface FormState {
  productId: string;
  sucursal: Branch;
  cajas: string;
  costoUSDPorCaja: string;
  fecha: string;
  notas: string;
}

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function initialFormState(): FormState {
  return {
    productId: "",
    sucursal: "gonnet",
    cajas: "",
    costoUSDPorCaja: "",
    fecha: todayInputValue(),
    notas: "",
  };
}

function IngresosContent() {
  const { products, loading: productsLoading } = useProducts({ activeOnly: false });
  const { ingresos, loading, error, createIngreso, submitting } = useIngresos();
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [formError, setFormError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const productName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products) map[product.id] = product.nombre;
    return map;
  }, [products]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.productId) ?? null,
    [form.productId, products],
  );

  useEffect(() => {
    if (!selectedProduct || selectedProduct.costoUSD <= 0) return;
    setForm((current) =>
      current.costoUSDPorCaja
        ? current
        : {
            ...current,
            costoUSDPorCaja: String(selectedProduct.costoUSD),
          },
    );
  }, [selectedProduct]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar producto" },
      ...products.map((product) => ({
        value: product.id,
        label: product.nombre,
      })),
    ],
    [products],
  );

  const branchOptions = useMemo(
    () =>
      BRANCHES.map((branch) => ({
        value: branch,
        label: BRANCH_LABELS[branch],
      })),
    [],
  );

  const recentIngresos = useMemo(() => ingresos.slice(0, 20), [ingresos]);

  const totalCostUSD = useMemo(() => {
    const cajas = Number(form.cajas);
    const costoUSDPorCaja = Number(form.costoUSDPorCaja);
    if (
      !Number.isFinite(cajas) ||
      !Number.isFinite(costoUSDPorCaja) ||
      cajas <= 0 ||
      costoUSDPorCaja <= 0
    ) {
      return 0;
    }
    return cajas * costoUSDPorCaja;
  }, [form.cajas, form.costoUSDPorCaja]);

  const columns = useMemo<SimpleColumn<IngresoStock>[]>(
    () => [
      {
        key: "fecha",
        header: "Fecha",
        render: (ingreso) => (
          <span className="tabular-nums text-text-secondary">
            {formatDateAR(ingreso.fecha.toDate())}
          </span>
        ),
      },
      {
        key: "producto",
        header: "Producto",
        render: (ingreso) => (
          <span className="font-medium text-text-primary">
            {productName[ingreso.productId] ?? ingreso.productId}
          </span>
        ),
      },
      {
        key: "sucursal",
        header: "Sucursal",
        render: (ingreso) => (
          <Badge tone="neutral">{BRANCH_LABELS[ingreso.sucursal]}</Badge>
        ),
      },
      {
        key: "cajas",
        header: "Cajas",
        className: "text-right",
        render: (ingreso) => (
          <span className="tabular-nums">{formatNumberAR(ingreso.cajas)}</span>
        ),
      },
      {
        key: "costoUSDPorCaja",
        header: "Costo USD/caja",
        className: "text-right",
        render: (ingreso) => (
          <span className="tabular-nums">
            {formatUSD(ingreso.costoUSDPorCaja)}
          </span>
        ),
      },
      {
        key: "costoTotalUSD",
        header: "Costo total USD",
        className: "text-right",
        render: (ingreso) => (
          <span className="tabular-nums">
            {formatUSD(ingreso.costoTotalUSD)}
          </span>
        ),
      },
      {
        key: "createdBy",
        header: "Creado por",
        render: (ingreso) => (
          <span className="text-xs text-text-secondary">
            {ingreso.createdBy}
          </span>
        ),
      },
      {
        key: "notas",
        header: "Notas",
        render: (ingreso) => (
          <span className="text-text-secondary">
            {ingreso.notas || <span className="text-text-muted">-</span>}
          </span>
        ),
      },
    ],
    [productName],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleProductChange(productId: string) {
    const product = products.find((item) => item.id === productId);
    setForm((current) => ({
      ...current,
      productId,
      costoUSDPorCaja:
        product && product.costoUSD > 0 ? String(product.costoUSD) : "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    try {
      await createIngreso({
        productId: form.productId,
        sucursal: form.sucursal,
        cajas: Number(form.cajas),
        costoUSDPorCaja: Number(form.costoUSDPorCaja),
        fecha: dateFromInput(form.fecha),
        notas: form.notas,
      });
      setForm(initialFormState());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setFormError(
        err instanceof Error ? err : new Error("No se pudo crear el ingreso"),
      );
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo ingreso</CardTitle>
          {productsLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Select
              label="Producto"
              name="productId"
              value={form.productId}
              onChange={(event) => handleProductChange(event.target.value)}
              options={productOptions}
              disabled={productsLoading || submitting}
            />
            <Select
              label="Sucursal"
              name="sucursal"
              value={form.sucursal}
              onChange={(event) =>
                update("sucursal", event.target.value as Branch)
              }
              options={branchOptions}
              disabled={submitting}
            />
            <Input
              label="Cajas"
              name="cajas"
              type="number"
              min={1}
              step={1}
              value={form.cajas}
              onChange={(event) => update("cajas", event.target.value)}
              disabled={submitting}
            />
            <Input
              label="Costo USD/caja"
              name="costoUSDPorCaja"
              type="number"
              min={0}
              step={0.01}
              value={form.costoUSDPorCaja}
              onChange={(event) =>
                update("costoUSDPorCaja", event.target.value)
              }
              disabled={submitting}
            />
            <Input
              label="Fecha"
              name="fecha"
              type="date"
              value={form.fecha}
              onChange={(event) => update("fecha", event.target.value)}
              disabled={submitting}
            />
          </div>

          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
            Total costo:{" "}
            <span className="font-medium text-text-primary">
              {formatUSD(totalCostUSD)}
            </span>
          </p>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="notas"
              className="text-xs font-medium text-text-secondary"
            >
              Notas
            </label>
            <textarea
              id="notas"
              name="notas"
              rows={3}
              value={form.notas}
              onChange={(event) => update("notas", event.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              placeholder="Opcional"
            />
          </div>

          {(formError || error) && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {(formError ?? error)!.message}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              Ingreso registrado.
            </p>
          )}

          <div>
            <Button
              type="submit"
              disabled={
                submitting ||
                productsLoading ||
                !form.productId ||
                Number(form.costoUSDPorCaja) <= 0
              }
            >
              {submitting ? "Registrando..." : "Registrar ingreso"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Ingresos recientes</CardTitle>
          {loading && <span className="text-xs text-text-muted">Cargando...</span>}
        </CardHeader>

        <SimpleTable<IngresoStock>
          columns={columns}
          rows={recentIngresos}
          rowKey={(ingreso) => ingreso.id}
          empty={loading ? "Cargando..." : "Sin ingresos registrados"}
        />
      </Card>
    </>
  );
}

export default function IngresosPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
        <p className="text-sm text-text-secondary">
          Carga de mercadería recibida por sucursal
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "controlador"]}>
          <IngresosContent />
        </RoleGuard>
      </div>
    </>
  );
}
