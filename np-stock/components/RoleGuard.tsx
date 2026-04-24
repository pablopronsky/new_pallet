"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types/domain";

export interface RoleGuardProps {
  allowedRoles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { loading, profileLoading, role } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return (
      <>
        {fallback ?? (
          <div className="py-8 text-center text-sm text-slate-500">
            No autorizado
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
