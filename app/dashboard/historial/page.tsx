"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useAudits } from "@/hooks/useAudits";
import { useAuth } from "@/hooks/useAuth";
import { useBajas } from "@/hooks/useBajas";
import { useIngresos } from "@/hooks/useIngresos";
import { useProducts } from "@/hooks/useProducts";
import { useSalesHistory } from "@/hooks/useSalesHistory";
import { useTraslados } from "@/hooks/useTraslados";
import {
  displayNameForUser,
  useUserProfiles,
} from "@/hooks/useUserProfiles";
import {
  BAJA_TIPO_LABELS,
  bajaDebtUSD,
  bajaMotivoLabel,
  bajaTipo,
} from "@/lib/bajas";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatDateAR, formatUSD } from "@/lib/formatters";
import type {
  Audit,
  AuditItem,
  BajaStock,
  Branch,
  IngresoStock,
  Product,
  Sale,
  TrasladoStock,
  UserProfile,
} from "@/types/domain";
import type { Timestamp } from "firebase/firestore";

type HistorialTipo =
  | "venta"
  | "ingreso"
  | "baja"
  | "movimiento"
  | "auditoria";

type TipoFilter = "" | HistorialTipo;

interface FiltersState {
  tipo: TipoFilter;
  productId: string;
  sucursal: string;
  from: string;
  to: string;
}

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface HistorialRow {
  id: string;
  tipo: HistorialTipo;
  fecha: Timestamp;
  productId?: string;
  producto?: string;
  detalle?: string;
  sucursal?: Branch;
  sucursalOrigen?: Branch;
  sucursalDestino?: Branch;
  cajas?: number;
  montoUSD?: number;
  costoTotalUSD?: number;
  createdBy: string;
  notas?: string;
  auditItems?: AuditItem[];
}

const initialFilters: FiltersState = {
  tipo: "",
  productId: "",
  sucursal: "",
  from: "",
  to: "",
};

const tipoOptions = [
  { value: "", label: "Todos" },
  { value: "venta", label: "Ventas" },
  { value: "ingreso", label: "Ingresos" },
  { value: "baja", label: "Bajas" },
  { value: "movimiento", label: "Movimientos" },
  { value: "auditoria", label: "Auditorías" },
];

const tipoLabels: Record<HistorialTipo, string> = {
  venta: "Venta",
  ingreso: "Ingreso",
  baja: "Baja",
  movimiento: "Movimiento",
  auditoria: "Auditoría",
};

const tipoTones: Record<HistorialTipo, BadgeTone> = {
  venta: "primary",
  ingreso: "success",
  baja: "error",
  movimiento: "warning",
  auditoria: "neutral",
};

