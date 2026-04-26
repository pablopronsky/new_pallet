import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Sidebar />
      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-28 md:pb-10">
          <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
