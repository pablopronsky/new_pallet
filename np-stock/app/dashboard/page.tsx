"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useDistribution } from "@/hooks/useDistribution";
import { useProducts } from "@/hooks/useProducts";
import { formatNumberAR, formatUSD } from "@/lib/formatters";
import { salesCollection } from "@/lib/firestore";
import type { Branch, Product, Role, Sale } from "@/types/domain";

interface DashboardMetrics {
  stockDisponible: number;
  deudaAllCovering: number;
  revenueUSD: number;
  utilidadBruta: number;
}

interface UseDashboardSalesResult {
  sales: Sale[];
  loading: boolean;
  error: Error | null;
}

function useDashboardSales(
  role: Role | null,
  vendedorBranch: Branch | undefined,
): UseDashboardSalesResult {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (role === "allcovering" || role === null) {
      setSales([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (role === "vendedor" && !vendedorBranch) {
      setSales([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const q =
      role === "vendedor"
        ? query(salesCollection(), where("sucursal", "==", vendedorBranch))
        : salesCollection();

    const unsub = onSnapshot(
      q,
      (snap) => {
        setSales(snap.docs.map((doc) => doc.data()));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setSales([]);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [role, vendedorBranch]);

  return { sales, loading, error };
}

function buildProductMap(products: Product[]): Record<string, Product> {
  const byId: Record<string, Product> = {};
  for (const product of products) byId[product.id] = product;
  return byId;
}

function calculateMetrics(params: {
  productsById: Record<string, Product>;
  distributions: ReturnType<typeof useDistribution>["distributions"];
  sales: Sale[];
  branch?: Branch;
}): DashboardMetrics {
  const { productsById, distributions, sales, branch } = params;

  const stockDisponible = distributions.reduce((total, distribution) => {
    if (branch) {
      return total + (distribution.cajasPorSucursal[branch] ?? 0);
    }

    return (
      total +
      Object.values(distribution.cajasPorSucursal).reduce(
        (sum, boxes) => sum + boxes,
        0,
      )
    );
  }, 0);

  const deudaAllCovering = sales.reduce((total, sale) => {
    const productCost = productsById[sale.productId]?.costoUSD ?? 0;
    return total + sale.cajas * productCost;
  }, 0);

  const revenueUSD = sales.reduce((total, sale) => total + sale.montoUSD, 0);

  return {
    stockDisponible,
    deudaAllCovering,
    revenueUSD,
    utilidadBruta: revenueUSD - deudaAllCovering,
  };
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
        <Link href="/dashboard/proveedor" className="block">
          <Card className="h-full transition-colors hover:border-primary/60 hover:bg-surface-2">
            <CardHeader>
              <CardTitle>Portal All Covering</CardTitle>
              <Badge tone="primary">proveedor</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Ver cajas vendidas, cajas restantes y deuda consolidada.
            </p>
          </Card>
        </Link>
      </div>
    </>
  );
}

function InternalDashboard() {
  const { role, profile } = useAuth();
  const vendedorBranch =
    role === "vendedor" ? profile?.sucursalAsignada : undefined;
  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts({ activeOnly: false });
  const {
    distributions,
    loading: distributionsLoading,
    error: distributionsError,
  } = useDistribution();
  const {
    sales,
    loading: salesLoading,
    error: salesError,
  } = useDashboardSales(role, vendedorBranch);

  const productsById = useMemo(() => buildProductMap(products), [products]);
  const metrics = useMemo(
    () =>
      calculateMetrics({
        productsById,
        distributions,
        sales,
        branch: vendedorBranch,
      }),
    [distributions, productsById, sales, vendedorBranch],
  );

  const loading = productsLoading || distributionsLoading || salesLoading;
  const error = productsError ?? distributionsError ?? salesError;
  const hasMissingBranch = role === "vendedor" && !vendedorBranch;
  const hasAnyData =
    products.length > 0 || distributions.length > 0 || sales.length > 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          {vendedorBranch
            ? "Resumen de tu sucursal asignada"
            : "Resumen general de consignacion"}
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          No se pudieron cargar los datos del dashboard: {error.message}
        </p>
      )}

      {hasMissingBranch && (
        <Card className="mt-6">
          <p className="text-sm text-text-secondary">
            Tu usuario no tiene una sucursal asignada. El dashboard muestra
            valores en cero hasta que se configure tu perfil.
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Deuda All Covering"
          value={loading ? "..." : formatUSD(metrics.deudaAllCovering)}
          hint="Ventas por costo vigente del producto"
          tone="accent"
        />
        <StatCard
          label="Utilidad bruta"
          value={loading ? "..." : formatUSD(metrics.utilidadBruta)}
          hint="Revenue USD menos deuda"
          tone="primary"
        />
        <StatCard
          label="Stock disponible"
          value={
            loading
              ? "..."
              : `${formatNumberAR(metrics.stockDisponible)} cajas`
          }
          hint={
            vendedorBranch
              ? "Stock vivo de tu sucursal"
              : "Stock vivo de todas las sucursales"
          }
        />
      </div>

      {!loading && !error && !hasAnyData && (
        <Card className="mt-6">
          <p className="text-sm text-text-secondary">Sin datos suficientes</p>
        </Card>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/ventas" className="block">
          <Card className="h-full transition-colors hover:border-primary/60 hover:bg-surface-2">
            <CardHeader>
              <CardTitle>Ventas</CardTitle>
              <Badge tone="primary">operacion</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Registrar ventas y descontar stock vivo.
            </p>
          </Card>
        </Link>

        {(role === "admin" || role === "controlador") && (
          <Link href="/dashboard/ingresos" className="block">
            <Card className="h-full transition-colors hover:border-primary/60 hover:bg-surface-2">
              <CardHeader>
                <CardTitle>Ingresos</CardTitle>
                <Badge tone="success">stock</Badge>
              </CardHeader>
              <p className="text-sm text-text-secondary">
                Cargar mercaderia recibida por sucursal.
              </p>
            </Card>
          </Link>
        )}

        {(role === "admin" || role === "controlador") && (
          <Link href="/dashboard/bajas" className="block">
            <Card className="h-full transition-colors hover:border-primary/60 hover:bg-surface-2">
              <CardHeader>
                <CardTitle>Bajas</CardTitle>
                <Badge tone="warning">stock</Badge>
              </CardHeader>
              <p className="text-sm text-text-secondary">
                Registrar salidas no vinculadas a ventas.
              </p>
            </Card>
          </Link>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { role, loading, profileLoading } = useAuth();

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

  return <InternalDashboard />;
}