function parseDateRange(filters: FiltersState): DateRange {
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;

  if (to && !Number.isNaN(to.getTime())) {
    to.setHours(23, 59, 59, 999);
  }

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function productNameMap(products: Product[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const product of products) map[product.id] = product.nombre;
  return map;
}

function productMap(products: Product[]): Record<string, Product> {
  const map: Record<string, Product> = {};
  for (const product of products) map[product.id] = product;
  return map;
}

function auditDifferenceCount(audit: Audit): number {
  return (audit.items ?? []).filter((item) => item.diferencia !== 0).length;
}

function rowMatchesFilters(row: HistorialRow, filters: FiltersState): boolean {
  if (filters.tipo && row.tipo !== filters.tipo) return false;

  if (filters.productId) {
    const auditHasProduct = row.auditItems?.some(
      (item) => item.productId === filters.productId,
    );
    if (row.productId !== filters.productId && !auditHasProduct) return false;
  }

  if (filters.sucursal) {
    const selected = filters.sucursal as Branch;
    const auditHasBranch = row.auditItems?.some(
      (item) => item.sucursal === selected,
    );
    const matchesBranch =
      row.sucursal === selected ||
      row.sucursalOrigen === selected ||
      row.sucursalDestino === selected ||
      auditHasBranch;

    if (!matchesBranch) return false;
  }

  const { from, to } = parseDateRange(filters);
  const rowMs = row.fecha.toMillis();
  if (from && rowMs < from.getTime()) return false;
  if (to && rowMs > to.getTime()) return false;

  return true;
}

function saleToRow(sale: Sale, productNames: Record<string, string>): HistorialRow {
  return {
    id: sale.id,
    tipo: "venta",
    fecha: sale.fecha,
    productId: sale.productId,
    producto: productNames[sale.productId] ?? sale.productId,
    sucursal: sale.sucursal,
    cajas: sale.cajas,
    montoUSD: isFiniteNumber(sale.montoUSD) ? sale.montoUSD : undefined,
    createdBy: sale.createdBy,
    notas: sale.notas,
  };
}

function ingresoToRow(
  ingreso: IngresoStock,
  productNames: Record<string, string>,
): HistorialRow {
  return {
    id: ingreso.id,
    tipo: "ingreso",
    fecha: ingreso.fecha,
    productId: ingreso.productId,
    producto: productNames[ingreso.productId] ?? ingreso.productId,
    sucursal: ingreso.sucursal,
    cajas: ingreso.cajas,
    costoTotalUSD: isFiniteNumber(ingreso.costoTotalUSD)
      ? ingreso.costoTotalUSD
      : undefined,
    createdBy: ingreso.createdBy,
    notas: ingreso.notas,
  };
}

function bajaToRow(
  baja: BajaStock,
  productNames: Record<string, string>,
  productsById: Record<string, Product>,
): HistorialRow {
  const tipo = bajaTipo(baja);
  const motivo = bajaMotivoLabel(baja);

  return {
    id: baja.id,
    tipo: "baja",
    fecha: baja.fecha,
    productId: baja.productId,
    producto: productNames[baja.productId] ?? baja.productId,
    detalle:
      motivo === "-"
        ? BAJA_TIPO_LABELS[tipo]
        : `${BAJA_TIPO_LABELS[tipo]} - ${motivo}`,
    sucursal: baja.sucursal,
    cajas: baja.cajas,
    costoTotalUSD: bajaDebtUSD(baja, productsById[baja.productId]),
    createdBy: baja.createdBy,
    notas: baja.notas,
  };
}

function trasladoToRow(
  traslado: TrasladoStock,
  productNames: Record<string, string>,
): HistorialRow {
  return {
    id: traslado.id,
    tipo: "movimiento",
    fecha: traslado.fecha,
    productId: traslado.productId,
    producto: productNames[traslado.productId] ?? traslado.productId,
    sucursalOrigen: traslado.sucursalOrigen,
    sucursalDestino: traslado.sucursalDestino,
    cajas: traslado.cajas,
    createdBy: traslado.createdBy,
    notas: traslado.notas,
  };
}

function auditToRow(audit: Audit): HistorialRow {
  const items = audit.items ?? [];
  const differences = auditDifferenceCount(audit);

  return {
    id: audit.id,
    tipo: "auditoria",
    fecha: audit.fecha,
    detalle: `Auditoría: ${items.length} ítem(s), ${differences} diferencia(s)`,
    createdBy: audit.createdBy,
    notas: audit.notas,
    auditItems: items,
  };
}

function branchDetail(row: HistorialRow): string {
  if (row.sucursalOrigen && row.sucursalDestino) {
    return `${BRANCH_LABELS[row.sucursalOrigen]} → ${
      BRANCH_LABELS[row.sucursalDestino]
    }`;
  }
  if (row.sucursal) return BRANCH_LABELS[row.sucursal];
  return "-";
}

function amountDetail(row: HistorialRow): string {
  if (isFiniteNumber(row.montoUSD)) return formatUSD(row.montoUSD);
  if (isFiniteNumber(row.costoTotalUSD)) return formatUSD(row.costoTotalUSD);
  return "-";
}

function createdByLabel(
  uid: string,
  usersByUid: Record<string, UserProfile>,
  ownProfile?: UserProfile | null,
): string {
  return displayNameForUser(usersByUid[uid] ?? ownProfile ?? undefined, uid);
}

function buildColumns(
  usersByUid: Record<string, UserProfile>,
  ownProfile?: UserProfile | null,
): SimpleColumn<HistorialRow>[] {
  return [
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
        <Badge tone={tipoTones[row.tipo]}>{tipoLabels[row.tipo]}</Badge>
      ),
    },
    {
      key: "detalle",
      header: "Producto / detalle",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text-primary">
            {row.producto ?? row.detalle ?? "-"}
          </span>
          {row.producto && row.detalle && (
            <span className="text-xs text-text-muted">{row.detalle}</span>
          )}
        </div>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal / origen-destino",
      render: (row) => (
        <span className="text-text-secondary">{branchDetail(row)}</span>
      ),
    },
    {
      key: "cajas",
      header: "Cajas",
      className: "text-right",
      render: (row) =>
        isFiniteNumber(row.cajas) ? (
          <span className="tabular-nums">{row.cajas}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
    {
      key: "importe",
      header: "Importe / costo",
      className: "text-right",
      render: (row) => (
        <span className="tabular-nums text-text-secondary">
          {amountDetail(row)}
        </span>
      ),
    },
    {
      key: "createdBy",
      header: "Creado por",
      render: (row) => (
        <span className="text-xs text-text-secondary">
          {createdByLabel(row.createdBy, usersByUid, ownProfile)}
        </span>
      ),
    },
    {
      key: "notas",
      header: "Notas",
      render: (row) =>
        row.notas ? (
          <span className="text-text-secondary">{row.notas}</span>
        ) : (
          <span className="text-text-muted">-</span>
        ),
    },
  ];
}

function FiltersCard({
  filters,
  onChange,
  onClear,
  productOptions,
  showTipo,
  showSucursal,
  fixedBranch,
  loadingProducts,
}: {
  filters: FiltersState;
  onChange: <K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K],
  ) => void;
  onClear: () => void;
  productOptions: { value: string; label: string }[];
  showTipo: boolean;
  showSucursal: boolean;
  fixedBranch?: Branch;
  loadingProducts: boolean;
}) {
  const sucursalOptions = [
    { value: "", label: "Todas" },
    ...BRANCHES.map((branch) => ({
      value: branch,
      label: BRANCH_LABELS[branch],
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpiar
        </Button>
      </CardHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {showTipo && (
          <Select
            label="Tipo"
            name="tipo"
            value={filters.tipo}
            onChange={(event) =>
              onChange("tipo", event.target.value as TipoFilter)
            }
            options={tipoOptions}
          />
        )}
        <Select
          label="Producto"
          name="productId"
          value={filters.productId}
          onChange={(event) => onChange("productId", event.target.value)}
          options={productOptions}
          disabled={loadingProducts}
        />
        {showSucursal ? (
          <Select
            label="Sucursal"
            name="sucursal"
            value={filters.sucursal}
            onChange={(event) => onChange("sucursal", event.target.value)}
            options={sucursalOptions}
          />
        ) : fixedBranch ? (
          <Input
            label="Sucursal"
            name="fixedBranch"
            value={BRANCH_LABELS[fixedBranch]}
            readOnly
            hint="Solo se muestra el historial de tu sucursal."
          />
        ) : null}
        <Input
          label="Desde"
          name="from"
          type="date"
          value={filters.from}
          onChange={(event) => onChange("from", event.target.value)}
        />
        <Input
          label="Hasta"
          name="to"
          type="date"
          value={filters.to}
          onChange={(event) => onChange("to", event.target.value)}
        />
      </div>
    </Card>
  );
}

function HistoryTable({
  rows,
  loading,
  errors,
  usersByUid,
  ownProfile,
}: {
  rows: HistorialRow[];
  loading: boolean;
  errors: Error[];
  usersByUid: Record<string, UserProfile>;
  ownProfile?: UserProfile | null;
}) {
  const columns = useMemo(
    () => buildColumns(usersByUid, ownProfile),
    [ownProfile, usersByUid],
  );

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          Movimientos{" "}
          <span className="text-sm font-normal text-text-muted">
            ({rows.length})
          </span>
        </CardTitle>
        {loading && <span className="text-xs text-text-muted">Cargando...</span>}
      </CardHeader>

      {errors.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {errors.map((error, index) => (
            <p
              key={`${getErrorMessage(error)}:${index}`}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {getErrorMessage(error, "No se pudieron cargar los movimientos.")}
            </p>
          ))}
        </div>
      )}

      <SimpleTable<HistorialRow>
        columns={columns}
        rows={rows}
        rowKey={(row) => `${row.tipo}:${row.id}`}
        empty={loading ? "Cargando..." : "Sin movimientos registrados"}
      />
    </Card>
  );
}

function AdminHistoryContent() {
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });
  const { sales, loading: salesLoading, error: salesError } =
    useSalesHistory({});
  const { ingresos, loading: ingresosLoading, error: ingresosError } =
    useIngresos();
  const { bajas, loading: bajasLoading, error: bajasError } = useBajas();
  const { traslados, loading: trasladosLoading, error: trasladosError } =
    useTraslados();
  const { audits, loading: auditsLoading, error: auditsError } = useAudits();
  const {
    byUid: usersByUid,
    loading: usersLoading,
    error: usersError,
  } = useUserProfiles();

  const productNames = useMemo(() => productNameMap(products), [products]);
  const productsById = useMemo(() => productMap(products), [products]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      ...products.map((product) => ({
        value: product.id,
        label: product.nombre,
      })),
    ],
    [products],
  );

  const rows = useMemo(() => {
    const allRows: HistorialRow[] = [
      ...sales.map((sale) => saleToRow(sale, productNames)),
      ...ingresos.map((ingreso) => ingresoToRow(ingreso, productNames)),
      ...bajas.map((baja) => bajaToRow(baja, productNames, productsById)),
      ...traslados.map((traslado) => trasladoToRow(traslado, productNames)),
      ...audits.map(auditToRow),
    ];

    return allRows
      .filter((row) => rowMatchesFilters(row, filters))
      .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  }, [
    audits,
    bajas,
    filters,
    ingresos,
    productNames,
    productsById,
    sales,
    traslados,
  ]);

  const update = <K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const errors = [
    productsError,
    salesError,
    ingresosError,
    bajasError,
    trasladosError,
    auditsError,
    usersError,
  ].filter((error): error is Error => Boolean(error));

  const loading =
    productsLoading ||
    salesLoading ||
    ingresosLoading ||
    bajasLoading ||
    trasladosLoading ||
    auditsLoading ||
    usersLoading;

  return (
    <>
      <FiltersCard
        filters={filters}
        onChange={update}
        onClear={() => setFilters(initialFilters)}
        productOptions={productOptions}
        showTipo
        showSucursal
        loadingProducts={productsLoading}
      />
      <HistoryTable
        rows={rows}
        loading={loading}
        errors={errors}
        usersByUid={usersByUid}
      />
    </>
  );
}

