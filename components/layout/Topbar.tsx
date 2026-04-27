"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useBranchFilter } from "@/contexts/BranchFilterContext";
import { useAuth } from "@/hooks/useAuth";
import { BRANCH_LABELS, ROLE_LABELS } from "@/lib/constants";
import { BranchSelector } from "./BranchSelector";

const branchFilterRoutes = [
  "/dashboard",
  "/dashboard/stock",
  "/dashboard/historial",
  "/dashboard/ventas",
  "/dashboard/ingresos",
  "/dashboard/bajas",
];

function usesBranchFilter(pathname: string) {
  return branchFilterRoutes.some((route) => {
    if (route === "/dashboard") return pathname === route;
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

export function Topbar() {
  const { user, profile, role, profileLoading, logout } = useAuth();
  const pathname = usePathname();
  const { selectedBranch, setSelectedBranch } = useBranchFilter();
  const showAdminBranchFilter = role === "admin" && usesBranchFilter(pathname);
  const vendedorBranch = role === "vendedor" ? profile?.sucursalAsignada : null;

  return (
    <header className="sticky top-0 z-10 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-3 py-3 backdrop-blur-xl sm:flex-nowrap sm:px-5 md:px-8">
      <div className="min-w-0 flex-1">
        {showAdminBranchFilter ? (
          <BranchSelector
            value={selectedBranch}
            onChange={setSelectedBranch}
          />
        ) : vendedorBranch ? (
          <Badge tone="neutral">Sucursal: {BRANCH_LABELS[vendedorBranch]}</Badge>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 rounded-2xl border border-border/75 bg-surface/70 p-1.5 shadow-premium sm:gap-3">
        {profileLoading ? (
          <Badge tone="neutral">...</Badge>
        ) : role ? (
          <Badge tone="primary">{ROLE_LABELS[role]}</Badge>
        ) : user && !profile ? (
          <Badge tone="warning">Sin perfil</Badge>
        ) : (
          <Badge tone="warning">Sin rol</Badge>
        )}

        {user?.email && (
          <div className="hidden min-w-0 text-right sm:block">
            <div className="max-w-[13rem] truncate text-sm font-medium text-text-primary lg:max-w-none">
              {user.email}
            </div>
          </div>
        )}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/90 bg-surface-2 text-sm font-semibold text-primary-light">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout()}>
          Salir
        </Button>
      </div>
    </header>
  );
}
