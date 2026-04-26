"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useAudits } from "@/hooks/useAudits";
import { useAuth } from "@/hooks/useAuth";
import { useBajas } from "@/hooks/useBajas";
import { useBranchFilter } from "@/contexts/BranchFilterContext";
import { useDistribution } from "@/hooks/useDistribution";
import { useIngresos } from "@/hooks/useIngresos";
import { useProducts } from "@/hooks/useProducts";
import { useSalesHistory } from "@/hooks/useSalesHistory";
import { useTraslados } from "@/hooks/useTraslados";
import {
  displayNameForUser,
  useUserProfiles,
} from "@/hooks/useUserProfiles";
import { BRANCH_LABELS } from "@/lib/constants";
import {
  buildProductMap,
  calculateAuditAlerts,
  calculateBranchSummaries,
  calculateDashboardMetrics,
  calculateOperationalLosses,
  calculateProductStats,
  calculateRecentActivity,
  calculateStockAlerts,
  type AuditAlert,
  type BranchSummary,
  type DashboardPeriod,
  type OperationalLossRow,
  type ProductStat,
  type RecentActivityRow,
  type StockAlert,
} from "@/lib/dashboard";
import {
  formatDateAR,
  formatNumberAR,
  formatPercent,
  formatUSD,
} from "@/lib/formatters";
import { getErrorMessage } from "@/lib/errors";
import type { Branch, Product } from "@/types/domain";

const periodOptions: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "all", label: "Todo" },
];

const activityTone: Record<RecentActivityRow["tipo"], BadgeTone> = {
  venta: "primary",
  ingreso: "success",
  baja: "error",
  movimiento: "warning",
  auditoria: "neutral",
};

function periodFilter(
  period: DashboardPeriod,
  onChange: (period: DashboardPeriod) => void,
) {
  return (
    <div className="flex flex-wrap gap-2">
      {periodOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={period === option.value ? "primary" : "secondary"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ErrorMessage({ errors }: { errors: Error[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2">
      {errors.map((error, index) => (
        <p
          key={`${getErrorMessage(error)}:${index}`}
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {getErrorMessage(error, "No se pudieron cargar los datos del dashboard.")}
        </p>
      ))}
    </div>
  );
}

function LinkCard({
  href,
  title,
  badge,
  description,
  tone = "primary",
}: {
  href: string;
  title: string;
  badge: string;
  description: string;
  tone?: BadgeTone;
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:border-primary/60 hover:bg-surface-2">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <Badge tone={tone}>{badge}</Badge>
        </CardHeader>
        <p className="text-sm text-text-secondary">{description}</p>
      </Card>
    </Link>
  );
}

function BranchPerformanceTable({ rows }: { rows: BranchSummary[] }) {
  const columns: SimpleColumn<BranchSummary>[] = [
    {
      key: "sucursal",
      header: "Sucursal",
      render: (row) => (
        <span className="font-medium text-text-primary">{row.label}</span>
      ),
    },
    {
      key: "ventas",
      header: "Ventas",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatNumberAR(row.ventasCount)}</span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatUSD(row.revenueUSD)}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">
          {formatNumberAR(row.stockDisponible)}
        </span>
      ),
    },
    {
      key: "bajas",
      header: "Bajas",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">
          {formatNumberAR(row.bajaSucursalCajas)}
        </span>
      ),
    },
    {
      key: "movimientos",
      header: "Movimientos",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">
          {formatNumberAR(row.movimientosIn + row.movimientosOut)}
        </span>
      ),
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Performance por sucursal</CardTitle>
        <Badge tone="neutral">{rows.length}</Badge>
      </CardHeader>
      <SimpleTable<BranchSummary>
        columns={columns}
        rows={rows}
        rowKey={(row) => row.branch}
        empty="Sin datos por sucursal"
      />
    </Card>
  );
}

function ProductPerformanceTable({ rows }: { rows: ProductStat[] }) {
  const columns: SimpleColumn<ProductStat>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (row) => (
        <span className="font-medium text-text-primary">{row.producto}</span>
      ),
    },
    {
      key: "cajasVendidas",
      header: "Cajas vendidas",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatNumberAR(row.cajasVendidas)}</span>
      ),
    },
    {
      key: "rotacion",
      header: "Rotacion",
      className: "text-right",
      render: (row) => (
        <Badge tone={row.rotacion >= 0.8 ? "success" : "neutral"}>
          {formatPercent(row.rotacion)}
        </Badge>
      ),
    },
    {
      key: "stockActual",
      header: "Stock actual",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatNumberAR(row.stockActual)}</span>
      ),
    },
    {
      key: "diasStock",
      header: "Dias de stock",
      className: "text-right",
      render: (row) =>
        row.diasStock === null ? (
          <span className="text-text-muted">∞</span>
        ) : (
          <span className="tabular-nums">{formatNumberAR(row.diasStock)}</span>
        ),
    },
    {
      key: "revenue",
      header: "Revenue",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatUSD(row.revenueUSD)}</span>
      ),
    },
    {
      key: "deuda",
      header: "Deuda",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatUSD(row.deudaUSD)}</span>
      ),
    },
    {
      key: "utilidad",
      header: "Utilidad",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatUSD(row.utilidadBruta)}</span>
      ),
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Performance por producto</CardTitle>
        <Badge tone="neutral">{rows.length}</Badge>
      </CardHeader>
      <SimpleTable<ProductStat>
        columns={columns}
        rows={rows.slice(0, 10)}
        rowKey={(row) => row.productId}
        empty="Sin ventas en el período"
      />
    </Card>
  );
}

