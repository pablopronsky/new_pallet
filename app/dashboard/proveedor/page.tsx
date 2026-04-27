"use client";

import { useMemo, useState, type FormEvent } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useBajas } from "@/hooks/useBajas";
import { useGenerateProviderSnapshot } from "@/hooks/useGenerateProviderSnapshot";
import { useLiquidacionesProveedor } from "@/hooks/useLiquidacionesProveedor";
import { useProducts } from "@/hooks/useProducts";
import { useProviderSnapshot } from "@/hooks/useProviderSnapshot";
import { useSalesHistory } from "@/hooks/useSalesHistory";
import {
  displayNameForUser,
  useUserProfiles,
} from "@/hooks/useUserProfiles";
import {
  BUDGET_PRODUCT_LABEL,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/constants";
import { getErrorMessage, logError } from "@/lib/errors";
import {
  formatDateAR,
  formatNumberAR,
  formatPercent,
  formatUSD,
} from "@/lib/formatters";
import {
  calculateProviderDebtSummary,
  type ProviderDebtSummary,
} from "@/lib/provider";
import type {
  LiquidacionProveedor,
  ProviderSnapshot,
  UserProfile,
} from "@/types/domain";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

function timestampToMillis(value: ProviderSnapshot["updatedAt"]): number | null {
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

function formatNullablePercent(value: number | null): string {
  return value === null ? "-" : formatPercent(value);
}

function formatNullableBoxes(value: number | null): string {
  return value === null ? "-" : `${formatNumberAR(value)} cajas`;
}

function userNameFor(
  uid: string,
  usersByUid: Record<string, UserProfile>,
): string {
  return displayNameForUser(usersByUid[uid], uid);
}

function ProviderSummaryCards({
  summary,
  loading,
  lastSnapshotUpdated,
}: {
  summary: ProviderDebtSummary;
  loading: boolean;
  lastSnapshotUpdated?: number | null;
}) {
  const saldoAFavor = summary.saldoPendienteUSD < 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Deuda generada USD"
        value={loading ? "..." : formatUSD(summary.deudaGeneradaUSD)}
        hint="Ventas y bajas de sucursal"
        tone="accent"
      />
      <StatCard
        label="Liquidado USD"
        value={loading ? "..." : formatUSD(summary.liquidadoUSD)}
        tone="primary"
      />
      <StatCard
        label={saldoAFavor ? "Saldo a favor USD" : "Saldo pendiente USD"}
        value={loading ? "..." : formatUSD(summary.saldoPendienteUSD)}
        hint="Deuda generada menos liquidaciones"
        tone={saldoAFavor ? "success" : "danger"}
      />
      <StatCard
        label="Cobertura liquidación"
        value={loading ? "..." : formatNullablePercent(summary.porcentajeLiquidado)}
        hint="Liquidado / deuda generada"
      />
      <StatCard
        label="Cajas vendidas"
        value={loading ? "..." : `${formatNumberAR(summary.cajasVendidas)} cajas`}
      />
      <StatCard
        label="Cajas restantes"
        value={
          loading
            ? "..."
            : summary.cajasRestantes === undefined
              ? "-"
              : `${formatNumberAR(summary.cajasRestantes)} cajas`
        }
      />
      <StatCard
        label="Cajas equivalentes aprox."
        value={
          loading
            ? "..."
            : formatNullableBoxes(summary.cajasEquivalentesLiquidadas)
        }
        hint="Aprox. por cobertura USD"
      />
      <StatCard
        label="Última liquidación"
        value={
          loading
            ? "..."
            : summary.ultimaLiquidacion
              ? formatDateAR(summary.ultimaLiquidacion.fecha.toDate())
              : "-"
        }
      />
      {lastSnapshotUpdated !== undefined && (
        <StatCard
          label="Última actualización"
          value={loading ? "..." : formatLastUpdated(lastSnapshotUpdated)}
          hint="Resumen proveedor"
        />
      )}
    </div>
  );
}

function ProviderTable({ snapshots }: { snapshots: ProviderSnapshot[] }) {
  const columns = useMemo<SimpleColumn<ProviderSnapshot>[]>(
    () => [
      {
        key: "producto",
        header: "Producto",
        render: (row) => (
          <span className="font-medium text-text-primary">{row.nombre}</span>
        ),
      },
      {
        key: "categoria",
        header: "Tipo/categoria",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{PRODUCT_CATEGORY_LABELS[row.categoria]}</Badge>
            {row.esBudget && (
              <Badge tone="warning">{BUDGET_PRODUCT_LABEL}</Badge>
            )}
          </div>
        ),
      },
      {
        key: "vendidas",
        header: "Cajas vendidas",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">
            {formatNumberAR(row.cajasVendidas)}
          </span>
        ),
      },
      {
        key: "restantes",
        header: "Cajas restantes",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">
            {formatNumberAR(row.cajasRestantes)}
          </span>
        ),
      },
      {
        key: "deuda",
        header: "Deuda USD",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">{formatUSD(row.deudaUSD)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <SimpleTable<ProviderSnapshot>
      columns={columns}
      rows={snapshots}
      rowKey={(row) => row.productId}
      empty={"No hay resumen proveedor generado todavía."}
    />
  );
}

