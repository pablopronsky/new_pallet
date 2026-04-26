"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { SalesForm } from "@/components/sales/SalesForm";
import { useBranchFilter } from "@/contexts/BranchFilterContext";
import { useAuth } from "@/hooks/useAuth";

function VentasContent() {
  const { role } = useAuth();
  const { selectedBranch } = useBranchFilter();
  const defaultBranch =
    role === "admin" && selectedBranch !== "all" ? selectedBranch : undefined;

  return <SalesForm defaultBranch={defaultBranch} />;
}

export default function VentasPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-sm text-text-secondary">
          Registro de ventas con validacion de stock
        </p>
      </div>

      <div className="mt-6">
        <RoleGuard allowedRoles={["admin", "vendedor"]}>
          <VentasContent />
        </RoleGuard>
      </div>
    </>
  );
}
