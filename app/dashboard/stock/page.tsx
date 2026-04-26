"use client";

import { useMemo } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useBranchFilter } from "@/contexts/BranchFilterContext";
import { useDistribution } from "@/hooks/useDistribution";
import { useProducts } from "@/hooks/useProducts";
import { useSalesList } from "@/hooks/useSalesList";
import {
  calculateRemainingBoxes,
  calculateSellThrough,
  calculateSoldBoxesByProduct,
  calculateTotalAvailableBoxes,
} from "@/lib/calculations";
import { cn } from "@/lib/cn";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatPercent } from "@/lib/formatters";
import type { Branch, Product, ProductDistribution } from "@/types/domain";

interface StockRow {
  product: Product;
  distribution: ProductDistribution | null;
  branchBoxes: Record<Branch, number>;
  remaining: number;
  sold: number;
  totalAvailable: number;
  sellThrough: number;
}

const LOW_STOCK_THRESHOLD = 10;
const HIGH_SELL_THROUGH = 0.8;

function zeroedBranches(): Record<Branch, number> {
  return BRANCHES.reduce(
    (acc, branch) => {
      acc[branch] = 0;
      return acc;
    },
    {} as Record<Branch, number>,
  );
}

function StockTable({
  rows,
  selectedBranch,
}: {
  rows: StockRow[];
  selectedBranch: Branch | "all";
}) {
  const columns = useMemo<SimpleColumn<StockRow>[]>(() => {
    const visibleBranches =
      selectedBranch === "all" ? BRANCHES : [selectedBranch];

    return [
      {
        key: "nombre",
        header: "Producto",
        render: (row) => (
          <div className="font-medium text-text-primary">
            {row.product.nombre}
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">{row.totalAvailable}</span>
        ),
      },
      ...visibleBranches.map<SimpleColumn<StockRow>>((branch) => ({
        key: branch,
        header: BRANCH_LABELS[branch],
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">
            {row.branchBoxes[branch] ?? 0}
          </span>
        ),
      })),
      {
        key: "sold",
        header: "Vendidas",
        className: "text-right",
        render: (row) => <span className="tabular-nums">{row.sold}</span>,
      },
      {
        key: "remaining",
        header: "Restantes",
        className: "text-right",
        render: (row) => {
          const low = row.remaining > 0 && row.remaining <= LOW_STOCK_THRESHOLD;
          const empty = row.remaining === 0 && row.totalAvailable > 0;
          return (
            <span
              className={cn(
                "tabular-nums font-medium",
                empty || low ? "text-danger" : "text-text-primary",
              )}
            >
              {row.remaining}
            </span>
          );
        },
      },
      {
        key: "sellThrough",
        header: "Sell-through",
        className: "text-right",
        render: (row) => {
          if (row.totalAvailable === 0) {
            return <span className="text-text-muted">-</span>;
          }
          const high = row.sellThrough >= HIGH_SELL_THROUGH;
          return (
            <Badge tone={high ? "success" : "neutral"}>
              {formatPercent(row.sellThrough)}
            </Badge>
          );
        },
      },
    ];
  }, [selectedBranch]);

  return (
    <SimpleTable<StockRow>
      columns={columns}
      rows={rows}
      rowKey={(row) => row.product.id}
      empty="Sin productos activos"
    />
  );
}

function StockContent() {
  const { selectedBranch } = useBranchFilter();
  const branchFilter = selectedBranch === "all" ? undefined : selectedBranch;
  const { products, loading: productsLoading, error: productsError } =
    useProducts();
  const {
    byProductId,
    loading: distLoading,
    error: distError,
  } = useDistribution();
  const { sales, loading: salesLoading, error: salesError } = useSalesList();

  const loading = productsLoading || distLoading || salesLoading;
  const errors = [productsError, distError, salesError].filter(
    (error): error is Error => Boolean(error),
  );

  const rows: StockRow[] = useMemo(() => {
    const filteredSales = branchFilter
      ? sales.filter((sale) => sale.sucursal === branchFilter)
      : sales;
    const soldByProduct = calculateSoldBoxesByProduct(filteredSales);

    return products.map<StockRow>((product) => {
      const distribution = byProductId[product.id] ?? null;
      const branchBoxes = distribution?.cajasPorSucursal ?? zeroedBranches();
      // distribucion.cajasPorSucursal is live remaining stock (sales already subtract from it).
      // Do not also subtract sales here, because that would double-count.
      const remaining = distribution
        ? branchFilter
          ? branchBoxes[branchFilter] ?? 0
          : calculateTotalAvailableBoxes(distribution)
        : 0;
      const sold = soldByProduct[product.id] ?? 0;
      const totalAvailable = remaining + sold;
      const sellThrough = calculateSellThrough(
        sold,
        calculateRemainingBoxes(totalAvailable, sold),
      );
      return {
        product,
        distribution,
        branchBoxes,
        remaining,
        sold,
        totalAvailable,
        sellThrough,
      };
    });
  }, [branchFilter, products, byProductId, sales]);

  const totals = useMemo(() => {
    const total = rows.reduce((acc, row) => acc + row.totalAvailable, 0);
    const sold = rows.reduce((acc, row) => acc + row.sold, 0);
    const remaining = rows.reduce((acc, row) => acc + row.remaining, 0);
    const sellThrough = total > 0 ? sold / total : 0;
    return { total, sold, remaining, sellThrough };
  }, [rows]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Stock total"
          value={loading ? "..." : `${totals.total} cajas`}
          hint="Stock vivo + cajas vendidas del foco actual"
        />
        <StatCard
          label="Vendidas"
          value={loading ? "..." : `${totals.sold} cajas`}
          tone="accent"
        />
        <StatCard
          label="Restantes"
          value={loading ? "..." : `${totals.remaining} cajas`}
          tone={totals.remaining === 0 && totals.total > 0 ? "danger" : "default"}
          hint="Stock vivo por sucursal"
        />
        <StatCard
          label="Sell-through"
          value={loading ? "..." : formatPercent(totals.sellThrough)}
          tone={totals.sellThrough >= HIGH_SELL_THROUGH ? "success" : "primary"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Distribucion por producto</CardTitle>
            <p className="mt-1 text-xs text-text-muted">
              Vista:{" "}
              {branchFilter
                ? BRANCH_LABELS[branchFilter]
                : "Todas las sucursales"}
            </p>
          </div>
          {loading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>
        {errors.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {errors.map((error, index) => (
              <p
                key={`${getErrorMessage(error)}:${index}`}
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
              >
                {getErrorMessage(error, "No se pudo cargar el stock.")}
              </p>
            ))}
          </div>
        )}
        <StockTable rows={rows} selectedBranch={selectedBranch} />
      </Card>
    </>
  );
}

export default function StockPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
        <p className="text-sm text-text-secondary">
          Distribucion y sell-through por producto
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin"]}>
          <StockContent />
        </RoleGuard>
      </div>
    </>
  );
}
