"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAudits } from "@/hooks/useAudits";
import { useBajas } from "@/hooks/useBajas";
import { useDistribution } from "@/hooks/useDistribution";
import { useIngresos } from "@/hooks/useIngresos";
import { useProducts } from "@/hooks/useProducts";
import { useProviderSnapshot } from "@/hooks/useProviderSnapshot";
import { useSalesHistory } from "@/hooks/useSalesHistory";
import { useTraslados } from "@/hooks/useTraslados";
import {
  displayNameForUser,
  useUserProfiles,
} from "@/hooks/useUserProfiles";
import {
  BAJA_TIPO_LABELS,
  bajaDebtUSD,
  bajaGeneraDeuda,
  bajaMotivoLabel,
  bajaTipo,
} from "@/lib/bajas";
import {
  BRANCHES,
  BRANCH_LABELS,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/constants";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { getErrorMessage } from "@/lib/errors";
import type {
  Audit,
  AuditItem,
  BajaStock,
  IngresoStock,
  Product,
  ProductDistribution,
  ProviderSnapshot,
  Sale,
  TrasladoStock,
  UserProfile,
} from "@/types/domain";
import type { Timestamp } from "firebase/firestore";

interface DateFilters {
  from: string;
  to: string;
}

interface AuditItemExportRow {
  audit: Audit;
  item: AuditItem;
}

const initialFilters: DateFilters = {
  from: "",
  to: "",
};

function dateFromInput(value: string, endOfDay = false): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function inDateRange(timestamp: Timestamp, filters: DateFilters): boolean {
  const from = dateFromInput(filters.from);
  const to = dateFromInput(filters.to, true);
  const ms = timestamp.toMillis();

  if (from && ms < from.getTime()) return false;
  if (to && ms > to.getTime()) return false;
  return true;
}

function formatDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return "";
  return timestamp.toDate().toISOString().slice(0, 10);
}

function finiteNumber(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function productMap(products: Product[]): Record<string, Product> {
  const map: Record<string, Product> = {};
  for (const product of products) map[product.id] = product;
  return map;
}

function productName(productId: string, productsById: Record<string, Product>): string {
  return productsById[productId]?.nombre ?? productId;
}

function userName(
  uid: string,
  usersByUid: Record<string, UserProfile>,
): string {
  return displayNameForUser(usersByUid[uid], uid);
}

function totalBoxes(distribution: ProductDistribution): number {
  return BRANCHES.reduce(
    (total, branch) => total + (distribution.cajasPorSucursal[branch] ?? 0),
    0,
  );
}

function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  downloadCsv(filename, toCsv(rows, columns));
}

function ExportCard({
  title,
  description,
  count,
  onExport,
  disabled,
}: {
  title: string;
  description: string;
  count: number;
  onExport: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="flex h-full flex-col justify-between gap-4">
      <div>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <Badge tone="neutral">{count}</Badge>
        </CardHeader>
        <p className="text-sm text-text-secondary">{description}</p>
      </div>
      <Button type="button" onClick={onExport} disabled={disabled}>
        {title}
      </Button>
    </Card>
  );
}