function StockAlertsCard({ rows }: { rows: StockAlert[] }) {
  const sections = [
    {
      type: "sin_stock" as const,
      title: "Sin stock",
      badge: "sin stock",
      tone: "error" as BadgeTone,
      empty: "Sin productos agotados.",
    },
    {
      type: "stock_bajo" as const,
      title: "Stock bajo",
      badge: "stock bajo",
      tone: "warning" as BadgeTone,
      empty: "Sin productos con stock bajo.",
    },
    {
      type: "sin_movimiento" as const,
      title: "Sin movimiento",
      badge: "sin movimiento",
      tone: "neutral" as BadgeTone,
      empty: "Sin stock detenido.",
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Alertas de inventario</CardTitle>
        <Badge tone={rows.length > 0 ? "warning" : "success"}>{rows.length}</Badge>
      </CardHeader>
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => {
          const sectionRows = rows
            .filter((row) => row.type === section.type)
            .slice(0, 8);

          return (
            <div key={section.type} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  {section.title}
                </h3>
                <Badge tone={section.tone}>{sectionRows.length}</Badge>
              </div>
              {sectionRows.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
                  {section.empty}
                </p>
              ) : (
                sectionRows.map((row) => (
                  <div
                    key={`${row.type}:${row.productId}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {row.producto}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">
                        {formatNumberAR(row.totalStock)} cajas
                      </span>
                      <Badge tone={section.tone}>{section.badge}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AuditAlertsTable({
  rows,
  productsById,
}: {
  rows: AuditAlert[];
  productsById: Record<string, Product>;
}) {
  const columns: SimpleColumn<AuditAlert>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (row) => (
        <span className="font-medium text-text-primary">
          {productsById[row.item.productId]?.nombre ?? row.item.productId}
        </span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal",
      render: (row) => BRANCH_LABELS[row.item.sucursal],
    },
    {
      key: "sistema",
      header: "Sistema",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{row.item.cajasSistema}</span>
      ),
    },
    {
      key: "contado",
      header: "Contado",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{row.item.cajasContadas}</span>
      ),
    },
    {
      key: "diferencia",
      header: "Diferencia",
      className: "text-right",
      render: (row) => (
        <Badge tone={row.item.diferencia > 0 ? "warning" : "error"}>
          {row.item.diferencia > 0
            ? `+${row.item.diferencia}`
            : row.item.diferencia}
        </Badge>
      ),
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Diferencias pendientes</CardTitle>
        <Badge tone={rows.length > 0 ? "error" : "success"}>{rows.length}</Badge>
      </CardHeader>
      <SimpleTable<AuditAlert>
        columns={columns}
        rows={rows.slice(0, 8)}
        rowKey={(row) => `${row.auditId}:${row.item.productId}:${row.item.sucursal}`}
        empty="Sin diferencias pendientes."
      />
    </Card>
  );
}

function OperationalLossTable({ rows }: { rows: OperationalLossRow[] }) {
  const columns: SimpleColumn<OperationalLossRow>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (row) => (
        <span className="font-medium text-text-primary">{row.producto}</span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal",
      render: (row) => BRANCH_LABELS[row.sucursal],
    },
    {
      key: "cajas",
      header: "Cajas",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatNumberAR(row.cajas)}</span>
      ),
    },
    {
      key: "usdPerdido",
      header: "USD perdido",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums">{formatUSD(row.usdPerdido)}</span>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {formatDateAR(row.fecha.toDate())}
        </span>
      ),
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Perdidas operativas</CardTitle>
        <Badge tone={rows.length > 0 ? "error" : "success"}>{rows.length}</Badge>
      </CardHeader>
      <SimpleTable<OperationalLossRow>
        columns={columns}
        rows={rows.slice(0, 10)}
        rowKey={(row) => row.id}
        empty="Sin bajas de sucursal en el periodo"
      />
    </Card>
  );
}

function RecentActivityTable({
  rows,
  userNameFor,
}: {
  rows: RecentActivityRow[];
  userNameFor: (uid: string) => string;
}) {
  const columns: SimpleColumn<RecentActivityRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {formatDateAR(row.fecha.toDate())}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (row) => (
        <Badge tone={activityTone[row.tipo]}>
          {row.tipo === "movimiento" ? "mov." : row.tipo}
        </Badge>
      ),
    },
    {
      key: "detalle",
      header: "Producto",
      render: (row) => (
        <span className="font-medium text-text-primary">{row.detalle}</span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal / origen-destino",
      render: (row) => (
        <span className="text-text-secondary">{row.sucursalDetalle}</span>
      ),
    },
    {
      key: "cajas",
      header: "Cajas",
      className: "text-right",
      render: (row) =>
        typeof row.cajas === "number" ? (
          <span className="tabular-nums">{formatNumberAR(row.cajas)}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
    {
      key: "importe",
      header: "Impacto USD",
      className: "text-right",
      render: (row) =>
        typeof row.importeUSD === "number" ? (
          <span className="tabular-nums">{formatUSD(row.importeUSD)}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
    {
      key: "createdBy",
      header: "Usuario",
      render: (row) => (
        <span className="text-xs text-text-secondary">
          {userNameFor(row.createdBy)}
        </span>
      ),
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <Badge tone="neutral">{rows.length}</Badge>
      </CardHeader>
      <SimpleTable<RecentActivityRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => `${row.tipo}:${row.id}`}
        empty="Sin movimientos registrados"
      />
    </Card>
  );
}

function ProviderDashboard() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Acceso proveedor All Covering
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <LinkCard
          href="/dashboard/proveedor"
          title="Portal All Covering"
          badge="proveedor"
          description="Ver cajas vendidas, cajas restantes y deuda consolidada."
        />
      </div>
    </>
  );
}

function ControladorDashboard() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Operaciones de auditoría y movimientos de stock
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <LinkCard
          href="/dashboard/auditorias"
          title="Auditorías"
          badge="control"
          description="Realizar conteos físicos y registrar diferencias contra el stock del sistema."
        />
        <LinkCard
          href="/dashboard/traslados"
          title="Movimientos"
          badge="stock"
          tone="success"
          description="Transferir mercadería entre sucursales sin cambiar el stock global."
        />
      </div>
    </>
  );
}

function VendedorDashboard({ branch }: { branch: Branch }) {
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });
  const {
    distributions,
    loading: distributionsLoading,
    error: distributionsError,
  } = useDistribution();
  const { sales, loading: salesLoading, error: salesError } = useSalesHistory({
    sucursal: branch,
  });
  const productsById = useMemo(() => buildProductMap(products), [products]);
  const metrics = useMemo(
    () =>
      calculateDashboardMetrics({
        productsById,
        distributions,
        sales,
        bajas: [],
        audits: [],
        period: "all",
        branch,
      }),
    [branch, distributions, productsById, sales],
  );
  const loading = productsLoading || distributionsLoading || salesLoading;
  const errors = [productsError, distributionsError, salesError].filter(
    (error): error is Error => Boolean(error),
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Sucursal asignada: {BRANCH_LABELS[branch]}
        </p>
      </div>

      <ErrorMessage errors={errors} />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Stock disponible"
          value={
            loading
              ? "..."
              : `${formatNumberAR(metrics.stockDisponible)} cajas`
          }
          hint="Stock vivo actual, no depende del período."
          tone="success"
        />
        <StatCard
          label="Ventas"
          value={loading ? "..." : metrics.ventasCount}
          tone="primary"
        />
        <StatCard
          label="Revenue USD"
          value={loading ? "..." : formatUSD(metrics.revenueUSD)}
          tone="accent"
        />
        <StatCard
          label="Cajas vendidas"
          value={loading ? "..." : formatNumberAR(metrics.cajasVendidas)}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <LinkCard
          href="/dashboard/ventas"
          title="Ventas"
          badge="sucursal"
          description="Registrar ventas de la sucursal asignada."
        />
      </div>
    </>
  );
}

function AdminDashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const { selectedBranch } = useBranchFilter();
  const branchFilter = selectedBranch === "all" ? undefined : selectedBranch;
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });
  const {
    distributions,
    loading: distributionsLoading,
    error: distributionsError,
  } = useDistribution();
  const { sales, loading: salesLoading, error: salesError } =
    useSalesHistory({});
  const { ingresos, loading: ingresosLoading, error: ingresosError } =
    useIngresos();
  const { bajas, loading: bajasLoading, error: bajasError } = useBajas();
  const { traslados, loading: trasladosLoading, error: trasladosError } =
    useTraslados();
  const { audits, loading: auditsLoading, error: auditsError } = useAudits();
  const { byUid: usersByUid, error: usersError } = useUserProfiles();

  const productsById = useMemo(() => buildProductMap(products), [products]);
  const metrics = useMemo(
    () =>
      calculateDashboardMetrics({
        productsById,
        distributions,
        sales,
        bajas,
        audits,
        period,
        branch: branchFilter,
      }),
    [audits, bajas, branchFilter, distributions, period, productsById, sales],
  );
  const branchSummaries = useMemo(
    () =>
      calculateBranchSummaries({
        distributions,
        sales,
        bajas,
        traslados,
        audits,
        period,
      }),
    [audits, bajas, distributions, period, sales, traslados],
  );
  const visibleBranchSummaries = useMemo(
    () =>
      branchFilter
        ? branchSummaries.filter((summary) => summary.branch === branchFilter)
        : branchSummaries,
    [branchFilter, branchSummaries],
  );
  const productStats = useMemo(
    () =>
      calculateProductStats({
        products,
        productsById,
        distributions,
        sales,
        bajas,
        period,
        branch: branchFilter,
      }),
    [bajas, branchFilter, distributions, period, products, productsById, sales],
  );
  const stockAlerts = useMemo(
    () =>
      calculateStockAlerts({
        productsById,
        distributions,
        sales,
        branch: branchFilter,
      }),
    [branchFilter, distributions, productsById, sales],
  );
  const operationalLosses = useMemo(
    () =>
      calculateOperationalLosses({
        productsById,
        bajas,
        period,
        branch: branchFilter,
      }),
    [bajas, branchFilter, period, productsById],
  );
  const auditAlerts = useMemo(
    () => calculateAuditAlerts(audits, { period, branch: branchFilter }),
    [audits, branchFilter, period],
  );
  const recentActivity = useMemo(
    () =>
      calculateRecentActivity({
        productsById,
        sales,
        ingresos,
        bajas,
        traslados,
        audits,
        period,
        branch: branchFilter,
        limit: 10,
      }),
    [
      audits,
      bajas,
      branchFilter,
      ingresos,
      period,
      productsById,
      sales,
      traslados,
    ],
  );
  const loading =
    productsLoading ||
    distributionsLoading ||
    salesLoading ||
    ingresosLoading ||
    bajasLoading ||
    trasladosLoading ||
    auditsLoading;
  const errors = [
    productsError,
    distributionsError,
    salesError,
    ingresosError,
    bajasError,
    trasladosError,
    auditsError,
    usersError,
  ].filter((error): error is Error => Boolean(error));

  const userNameFor = (uid: string) =>
    displayNameForUser(usersByUid[uid], uid);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Resumen operativo y financiero
        </p>
      </div>

      <div className="mt-4">{periodFilter(period, setPeriod)}</div>
      <p className="mt-2 text-xs text-text-muted">
        Sucursal:{" "}
        {branchFilter ? BRANCH_LABELS[branchFilter] : "Todas las sucursales"}.
        El stock es el estado vivo actual.
      </p>
      <ErrorMessage errors={errors} />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Deuda All Covering"
          value={loading ? "..." : formatUSD(metrics.deudaAllCovering)}
          hint="Ventas y bajas de sucursal del periodo"
          tone="accent"
        />
        <StatCard
          label="Utilidad bruta"
          value={loading ? "..." : formatUSD(metrics.utilidadBruta)}
          hint="Revenue USD menos deuda"
          tone="primary"
        />
        <StatCard
          label="Revenue USD"
          value={loading ? "..." : formatUSD(metrics.revenueUSD)}
          tone="accent"
        />
        <StatCard
          label="Stock total (cajas)"
          value={
            loading
              ? "..."
              : `${formatNumberAR(metrics.stockDisponible)} cajas`
          }
          hint="Stock corresponde al estado actual, filtrado por sucursal si corresponde."
          tone="success"
        />
        <StatCard
          label="Cajas vendidas"
          value={loading ? "..." : formatNumberAR(metrics.cajasVendidas)}
          hint={`${formatNumberAR(metrics.ventasCount)} ventas`}
        />
        <StatCard
          label="USD perdido por bajas"
          value={loading ? "..." : formatUSD(metrics.bajasDebtUSD)}
          hint={`${formatNumberAR(metrics.bajaSucursalCajas)} cajas de sucursal`}
          tone={metrics.bajaSucursalCajas > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Diferencias pendientes"
          value={loading ? "..." : metrics.pendingAuditDifferences}
          tone={metrics.pendingAuditDifferences > 0 ? "danger" : "success"}
        />
      </div>

      <BranchPerformanceTable rows={visibleBranchSummaries} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ProductPerformanceTable rows={productStats} />
        <StockAlertsCard rows={stockAlerts} />
      </div>

      <OperationalLossTable rows={operationalLosses} />
      <AuditAlertsTable rows={auditAlerts} productsById={productsById} />
      <RecentActivityTable rows={recentActivity} userNameFor={userNameFor} />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <LinkCard
          href="/dashboard/ventas"
          title="Ventas"
          badge="operación"
          description="Registrar ventas y descontar stock vivo."
        />
        <LinkCard
          href="/dashboard/ingresos"
          title="Ingresos"
          badge="stock"
          tone="success"
          description="Cargar mercadería recibida por sucursal."
        />
        <LinkCard
          href="/dashboard/bajas"
          title="Bajas"
          badge="stock"
          tone="warning"
          description="Registrar salidas no vinculadas a ventas."
        />
        <LinkCard
          href="/dashboard/traslados"
          title="Movimientos"
          badge="stock"
          tone="success"
          description="Mover mercadería entre sucursales."
        />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { role, loading, profileLoading, profile } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        Cargando...
      </div>
    );
  }

  if (role === "allcovering") {
    return <ProviderDashboard />;
  }

  if (role === "controlador") {
    return <ControladorDashboard />;
  }

  if (role === "vendedor") {
    if (!profile?.sucursalAsignada) {
      return (
        <Card>
          <p className="text-sm text-text-secondary">
            Tu usuario no tiene una sucursal asignada. El dashboard muestra un
            estado vacío hasta que se configure tu perfil.
          </p>
        </Card>
      );
    }

    return <VendedorDashboard branch={profile.sucursalAsignada} />;
  }

  if (role === "admin") {
    return <AdminDashboard />;
  }

  return (
    <Card>
      <p className="text-sm text-text-secondary">
        No hay un perfil activo para mostrar el dashboard.
      </p>
    </Card>
  );
}
