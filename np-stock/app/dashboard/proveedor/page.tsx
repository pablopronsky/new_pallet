"use client";

import { useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useGenerateProviderSnapshot } from "@/hooks/useGenerateProviderSnapshot";
import { useProviderSnapshot } from "@/hooks/useProviderSnapshot";
import { formatNumberAR, formatUSD } from "@/lib/formatters";
import type { ProviderSnapshot } from "@/types/domain";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

function ProviderTable({ snapshots }: { snapshots: ProviderSnapshot[] }) {
  const columns = useMemo<SimpleColumn<ProviderSnapshot>[]>(
    () => [
      {
        key: "producto",
        header: "Producto",
        render: (row) => (
          <span className="font-medium text-text-primary">
            {row.nombre}
          </span>
        ),
      },
      {
        key: "categoria",
        header: "Tipo/categoria",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{row.categoria}</Badge>
            {row.esBudget && <Badge tone="warning">Budget</Badge>}
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
      empty={"No hay resumen proveedor generado todav\u00eda."}
    />
  );
}

function ProviderContent() {
  const { role } = useAuth();
  const {
    snapshots,
    loading,
    error,
  } = useProviderSnapshot();
  const {
    generateProviderSnapshot,
    generating,
    error: generateError,
  } = useGenerateProviderSnapshot();
  const [success, setSuccess] = useState<boolean>(false);
  const isAdmin = role === "admin";

  const totals = useMemo(
    () =>
      snapshots.reduce(
        (acc, row) => ({
          deudaUSD: acc.deudaUSD + row.deudaUSD,
          cajasVendidas: acc.cajasVendidas + row.cajasVendidas,
          cajasRestantes: acc.cajasRestantes + row.cajasRestantes,
        }),
        { deudaUSD: 0, cajasVendidas: 0, cajasRestantes: 0 },
      ),
    [snapshots],
  );

  const lastUpdated = useMemo(() => {
    return latestMillis(
      snapshots.map((snapshot) => timestampToMillis(snapshot.updatedAt)),
    );
  }, [snapshots]);

  async function handleGenerateSnapshot() {
    setSuccess(false);
    try {
      await generateProviderSnapshot();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // The hook exposes the error for rendering.
    }
  }

  return (
    <>
      {isAdmin && (
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
            {snapshots.length === 0 && !loading && (
              <p>
                {"No hay resumen proveedor generado todav\u00eda. Hace click en actualizar resumen proveedor."}
              </p>
            )}
            {success && (
              <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                Resumen proveedor actualizado.
              </p>
            )}
            {generateError && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {generateError.message}
              </p>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Deuda total USD"
          value={loading ? "..." : formatUSD(totals.deudaUSD)}
          hint="Cajas vendidas por costo"
          tone="accent"
        />
        <StatCard
          label="Cajas vendidas"
          value={
            loading ? "..." : `${formatNumberAR(totals.cajasVendidas)} cajas`
          }
          tone="primary"
        />
        <StatCard
          label="Cajas restantes"
          value={
            loading ? "..." : `${formatNumberAR(totals.cajasRestantes)} cajas`
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

        {!loading && snapshots.length === 0 && isAdmin && (
          <p className="mb-4 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
            {"No hay resumen proveedor generado todav\u00eda. Hace click en actualizar resumen proveedor."}
          </p>
        )}

        <ProviderTable snapshots={snapshots} />
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
