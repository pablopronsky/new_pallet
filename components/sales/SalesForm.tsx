"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useSales, type CreateSaleInput } from "@/hooks/useSales";
import { StockAvailabilityError } from "@/lib/calculations";
import { BRANCHES, BRANCH_LABELS, DEFAULT_TIPO_CAMBIO_USD } from "@/lib/constants";
import { getErrorMessage, logError } from "@/lib/errors";
import type { Branch } from "@/types/domain";

type Moneda = "USD" | "ARS";

interface FormState {
  productId: string;
  sucursal: Branch | "";
  cajas: string;
  moneda: Moneda;
  monto: string;
  tipoCambioUSD: string;
  fecha: string;
}

function initialState(sucursal: Branch | "" = ""): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    productId: "",
    sucursal,
    cajas: "",
    moneda: "USD",
    monto: "",
    tipoCambioUSD: String(DEFAULT_TIPO_CAMBIO_USD),
    fecha: today,
  };
}

function isValidForm(form: FormState): boolean {
  if (!form.productId) return false;
  if (!form.sucursal) return false;

  const cajas = Number(form.cajas);
  if (!Number.isInteger(cajas) || cajas <= 0) return false;

  if (form.monto.trim() === "") return false;
  const monto = Number(form.monto);
  if (!Number.isFinite(monto) || monto < 0) return false;

  if (form.moneda === "ARS") {
    const tc = Number(form.tipoCambioUSD);
    if (!Number.isFinite(tc) || tc <= 0) return false;
  }

  if (!form.fecha) return false;
  const d = new Date(form.fecha);
  if (Number.isNaN(d.getTime())) return false;

  return true;
}

export function SalesForm({ defaultBranch }: { defaultBranch?: Branch }) {
  // useProducts() filters activo === true by default
  const { role, profile } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { createSale, submitting } = useSales();
  const vendedorBranch =
    role === "vendedor" ? profile?.sucursalAsignada : undefined;

  const [form, setForm] = useState<FormState>(() =>
    initialState(vendedorBranch ?? defaultBranch ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!vendedorBranch) return;
    setForm((f) => ({ ...f, sucursal: vendedorBranch }));
  }, [vendedorBranch]);

  useEffect(() => {
    if (vendedorBranch || !defaultBranch) return;
    setForm((current) =>
      current.sucursal ? current : { ...current, sucursal: defaultBranch },
    );
  }, [defaultBranch, vendedorBranch]);

  const productOptions = useMemo(() => {
    if (productsLoading) {
      return [{ value: "", label: "Cargando productos..." }];
    }
    return [
      { value: "", label: "Seleccionar producto" },
      ...products.map((p) => ({ value: p.id, label: p.nombre })),
    ];
  }, [products, productsLoading]);

  const branchOptions = useMemo(
    () => [
      { value: "", label: "Seleccionar sucursal" },
      ...BRANCHES.map((b) => ({ value: b, label: BRANCH_LABELS[b] })),
    ],
    [],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (success) setSuccess(null);
    if (error) setError(null);
  };

  const formValid = isValidForm(form);
  const canSubmit =
    formValid &&
    !submitting &&
    !productsLoading &&
    !(role === "vendedor" && !vendedorBranch);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!formValid) return;

    const cajas = Number(form.cajas);
    const monto = Number(form.monto);
    const tipoCambioUSD =
      form.moneda === "ARS" ? Number(form.tipoCambioUSD) : DEFAULT_TIPO_CAMBIO_USD;
    const fecha = new Date(form.fecha);

    const input: CreateSaleInput = {
      productId: form.productId,
      sucursal: vendedorBranch ?? (form.sucursal as Branch),
      cajas,
      tipoCambioUSD,
      fecha,
      ...(form.moneda === "USD" ? { montoUSD: monto } : { montoARS: monto }),
    };

    try {
      await createSale(input);
      setForm(initialState(vendedorBranch ?? defaultBranch ?? ""));
      setSuccess("Venta registrada correctamente");
    } catch (err) {
      logError("registrar venta", err);
      if (err instanceof StockAvailabilityError) {
        setError(getErrorMessage(err, "No se pudo registrar la venta."));
      } else {
        setError(getErrorMessage(err, "No se pudo registrar la venta."));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar venta</CardTitle>
      </CardHeader>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Producto"
          name="productId"
          value={form.productId}
          onChange={(e) => update("productId", e.target.value)}
          options={productOptions}
          disabled={productsLoading}
          required
        />

        <Select
          label="Sucursal"
          name="sucursal"
          value={form.sucursal}
          onChange={(e) => update("sucursal", e.target.value as Branch | "")}
          options={branchOptions}
          disabled={role === "vendedor"}
          hint={
            vendedorBranch
              ? "Solo podés vender stock de tu sucursal."
              : role === "vendedor"
                ? "Tu usuario no tiene una sucursal asignada."
              : undefined
          }
          required
        />

        <Input
          label="Cajas"
          name="cajas"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={form.cajas}
          onChange={(e) => update("cajas", e.target.value)}
          required
        />

        <Select
          label="Moneda"
          name="moneda"
          value={form.moneda}
          onChange={(e) => update("moneda", e.target.value as Moneda)}
          options={[
            { value: "USD", label: "USD" },
            { value: "ARS", label: "ARS" },
          ]}
        />

        <Input
          label={`Monto (${form.moneda})`}
          name="monto"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={form.monto}
          onChange={(e) => update("monto", e.target.value)}
          required
        />

        {form.moneda === "ARS" && (
          <Input
            label="Tipo de cambio USD"
            name="tipoCambioUSD"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={form.tipoCambioUSD}
            onChange={(e) => update("tipoCambioUSD", e.target.value)}
            required
          />
        )}

        <Input
          label="Fecha"
          name="fecha"
          type="date"
          value={form.fecha}
          onChange={(e) => update("fecha", e.target.value)}
          required
        />

        <div className="flex flex-col gap-3 md:col-span-2">
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          {success && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/15 px-4 py-3 text-sm font-medium text-success"
            >
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"
              >
                ✓
              </span>
              <span>{success}</span>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canSubmit}
              size="lg"
              className="w-full sm:w-auto"
            >
              {submitting ? "Guardando..." : "Registrar venta"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
