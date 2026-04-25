"use client";

import { useMemo } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { StatCard } from "@/components/ui/StatCard";
import { useDistribution } from "@/hooks/useDistribution";
import { useProducts } from "@/hooks/useProducts";
import { useSalesList } from "@/hooks/useSalesList";
import {
  calculateDebtUSD,
  calculateSoldBoxesByProduct,
  calculateTotalAvailableBoxes,
} from "@/lib/calculations";
import { formatNumberAR, formatUSD } from "@/lib/formatters";
import type { Product, ProductDistribution, Sale } from "@/types/domain";

interface ProviderRow {
  product: Product;
  soldBoxes: number;
  remainingBoxes: number;
  debtUSD: number;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function timestampToMillis(
  value: Product["updatedAt"] | ProductDistribution["updatedAt"] | Sale["fecha"],
): number | null {
  return value ? value.toMillis() : null;
}

function formatLastUpdated(value: number | null): string {
  if (!value) return "Sin datos";
  return dateTimeFormatter.format(new Date(value));
}

function latestMillis(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function ProviderTable({ rows }: { rows: ProviderRow[] }) {
  const columns = useMemo<SimpleColumn<ProviderRow>[]>(
    () => [
      {
        key: "producto",
        header: "Producto",
        render: (row) => (
          <span className="font-medium text-text-primary">
            {row.product.nombre}
          </span>
        ),
      },
      {
        key: "categoria",
        header: "Tipo/categoria",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{row.product.categoria}</Badge>
            {row.product.esBudget && <Badge tone="warning">Budget</Badge>}
          </div>
        ),
      },
      {
        key: "vendidas",
        header: "Cajas vendidas",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">{formatNumberAR(row.soldBoxes)}</span>
        ),
      },
      {
        key: "restantes",
        header: "Cajas restantes",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">
            {formatNumberAR(row.remainingBoxes)}
          </span>
        ),
      },
      {
        key: "deuda",
        header: "Deuda USD",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">{formatUSD(row.debtUSD)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <SimpleTable<ProviderRow>
      columns={columns}
      rows={rows}
      rowKey={(row) => row.product.id}
      empty="Sin productos"
    />
  );
}

function ProviderContent() {
  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts({ activeOnly: false });
  const {
    byProductId,
    distributions,
    loading: distributionLoading,
    error: distributionError,
  } = useDistribution();
  const {
    sales,
    loading: salesLoading,
    error: salesError,
  } = useSalesList();

  const loading = productsLoading || distributionLoading || salesLoading;
  const error = productsError ?? distributionError ?? salesError;

  const rows = useMemo<ProviderRow[]>(() => {
    const soldByProduct = calculateSoldBoxesByProduct(sales);

    return products.map((product) => {
      const distribution = byProductId[product.id];
      const soldBoxes = soldByProduct[product.id] ?? 0;
      const remainingBoxes = distribution
        ? calculateTotalAvailableBoxes(distribution)
        : 0;

      return {
        product,
        soldBoxes,
        remainingBoxes,
        debtUSD: calculateDebtUSD(product, soldBoxes),
      };
    });
  }, [byProductId, products, sales]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          debtUSD: acc.debtUSD + row.debtUSD,
          soldBoxes: acc.soldBoxes + row.soldBoxes,
          remainingBoxes: acc.remainingBoxes + row.remainingBoxes,
        }),
        { debtUSD: 0, soldBoxes: 0, remainingBoxes: 0 },
      ),
    [rows],
  );

  const lastUpdated = useMemo(() => {
    return latestMillis([
      ...products.map((product) => timestampToMillis(product.updatedAt)),
      ...distributions.map((distribution) =>
        timestampToMillis(distribution.updatedAt),
      ),
      ...sales.map((sale) => timestampToMillis(sale.fecha)),
    ]);
  }, [distributions, products, sales]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Deuda total USD"
          value={loading ? "..." : formatUSD(totals.debtUSD)}
          hint="Cajas vendidas por costo"
          tone="accent"
        />
        <StatCard
          label="Cajas vendidas"
          value={loading ? "..." : `${formatNumberAR(totals.soldBoxes)} cajas`}
          tone="primary"
        />
        <StatCard
          label="Cajas restantes"
          value={
            loading ? "..." : `${formatNumberAR(totals.remainingBoxes)} cajas`
          }
        />
        <StatCard
          label="Ultima actualizacion"
          value={loading ? "..." : formatLastUpdated(lastUpdated)}
          hint="Segun stock, productos o ventas"
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resumen por producto</CardTitle>
          {loading && <span className="text-xs text-text-muted">Cargando...</span>}
        </CardHeader>

        {error && (
          <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error.message}
          </p>
        )}

        <ProviderTable rows={rows} />
      </Card>
    </>
  );
}

export default function ProveedorPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Portal All Covering
        </h1>
        <p className="text-sm text-text-secondary">
          Vista consolidada de cajas vendidas, stock restante y deuda.
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["allcovering", "admin"]}>
          <ProviderContent />
        </RoleGuard>
      </div>
    </>
  );
}
