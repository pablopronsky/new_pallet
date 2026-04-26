"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useDistribution } from "@/hooks/useDistribution";
import { useProducts } from "@/hooks/useProducts";
import { useTraslados } from "@/hooks/useTraslados";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { getErrorMessage, logError } from "@/lib/errors";
import { formatDateAR, formatNumberAR } from "@/lib/formatters";
import type { Branch, TrasladoStock } from "@/types/domain";

interface FormState {
  productId: string;
  sucursalOrigen: Branch;
  sucursalDestino: Branch;
  cajas: string;
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
    sucursalOrigen: "gonnet",
    sucursalDestino: "quilmes",
    cajas: "",
    fecha: todayInputValue(),
    notas: "",
  };
}

function TrasladosContent() {
  const { products, loading: productsLoading } = useProducts({ activeOnly: false });
  const { byProductId, loading: distributionLoading } = useDistribution();
  const { traslados, loading, error, createTraslado, submitting } =
    useTraslados();
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [formError, setFormError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const productName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products) map[product.id] = product.nombre;
    return map;
  }, [products]);

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

  const originStock = useMemo(() => {
    if (!form.productId) return null;
    const distribution = byProductId[form.productId];
    if (!distribution) return 0;
    return distribution.cajasPorSucursal[form.sucursalOrigen] ?? 0;
  }, [byProductId, form.productId, form.sucursalOrigen]);

  const recentTraslados = useMemo(
    () => traslados.slice(0, 20),
    [traslados],
  );

  const columns = useMemo<SimpleColumn<TrasladoStock>[]>(
    () => [
      {
        key: "fecha",
        header: "Fecha",
        render: (traslado) => (
          <span className="tabular-nums text-text-secondary">
            {formatDateAR(traslado.fecha.toDate())}
          </span>
        ),
      },
      {
        key: "producto",
        header: "Producto",
        render: (traslado) => (
          <span className="font-medium text-text-primary">
            {productName[traslado.productId] ?? traslado.productId}
          </span>
        ),
      },
      {
        key: "origen",
        header: "Origen",
        render: (traslado) => (
          <Badge tone="neutral">
            {BRANCH_LABELS[traslado.sucursalOrigen]}
          </Badge>
        ),
      },
      {
        key: "destino",
        header: "Destino",
        render: (traslado) => (
          <Badge tone="success">
            {BRANCH_LABELS[traslado.sucursalDestino]}
          </Badge>
        ),
      },
      {
        key: "cajas",
        header: "Cajas",
        className: "text-right",
        render: (traslado) => (
          <span className="tabular-nums">
            {formatNumberAR(traslado.cajas)}
          </span>
        ),
      },
      {
        key: "createdBy",
        header: "Creado por",
        render: (traslado) => (
          <span className="text-xs text-text-secondary">
            {traslado.createdBy}
          </span>
        ),
      },
      {
        key: "notas",
        header: "Notas",
        render: (traslado) => (
          <span className="text-text-secondary">
            {traslado.notas || <span className="text-text-muted">-</span>}
          </span>
        ),
      },
    ],
    [productName],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    try {
      await createTraslado({
        productId: form.productId,
        sucursalOrigen: form.sucursalOrigen,
        sucursalDestino: form.sucursalDestino,
        cajas: Number(form.cajas),
        fecha: dateFromInput(form.fecha),
        notas: form.notas,
      });
      setForm(initialFormState());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logError("registrar movimiento", err);
      setFormError(
        new Error(getErrorMessage(err, "No se pudo registrar el movimiento.")),
      );
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo movimiento</CardTitle>
          {(productsLoading || distributionLoading) && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Select
              label="Producto"
              name="productId"
              value={form.productId}
              onChange={(event) => update("productId", event.target.value)}
              options={productOptions}
              disabled={productsLoading || submitting}
            />
            <Select
              label="Sucursal origen"
              name="sucursalOrigen"
              value={form.sucursalOrigen}
              onChange={(event) =>
                update("sucursalOrigen", event.target.value as Branch)
              }
              options={branchOptions}
              disabled={submitting}
            />
            <Select
              label="Sucursal destino"
              name="sucursalDestino"
              value={form.sucursalDestino}
              onChange={(event) =>
                update("sucursalDestino", event.target.value as Branch)
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
              inputMode="numeric"
              value={form.cajas}
              onChange={(event) => update("cajas", event.target.value)}
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

          {originStock !== null && (
            <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
              Stock disponible en origen:{" "}
              <span className="font-medium text-text-primary">
                {formatNumberAR(originStock)} cajas
              </span>
            </p>
          )}

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
              className="min-h-24 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 sm:text-sm"
              placeholder="Opcional"
            />
          </div>

          {(formError || error) && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {getErrorMessage(
                formError ?? error,
                "No se pudo registrar el movimiento.",
              )}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              Movimiento registrado correctamente.
            </p>
          )}

          <div>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                submitting ||
                productsLoading ||
                distributionLoading ||
                !form.productId
              }
            >
              {submitting ? "Registrando..." : "Registrar movimiento"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          {loading && <span className="text-xs text-text-muted">Cargando...</span>}
        </CardHeader>

        <SimpleTable<TrasladoStock>
          columns={columns}
          rows={recentTraslados}
          rowKey={(traslado) => traslado.id}
          empty={loading ? "Cargando..." : "Sin movimientos registrados"}
        />
      </Card>
    </>
  );
}

export default function TrasladosPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Movimientos entre sucursales
        </h1>
        <p className="text-sm text-text-secondary">
          {"Transferencia de mercader\u00eda entre sucursales"}
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "controlador"]}>
          <TrasladosContent />
        </RoleGuard>
      </div>
    </>
  );
}