function LiquidacionesTable({
  liquidaciones,
  showCreatedBy,
  usersByUid = {},
}: {
  liquidaciones: LiquidacionProveedor[];
  showCreatedBy: boolean;
  usersByUid?: Record<string, UserProfile>;
}) {
  const columns = useMemo<SimpleColumn<LiquidacionProveedor>[]>(
    () => [
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
        key: "montoUSD",
        header: "Monto USD",
        className: "text-right",
        render: (row) => (
          <span className="tabular-nums">{formatUSD(row.montoUSD)}</span>
        ),
      },
      ...(showCreatedBy
        ? [
            {
              key: "createdBy",
              header: "Creado por",
              render: (row: LiquidacionProveedor) => (
                <span className="text-xs text-text-secondary">
                  {userNameFor(row.createdBy, usersByUid)}
                </span>
              ),
            } satisfies SimpleColumn<LiquidacionProveedor>,
          ]
        : []),
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
    ],
    [showCreatedBy, usersByUid],
  );

  return (
    <SimpleTable<LiquidacionProveedor>
      columns={columns}
      rows={liquidaciones}
      rowKey={(row) => row.id}
      empty="Sin liquidaciones registradas"
    />
  );
}

function LiquidacionForm({
  onSubmit,
  submitting,
}: {
  onSubmit: (input: {
    fecha: Date;
    montoUSD: number;
    notas?: string;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [fecha, setFecha] = useState(todayInputValue());
  const [montoUSD, setMontoUSD] = useState("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await onSubmit({
        fecha: dateFromInput(fecha),
        montoUSD: Number(montoUSD),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      });
      setFecha(todayInputValue());
      setMontoUSD("");
      setNotas("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logError("registrar liquidación", err);
      setError(getErrorMessage(err, "No se pudo registrar la liquidación."));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Fecha"
          name="fecha"
          type="date"
          value={fecha}
          onChange={(event) => setFecha(event.target.value)}
          disabled={submitting}
          required
        />
        <Input
          label="Monto USD"
          name="montoUSD"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={montoUSD}
          onChange={(event) => setMontoUSD(event.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="notas" className="text-xs font-medium text-text-secondary">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          value={notas}
          onChange={(event) => setNotas(event.target.value)}
          disabled={submitting}
          className="min-h-24 w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 sm:text-sm"
          placeholder="Opcional"
        />
      </div>
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-secondary">
        Registrar una liquidación baja el saldo pendiente con All Covering. No
        modifica stock, ventas ni bajas.
      </p>
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          Liquidación registrada correctamente.
        </p>
      )}
      <div>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Registrando..." : "Registrar liquidación"}
        </Button>
      </div>
    </form>
  );
}

function AdminProviderContent() {
  const { snapshots, loading: snapshotsLoading, error: snapshotsError } =
    useProviderSnapshot();
  const { products, loading: productsLoading, error: productsError } =
    useProducts({ activeOnly: false });
  const { sales, loading: salesLoading, error: salesError } =
    useSalesHistory({});
  const { bajas, loading: bajasLoading, error: bajasError } = useBajas();
  const {
    liquidaciones,
    loading: liquidacionesLoading,
    error: liquidacionesError,
    createLiquidacion,
    submitting,
  } = useLiquidacionesProveedor();
  const {
    generateProviderSnapshot,
    generating,
    error: generateError,
  } = useGenerateProviderSnapshot();
  const { byUid: usersByUid, error: usersError } = useUserProfiles();
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  const summary = useMemo(
    () =>
      calculateProviderDebtSummary({
        products,
        ventas: sales,
        bajas,
        liquidaciones,
        proveedorResumen: snapshots,
      }),
    [bajas, liquidaciones, products, sales, snapshots],
  );
  const lastUpdated = useMemo(
    () =>
      latestMillis(
        snapshots.map((snapshot) => timestampToMillis(snapshot.updatedAt)),
      ),
    [snapshots],
  );
  const loading =
    snapshotsLoading ||
    productsLoading ||
    salesLoading ||
    bajasLoading ||
    liquidacionesLoading;
  const errors = [
    snapshotsError,
    productsError,
    salesError,
    bajasError,
    liquidacionesError,
    usersError,
  ].filter((error): error is Error => Boolean(error));

  async function handleGenerateSnapshot() {
    setSnapshotSuccess(false);
    try {
      await generateProviderSnapshot();
      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 3000);
    } catch (err) {
      logError("actualizar resumen proveedor", err);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resumen proveedor</CardTitle>
          <Button
            onClick={handleGenerateSnapshot}
            disabled={generating}
            size="sm"
          >
            {generating ? "Actualizando..." : "Actualizar resumen proveedor"}
          </Button>
        </CardHeader>
        <div className="space-y-2 text-sm text-text-secondary">
          {snapshots.length === 0 && !snapshotsLoading && (
            <p>
              No hay resumen proveedor generado todavía. Hace click en
              actualizar resumen proveedor.
            </p>
          )}
          {snapshotSuccess && (
            <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              Resumen proveedor actualizado.
            </p>
          )}
          {generateError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {getErrorMessage(
                generateError,
                "No se pudo actualizar el resumen proveedor.",
              )}
            </p>
          )}
        </div>
      </Card>

      {errors.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {errors.map((error, index) => (
            <p
              key={`${getErrorMessage(error)}:${index}`}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {getErrorMessage(error, "No se pudo cargar el portal proveedor.")}
            </p>
          ))}
        </div>
      )}

      <ProviderSummaryCards
        summary={summary}
        loading={loading}
        lastSnapshotUpdated={lastUpdated}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Liquidaciones a All Covering</CardTitle>
        </CardHeader>
        <LiquidacionForm
          onSubmit={createLiquidacion}
          submitting={submitting}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Historial de liquidaciones</CardTitle>
          {liquidacionesLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>
        <LiquidacionesTable
          liquidaciones={liquidaciones}
          showCreatedBy
          usersByUid={usersByUid}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resumen por producto</CardTitle>
          {snapshotsLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>

        {!snapshotsLoading && snapshots.length === 0 && (
          <p className="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
            No hay resumen proveedor generado todavía. Hace click en actualizar
            resumen proveedor.
          </p>
        )}

        <ProviderTable snapshots={snapshots} />
      </Card>
    </>
  );
}

function AllCoveringProviderContent() {
  const { snapshots, loading: snapshotsLoading, error: snapshotsError } =
    useProviderSnapshot();
  const {
    liquidaciones,
    loading: liquidacionesLoading,
    error: liquidacionesError,
  } = useLiquidacionesProveedor();

  const summary = useMemo(
    () =>
      calculateProviderDebtSummary({
        liquidaciones,
        proveedorResumen: snapshots,
      }),
    [liquidaciones, snapshots],
  );
  const lastUpdated = useMemo(
    () =>
      latestMillis(
        snapshots.map((snapshot) => timestampToMillis(snapshot.updatedAt)),
      ),
    [snapshots],
  );
  const loading = snapshotsLoading || liquidacionesLoading;
  const errors = [snapshotsError, liquidacionesError].filter(
    (error): error is Error => Boolean(error),
  );

  return (
    <>
      {errors.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {errors.map((error, index) => (
            <p
              key={`${getErrorMessage(error)}:${index}`}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {getErrorMessage(error, "No se pudo cargar el resumen proveedor.")}
            </p>
          ))}
        </div>
      )}

      <ProviderSummaryCards
        summary={summary}
        loading={loading}
        lastSnapshotUpdated={lastUpdated}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Liquidaciones registradas</CardTitle>
          {liquidacionesLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>
        <LiquidacionesTable
          liquidaciones={liquidaciones}
          showCreatedBy={false}
        />
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resumen por producto</CardTitle>
          {snapshotsLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>
        <ProviderTable snapshots={snapshots} />
      </Card>
    </>
  );
}

function ProviderContent() {
  const { role } = useAuth();
  if (role === "admin") return <AdminProviderContent />;
  return <AllCoveringProviderContent />;
}

export default function ProveedorPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Portal All Covering
        </h1>
        <p className="text-sm text-text-secondary">
          Vista consolidada de cajas vendidas, stock restante, deuda y
          liquidaciones.
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
