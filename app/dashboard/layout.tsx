import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BranchFilterProvider } from "@/contexts/BranchFilterContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <BranchFilterProvider>
        <AppShell>{children}</AppShell>
      </BranchFilterProvider>
    </ProtectedRoute>
  );
}