function VendedorHistoryContent({ sucursal }: { sucursal: Branch }) {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<FiltersState>({
    ...initialFilters,
    tipo: "venta",
    sucursal,
  });
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });

  const { from, to } = parseDateRange(filters);
  const { sales, loading: salesLoading, error: salesError } = useSalesHistory({
    productId: filters.productId || undefined,
    sucursal,
    from: from ?? undefined,
    to: to ?? undefined,
  });

  const productNames = useMemo(() => productNameMap(products), [products]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      ...products.map((product) => ({
        value: product.id,
        label: product.nombre,
      })),
    ],
    [products],
  );

  const rows = useMemo(
    () =>
      sales
        .map((sale) => saleToRow(sale, productNames))
        .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis()),
    [productNames, sales],
  );

  const update = <K extends keyof FiltersState>(
    key: K,
    value: FiltersState[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value, tipo: "venta", sucursal }));
  };

  const errors = [productsError, salesError].filter(
    (error): error is Error => Boolean(error),
  );

  return (
    <>
      <FiltersCard
        filters={filters}
        onChange={update}
        onClear={() =>
          setFilters({ ...initialFilters, tipo: "venta", sucursal })
        }
        productOptions={productOptions}
        showTipo={false}
        showSucursal={false}
        fixedBranch={sucursal}
        loadingProducts={productsLoading}
      />
      <HistoryTable
        rows={rows}
        loading={productsLoading || salesLoading}
        errors={errors}
        usersByUid={{}}
        ownProfile={profile}
      />
    </>
  );
}

function HistoryContent() {
  const { role, profile } = useAuth();

  if (role === "admin") {
    return <AdminHistoryContent />;
  }

  if (role === "vendedor") {
    if (!profile?.sucursalAsignada) {
      return (
        <Card>
          <p className="text-sm text-text-secondary">
            Tu usuario no tiene una sucursal asignada.
          </p>
        </Card>
      );
    }

    return <VendedorHistoryContent sucursal={profile.sucursalAsignada} />;
  }

  return null;
}

export default function HistorialPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-text-secondary">
          Registro operativo de ventas, ingresos, bajas, movimientos y
          auditorías
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "vendedor"]}>
          <HistoryContent />
        </RoleGuard>
      </div>
    </>
  );
}
