"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";
import type { Role } from "@/types/domain";

interface NavItem {
  href: string;
  label: string;
}

const itemsByRole: Record<Role, NavItem[]> = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/proveedor", label: "All Covering" },
    { href: "/dashboard/stock", label: "Stock" },
    { href: "/dashboard/ventas", label: "Ventas" },
    { href: "/dashboard/ingresos", label: "Ingresos" },
    { href: "/dashboard/bajas", label: "Bajas" },
    { href: "/dashboard/traslados", label: "Movimientos" },
    { href: "/dashboard/historial", label: "Historial" },
    { href: "/dashboard/auditorias", label: "Auditorias" },
    { href: "/dashboard/configuracion", label: "Config." },
    { href: "/dashboard/usuarios", label: "Usuarios" },
    { href: "/dashboard/exportar", label: "Exportar" },
  ],
  controlador: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/auditorias", label: "Auditorias" },
    { href: "/dashboard/traslados", label: "Movimientos" },
  ],
  vendedor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/ventas", label: "Ventas" },
    { href: "/dashboard/historial", label: "Historial" },
  ],
  allcovering: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/proveedor", label: "Proveedor" },
  ],
};

const fallbackItems: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();
  const items = role ? itemsByRole[role] : fallbackItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur md:hidden">
      <ul className="flex min-h-16 gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 min-w-[4.75rem] items-center justify-center rounded-xl px-3 text-center text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary-light"
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
  );
}
