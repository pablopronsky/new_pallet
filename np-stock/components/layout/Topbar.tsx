"use client";

import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BranchSelector } from "./BranchSelector";

export function Topbar() {
  const { user, role, profileLoading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <BranchSelector />
      </div>

      <div className="flex items-center gap-3">
        {profileLoading ? (
          <Badge tone="neutral">…</Badge>
        ) : role ? (
          <Badge tone="primary">{ROLE_LABELS[role]}</Badge>
        ) : (
          <Badge tone="warning">Sin rol</Badge>
        )}

        {user?.email && (
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium text-text-primary">
              {user.email}
            </div>
          </div>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-text-secondary">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <Button variant="ghost" size="sm" onClick={() => logout()}>
          Salir
        </Button>
      </div>
    </header>
  );
}
