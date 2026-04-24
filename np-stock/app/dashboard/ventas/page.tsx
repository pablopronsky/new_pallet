"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { SalesForm } from "@/components/sales/SalesForm";

export default function VentasPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-sm text-text-secondary">
          Registro de ventas con validación de stock
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "controlador"]}>
          <SalesForm />
        </RoleGuard>
      </div>
    </>
  );
}
