"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useBajas } from "@/hooks/useBajas";
import { useProducts } from "@/hooks/useProducts";
import {
  BAJA_MOTIVO_LABELS,
  BAJA_MOTIVOS,
  BAJA_TIPO_LABELS,
  bajaDebtUSD,
  bajaMotivoLabel,
  bajaTipo,
} from "@/lib/bajas";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { getErrorMessage, logError } from "@/lib/errors";
import { formatDateAR, formatNumberAR, formatUSD } from "@/lib/formatters";
import type { BajaMotivo, BajaStock, BajaTipo, Branch } from "@/types/domain";

const MOTIVO_OPTIONS = BAJA_MOTIVOS.map((value) => ({
  value,
  label: BAJA_MOTIVO_LABELS[value],
}));

interface FormState {
  productId: string;
  sucursal: Branch;
  cajas: string;
  tipo: BajaTipo;
  motivo: BajaMotivo | "";
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
    tipo: "devolucion_proveedor",
    motivo: "",
    fecha: todayInputValue(),
    notas: "",
  };
}

function BajasContent() {
  const { products, loading: productsLoading } = useProducts({ activeOnly: false });
  const { bajas, loading, error, createBaja, submitting } = useBajas();
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [formError, setFormError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const productName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products) map[product.id] = product.nombre;
    return map;
  }, [products]);

  const productById = useMemo(() => {
    const map = new Map(products.map((product) => [product.id, product]));
    return map;
  }, [products]);

  const selectedProduct = form.productId
    ? productById.get(form.productId)
    : undefined;
  const parsedCajas = Number(form.cajas);
  const estimatedDebt =
    form.tipo === "baja_sucursal" &&
    Number.isFinite(parsedCajas) &&
    parsedCajas > 0 &&
    selectedProduct
      ? parsedCajas * selectedProduct.costoUSD
      : 0;

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

  const recentBajas = useMemo(() => bajas.slice(0, 20), [bajas]);

  const columns = useMemo<SimpleColumn<BajaStock>[]>(
    () => [
      {
        key: "fecha",
        header: "Fecha",
        render: (baja) => (
          <span className="tabular-nums text-text-secondary">
            {formatDateAR(baja.fecha.toDate())}
          </span>
        ),
      },
      {
        key: "tipo",
        header: "Tipo",
        render: (baja) => {
          const tipo = bajaTipo(baja);
          return (
            <Badge tone={tipo === "baja_sucursal" ? "error" : "neutral"}>
              {BAJA_TIPO_LABELS[tipo]}
            </Badge>
          );
        },
      },
      {
        key: "producto",
        header: "Producto",
        render: (baja) => (
          <span className="font-medium text-text-primary">
            {productName[baja.productId] ?? baja.productId}
          </span>
        ),
      },
      {
        key: "sucursal",
        header: "Sucursal",
        render: (baja) => (
          <Badge tone="neutral">{BRANCH_LABELS[baja.sucursal]}</Badge>
        ),
      },
      {
        key: "cajas",
        header: "Cajas",
        className: "text-right",
        render: (baja) => (
          <span className="tabular-nums">{formatNumberAR(baja.cajas)}</span>
        ),
      },
      {
        key: "motivo",
        header: "Motivo",
        render: (baja) => (
          <span className="text-text-secondary">{bajaMotivoLabel(baja)}</span>
        ),
      },
      {
        key: "deuda",
        header: "Deuda USD",
        className: "text-right",
        render: (baja) => (
          <span className="tabular-nums text-text-secondary">
            {formatUSD(bajaDebtUSD(baja, productById.get(baja.productId)))}
          </span>
        ),
      },
      {
        key: "createdBy",
        header: "Creado por",
        render: (baja) => (
          <span className="text-xs text-text-secondary">{baja.createdBy}</span>
        ),
      },
      {
        key: "notas",
        header: "Notas",
        render: (baja) => (
          <span className="text-text-secondary">
            {baja.notas || <span className="text-text-muted">-</span>}
          </span>
        ),
      },
    ],
    [productById, productName],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTipo(tipo: BajaTipo) {
    setForm((current) => ({
      ...current,
      tipo,
      motivo:
        tipo === "baja_sucursal"
          ? current.motivo || "rotura"
          : current.motivo,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    try {
      await createBaja({
        productId: form.productId,
        sucursal: form.sucursal,
        cajas: Number(form.cajas),
        tipo: form.tipo,
        ...(form.motivo ? { motivo: form.motivo } : {}),
        fecha: dateFromInput(form.fecha),
        notas: form.notas,
      });
      setForm(initialFormState());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logError("registrar baja", err);
      setFormError(new Error(getErrorMessage(err, "No se pudo registrar la baja.")));
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nueva baja</CardTitle>
          {productsLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <Select
              label="Producto"
              name="productId"
              value={form.productId}
              onChange={(event) => update("productId", event.target.value)}
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
            <Select
              label="Tipo de baja"
              name="tipo"
              value={form.tipo}
              onChange={(event) => updateTipo(event.target.value as BajaTipo)}
              options={[
                {
                  value: "devolucion_proveedor",
                  label: BAJA_TIPO_LABELS.devolucion_proveedor,
                },
                {
                  value: "baja_sucursal",
                  label: BAJA_TIPO_LABELS.baja_sucursal,
                },
              ]}
              disabled={submitting}
            />
            <Select
              label="Motivo"
              name="motivo"
              value={form.motivo}
              onChange={(event) =>
                update("motivo", event.target.value as BajaMotivo | "")
              }
              options={
                form.tipo === "baja_sucursal"
                  ? MOTIVO_OPTIONS
                  : [{ value: "", label: "Sin motivo" }, ...MOTIVO_OPTIONS]
              }
              disabled={submitting}
              required={form.tipo === "baja_sucursal"}
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

          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-secondary">
            {form.tipo === "devolucion_proveedor"
              ? "No genera deuda con All Covering."
              : `Genera deuda con All Covering por el costo del producto. Deuda estimada: ${formatUSD(estimatedDebt)}.`}
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
              {getErrorMessage(formError ?? error, "No se pudo registrar la baja.")}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              Baja registrada correctamente.
            </p>
          )}

          <div>
            <Button
              type="submit"
              disabled={submitting || productsLoading || !form.productId}
            >
              {submitting ? "Registrando..." : "Registrar baja"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bajas recientes</CardTitle>
          {loading && <span className="text-xs text-text-muted">Cargando...</span>}
        </CardHeader>

        <SimpleTable<BajaStock>
          columns={columns}
          rows={recentBajas}
          rowKey={(baja) => baja.id}
          empty={loading ? "Cargando..." : "Sin bajas registradas"}
        />
      </Card>
    </>
  );
}

export default function BajasPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bajas</h1>
        <p className="text-sm text-text-secondary">
          Registro de salidas no vinculadas a ventas
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin"]}>
          <BajasContent />
        </RoleGuard>
      </div>
    </>
  );
}