function ExportarContent() {
  const [filters, setFilters] = useState<DateFilters>(initialFilters);
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });
  const { distributions, loading: distributionLoading, error: distributionError } =
    useDistribution();
  const { sales, loading: salesLoading, error: salesError } =
    useSalesHistory({});
  const { ingresos, loading: ingresosLoading, error: ingresosError } =
    useIngresos();
  const { bajas, loading: bajasLoading, error: bajasError } = useBajas();
  const { traslados, loading: trasladosLoading, error: trasladosError } =
    useTraslados();
  const { audits, loading: auditsLoading, error: auditsError } = useAudits();
  const { snapshots, loading: snapshotsLoading, error: snapshotsError } =
    useProviderSnapshot();
  const {
    byUid: usersByUid,
    loading: usersLoading,
    error: usersError,
  } = useUserProfiles();

  const productsById = useMemo(() => productMap(products), [products]);

  const filteredSales = useMemo(
    () => sales.filter((sale) => inDateRange(sale.fecha, filters)),
    [filters, sales],
  );
  const filteredIngresos = useMemo(
    () => ingresos.filter((ingreso) => inDateRange(ingreso.fecha, filters)),
    [filters, ingresos],
  );
  const filteredBajas = useMemo(
    () => bajas.filter((baja) => inDateRange(baja.fecha, filters)),
    [bajas, filters],
  );
  const filteredTraslados = useMemo(
    () => traslados.filter((traslado) => inDateRange(traslado.fecha, filters)),
    [filters, traslados],
  );
  const filteredAudits = useMemo(
    () => audits.filter((audit) => inDateRange(audit.fecha, filters)),
    [audits, filters],
  );
  const auditItemRows = useMemo(
    () =>
      filteredAudits.flatMap((audit) =>
        audit.items.map((item) => ({ audit, item })),
      ),
    [filteredAudits],
  );

  const errors = [
    productsError,
    distributionError,
    salesError,
    ingresosError,
    bajasError,
    trasladosError,
    auditsError,
    snapshotsError,
    usersError,
  ].filter((error): error is Error => Boolean(error));

  const loading =
    productsLoading ||
    distributionLoading ||
    salesLoading ||
    ingresosLoading ||
    bajasLoading ||
    trasladosLoading ||
    auditsLoading ||
    snapshotsLoading ||
    usersLoading;

  const update = <K extends keyof DateFilters>(
    key: K,
    value: DateFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const saleColumns: CsvColumn<Sale>[] = [
    { header: "fecha", value: (row) => formatDate(row.fecha) },
    {
      header: "producto",
      value: (row) => productName(row.productId, productsById),
    },
    { header: "sucursal", value: (row) => BRANCH_LABELS[row.sucursal] },
    { header: "cajas", value: (row) => finiteNumber(row.cajas) },
    { header: "montoUSD", value: (row) => finiteNumber(row.montoUSD) },
    { header: "montoARS", value: (row) => finiteNumber(row.montoARS) },
    {
      header: "tipoCambioUSD",
      value: (row) => finiteNumber(row.tipoCambioUSD),
    },
    { header: "createdBy", value: (row) => userName(row.createdBy, usersByUid) },
    { header: "notas", value: (row) => row.notas },
  ];

  const ingresoColumns: CsvColumn<IngresoStock>[] = [
    { header: "fecha", value: (row) => formatDate(row.fecha) },
    {
      header: "producto",
      value: (row) => productName(row.productId, productsById),
    },
    { header: "sucursal", value: (row) => BRANCH_LABELS[row.sucursal] },
    { header: "cajas", value: (row) => finiteNumber(row.cajas) },
    {
      header: "costoUSDPorCaja",
      value: (row) => finiteNumber(row.costoUSDPorCaja),
    },
    {
      header: "costoTotalUSD",
      value: (row) => finiteNumber(row.costoTotalUSD),
    },
    { header: "createdBy", value: (row) => userName(row.createdBy, usersByUid) },
    { header: "notas", value: (row) => row.notas },
  ];

  const bajaColumns: CsvColumn<BajaStock>[] = [
    { header: "fecha", value: (row) => formatDate(row.fecha) },
    {
      header: "producto",
      value: (row) => productName(row.productId, productsById),
    },
    { header: "sucursal", value: (row) => BRANCH_LABELS[row.sucursal] },
    { header: "cajas", value: (row) => finiteNumber(row.cajas) },
    { header: "tipo", value: (row) => BAJA_TIPO_LABELS[bajaTipo(row)] },
    { header: "motivo", value: (row) => bajaMotivoLabel(row) },
    { header: "generaDeuda", value: (row) => bajaGeneraDeuda(row) },
    {
      header: "costoUSDPorCaja",
      value: (row) => finiteNumber(row.costoUSDPorCaja),
    },
    {
      header: "deudaUSD",
      value: (row) => bajaDebtUSD(row, productsById[row.productId]),
    },
    { header: "createdBy", value: (row) => userName(row.createdBy, usersByUid) },
    { header: "notas", value: (row) => row.notas },
  ];

  const trasladoColumns: CsvColumn<TrasladoStock>[] = [
    { header: "fecha", value: (row) => formatDate(row.fecha) },
    {
      header: "producto",
      value: (row) => productName(row.productId, productsById),
    },
    {
      header: "sucursalOrigen",
      value: (row) => BRANCH_LABELS[row.sucursalOrigen],
    },
    {
      header: "sucursalDestino",
      value: (row) => BRANCH_LABELS[row.sucursalDestino],
    },
    { header: "cajas", value: (row) => finiteNumber(row.cajas) },
    { header: "createdBy", value: (row) => userName(row.createdBy, usersByUid) },
    { header: "notas", value: (row) => row.notas },
  ];

  const auditSummaryColumns: CsvColumn<Audit>[] = [
    { header: "fecha", value: (row) => formatDate(row.fecha) },
    { header: "createdBy", value: (row) => userName(row.createdBy, usersByUid) },
    { header: "cantidadItems", value: (row) => row.items.length },
    {
      header: "cantidadDiferencias",
      value: (row) => row.items.filter((item) => item.diferencia !== 0).length,
    },
    { header: "resuelta", value: (row) => Boolean(row.resuelta) },
    { header: "cerrada", value: (row) => Boolean(row.cerrada) },
    { header: "notas", value: (row) => row.notas },
  ];

  const auditItemColumns: CsvColumn<AuditItemExportRow>[] = [
    { header: "fecha", value: (row) => formatDate(row.audit.fecha) },
    { header: "auditId", value: (row) => row.audit.id },
    {
      header: "producto",
      value: (row) => productName(row.item.productId, productsById),
    },
    { header: "sucursal", value: (row) => BRANCH_LABELS[row.item.sucursal] },
    { header: "cajasSistema", value: (row) => finiteNumber(row.item.cajasSistema) },
    {
      header: "cajasContadas",
      value: (row) => finiteNumber(row.item.cajasContadas),
    },
    { header: "diferencia", value: (row) => finiteNumber(row.item.diferencia) },
    { header: "notas", value: (row) => row.item.notas },
  ];

  const stockColumns: CsvColumn<ProductDistribution>[] = [
    {
      header: "producto",
      value: (row) => productName(row.productId, productsById),
    },
    {
      header: "categoria",
      value: (row) => {
        const category = productsById[row.productId]?.categoria;
        return category ? PRODUCT_CATEGORY_LABELS[category] : "";
      },
    },
    {
      header: "costoUSD",
      value: (row) => finiteNumber(productsById[row.productId]?.costoUSD),
    },
    {
      header: "precioVentaUSD",
      value: (row) => finiteNumber(productsById[row.productId]?.precioVentaUSD),
    },
    { header: "gonnet", value: (row) => row.cajasPorSucursal.gonnet ?? "" },
    { header: "laplata", value: (row) => row.cajasPorSucursal.laplata ?? "" },
    { header: "quilmes", value: (row) => row.cajasPorSucursal.quilmes ?? "" },
    { header: "totalCajas", value: (row) => totalBoxes(row) },
  ];

  const providerColumns: CsvColumn<ProviderSnapshot>[] = [
    { header: "producto", value: (row) => row.nombre },
    {
      header: "categoria",
      value: (row) => PRODUCT_CATEGORY_LABELS[row.categoria],
    },
    { header: "cajasVendidas", value: (row) => finiteNumber(row.cajasVendidas) },
    { header: "cajasRestantes", value: (row) => finiteNumber(row.cajasRestantes) },
    { header: "deudaUSD", value: (row) => finiteNumber(row.deudaUSD) },
    { header: "updatedAt", value: (row) => formatDate(row.updatedAt) },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Filtros de fecha</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters(initialFilters)}
          >
            Limpiar
          </Button>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Desde"
            name="from"
            type="date"
            value={filters.from}
            onChange={(event) => update("from", event.target.value)}
            hint="Aplica a ventas, ingresos, bajas, movimientos y auditorías."
          />
          <Input
            label="Hasta"
            name="to"
            type="date"
            value={filters.to}
            onChange={(event) => update("to", event.target.value)}
          />
        </div>
      </Card>

      {errors.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {errors.map((error, index) => (
            <p
              key={`${getErrorMessage(error)}:${index}`}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {getErrorMessage(error, "No se pudieron cargar los datos para exportar.")}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ExportCard
          title="Exportar ventas"
          description="Ventas con importes USD/ARS y tipo de cambio."
          count={filteredSales.length}
          disabled={loading}
          onExport={() => exportCsv("ventas.csv", filteredSales, saleColumns)}
        />
        <ExportCard
          title="Exportar ingresos"
          description="Ingresos de mercadería con costos en USD."
          count={filteredIngresos.length}
          disabled={loading}
          onExport={() =>
            exportCsv("ingresos.csv", filteredIngresos, ingresoColumns)
          }
        />
        <ExportCard
          title="Exportar bajas"
          description="Bajas, devoluciones y deuda generada cuando aplica."
          count={filteredBajas.length}
          disabled={loading}
          onExport={() => exportCsv("bajas.csv", filteredBajas, bajaColumns)}
        />
        <ExportCard
          title="Exportar movimientos"
          description="Movimientos entre sucursales."
          count={filteredTraslados.length}
          disabled={loading}
          onExport={() =>
            exportCsv("movimientos.csv", filteredTraslados, trasladoColumns)
          }
        />
        <ExportCard
          title="Exportar auditorías resumen"
          description="Resumen por auditoría."
          count={filteredAudits.length}
          disabled={loading}
          onExport={() =>
            exportCsv(
              "auditorias_resumen.csv",
              filteredAudits,
              auditSummaryColumns,
            )
          }
        />
        <ExportCard
          title="Exportar auditorías detalle"
          description="Detalle de ítems auditados."
          count={auditItemRows.length}
          disabled={loading}
          onExport={() =>
            exportCsv("auditorias_items.csv", auditItemRows, auditItemColumns)
          }
        />
        <ExportCard
          title="Exportar stock actual"
          description="Stock vivo por producto y sucursal."
          count={distributions.length}
          disabled={loading}
          onExport={() =>
            exportCsv("stock_actual.csv", distributions, stockColumns)
          }
        />
        <ExportCard
          title="Exportar proveedor"
          description="Resumen proveedor All Covering."
          count={snapshots.length}
          disabled={loading}
          onExport={() =>
            exportCsv("proveedor_all_covering.csv", snapshots, providerColumns)
          }
        />
      </div>
    </>
  );
}

export default function ExportarPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exportar</h1>
        <p className="text-sm text-text-secondary">
          Descarga de información operativa y financiera
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin"]}>
          <ExportarContent />
        </RoleGuard>
      </div>
    </>
  );
}
