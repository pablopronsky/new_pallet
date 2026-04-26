"use client";

import { useCallback, useMemo, useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SimpleTable, type SimpleColumn } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import {
  useSalesHistory,
  type SalesHistoryFilters,
} from "@/hooks/useSalesHistory";
import { useDeleteSale } from "@/hooks/useDeleteSale";
import {
  useUserProfiles,
  displayNameForUser,
} from "@/hooks/useUserProfiles";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import {
  formatARS,
  formatDateAR,
  formatNumberAR,
  formatUSD,
} from "@/lib/formatters";
import type { Branch, Sale } from "@/types/domain";

interface FiltersState {
  productId: string;
  sucursal: string;
  from: string;
  to: string;
}

const initialFilters: FiltersState = {
  productId: "",
  sucursal: "",
  from: "",
  to: "",
};

function parseFilters(state: FiltersState): SalesHistoryFilters {
  const out: SalesHistoryFilters = {};
  if (state.productId) out.productId = state.productId;
  if (state.sucursal) out.sucursal = state.sucursal as Branch;
  if (state.from) {
    const d = new Date(state.from);
    if (!Number.isNaN(d.getTime())) out.from = d;
  }
  if (state.to) {
    const d = new Date(state.to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      out.to = d;
    }
  }
  return out;
}

function HistoryContent() {
  const { role, profile } = useAuth();
  const isAdmin = role === "admin";
  const vendedorBranch =
    role === "vendedor" ? profile?.sucursalAsignada : undefined;

  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const parsed = useMemo(() => {
    const next = parseFilters(filters);
    if (vendedorBranch) next.sucursal = vendedorBranch;
    return next;
  }, [filters, vendedorBranch]);

  const { products, loading: productsLoading } = useProducts({ activeOnly: false });
  const { sales, loading: salesLoading, error } = useSalesHistory(parsed);
  const { deleteSale, isDeleting } = useDeleteSale();
  const { byUid: usersByUid } = useUserProfiles();

  const productName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of products) map[p.id] = p.nombre;
    return map;
  }, [products]);

  const update = <K extends keyof FiltersState>(key: K, value: FiltersState[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const clearFilters = () => setFilters(initialFilters);

  const onDelete = useCallback(
    async (sale: Sale) => {
      const confirmed = window.confirm(
        `¿Eliminar venta de ${sale.cajas} caja(s) de ${productName[sale.productId] ?? sale.productId}?\n\nEsto restaurará el stock en la sucursal ${BRANCH_LABELS[sale.sucursal]}.`,
      );
      if (!confirmed) return;
      try {
        await deleteSale(sale.id);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Error al eliminar la venta",
        );
      }
    },
    [deleteSale, productName],
  );

  const columns: SimpleColumn<Sale>[] = useMemo(() => {
    const cols: SimpleColumn<Sale>[] = [
      {
        key: "fecha",
        header: "Fecha",
        render: (s) => (
          <span className="tabular-nums text-text-secondary">
            {formatDateAR(s.fecha.toDate())}
          </span>
        ),
      },
      {
        key: "producto",
        header: "Producto",
        render: (s) => (
          <span className="font-medium text-text-primary">
            {productName[s.productId] ?? s.productId}
          </span>
        ),
      },
      {
        key: "sucursal",
        header: "Sucursal",
        render: (s) => <Badge tone="neutral">{BRANCH_LABELS[s.sucursal]}</Badge>,
      },
      {
        key: "cajas",
        header: "Cajas",
        className: "text-right",
        render: (s) => <span className="tabular-nums">{s.cajas}</span>,
      },
      {
        key: "usd",
        header: "USD",
        className: "text-right",
        render: (s) => (
          <span className="tabular-nums">{formatUSD(s.montoUSD)}</span>
        ),
      },
      {
        key: "ars",
        header: "ARS",
        className: "text-right",
        render: (s) => (
          <span className="tabular-nums text-text-secondary">
            {formatARS(s.montoARS)}
          </span>
        ),
      },
      {
        key: "tc",
        header: "TC",
        className: "text-right",
        render: (s) => (
          <span className="tabular-nums text-text-muted">
            {formatNumberAR(s.tipoCambioUSD)}
          </span>
        ),
      },
      {
        key: "createdBy",
        header: "Creado por",
        render: (s) => (
          <span className="text-xs text-text-secondary">
            {displayNameForUser(usersByUid[s.createdBy], s.createdBy)}
          </span>
        ),
      },
    ];

    if (isAdmin) {
      cols.push({
        key: "actions",
        header: "",
        className: "text-right",
        render: (s) => {
          const busy = isDeleting(s.id);
          return (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onDelete(s)}
            >
              {busy ? "Eliminando..." : "Eliminar"}
            </Button>
          );
        },
      });
    }

    return cols;
  }, [isAdmin, productName, usersByUid, isDeleting, onDelete]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "Todos los productos" },
      ...products.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [products],
  );

  const sucursalOptions = useMemo(
    () => [
      { value: "", label: "Todas las sucursales" },
      ...BRANCHES.map((b) => ({ value: b, label: BRANCH_LABELS[b] })),
    ],
    [],
  );

  if (role === "vendedor" && !vendedorBranch) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Tu usuario no tiene una sucursal asignada.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        </CardHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Select
            label="Producto"
            name="productId"
            value={filters.productId}
            onChange={(e) => update("productId", e.target.value)}
            options={productOptions}
            disabled={productsLoading}
          />
          <Select
            label="Sucursal"
            name="sucursal"
            value={vendedorBranch ?? filters.sucursal}
            onChange={(e) => update("sucursal", e.target.value)}
            options={sucursalOptions}
            disabled={Boolean(vendedorBranch)}
            hint={
              vendedorBranch
                ? "Solo se muestra el historial de tu sucursal."
                : undefined
            }
          />
          <Input
            label="Desde"
            name="from"
            type="date"
            value={filters.from}
            onChange={(e) => update("from", e.target.value)}
          />
          <Input
            label="Hasta"
            name="to"
            type="date"
            value={filters.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            Ventas{" "}
            <span className="text-sm font-normal text-text-muted">
              ({sales.length})
            </span>
          </CardTitle>
          {salesLoading && (
            <span className="text-xs text-text-muted">Cargando...</span>
          )}
        </CardHeader>

        {error && (
          <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error.message}
          </p>
        )}

        <SimpleTable<Sale>
          columns={columns}
          rows={sales}
          rowKey={(s) => s.id}
          empty={salesLoading ? "Cargando..." : "Sin ventas registradas"}
        />
      </Card>
    </>
  );
}

export default function HistorialPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-text-secondary">
          Registro completo de ventas, filtrable por producto, sucursal y fecha
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
