"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/stock", label: "Stock" },
  { href: "/dashboard/ingresos", label: "Ingresos" },
  { href: "/dashboard/ventas", label: "Ventas" },
  { href: "/dashboard/bajas", label: "Bajas" },
  { href: "/dashboard/historial", label: "Historial" },
  { href: "/dashboard/auditorias", label: "Auditorías" },
  { href: "/dashboard/configuracion", label: "Configuración" },
  { href: "/dashboard/usuarios", label: "Usuarios" },
  { href: "/dashboard/exportar", label: "Exportar" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-surface">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          N
        </div>
        <span className="text-sm font-semibold tracking-wide">np-stock</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Menu
        </p>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-3 text-xs text-text-muted">
        v0.1
      </div>
    </aside>
  );
}
