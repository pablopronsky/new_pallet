"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUSD } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

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
  // Mock values — real data wiring comes later.
  const mock = {
    deuda: 12480,
    utilidad: 5320,
    stock: 642,
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Resumen general de consignación
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Deuda All Covering"
          value={formatUSD(mock.deuda)}
          hint="Cajas vendidas × costo"
          tone="accent"
        />
        <StatCard
          label="Utilidad bruta"
          value={formatUSD(mock.utilidad)}
          hint="Ingresos − deuda"
          tone="primary"
        />
        <StatCard
          label="Stock disponible"
          value={`${mock.stock} cajas`}
          hint="Sumatoria por sucursal"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <RoleGuard allowedRoles={["admin"]} fallback={null}>
          <Card>
            <CardHeader>
              <CardTitle>Admin Panel</CardTitle>
              <Badge tone="primary">admin</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Gestión de usuarios, productos, distribución y configuración.
            </p>
          </Card>
        </RoleGuard>

        <RoleGuard allowedRoles={["controlador"]} fallback={null}>
          <Card>
            <CardHeader>
              <CardTitle>Control Panel</CardTitle>
              <Badge tone="primary">controlador</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Registro de ventas y auditoría de la sucursal asignada.
            </p>
          </Card>
        </RoleGuard>

        <RoleGuard allowedRoles={["vendedor"]} fallback={null}>
          <Card>
            <CardHeader>
              <CardTitle>Panel Vendedor</CardTitle>
              <Badge tone="primary">vendedor</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Registro de ventas y consulta de historial de tu sucursal.
            </p>
          </Card>
        </RoleGuard>

        <RoleGuard allowedRoles={["allcovering"]} fallback={null}>
          <Card>
            <CardHeader>
              <CardTitle>Provider View</CardTitle>
              <Badge tone="primary">allcovering</Badge>
            </CardHeader>
            <p className="text-sm text-text-secondary">
              Vista de distribución, ventas y deuda consolidada.
            </p>
          </Card>
        </RoleGuard>
      </div>
    </>
  );
}
