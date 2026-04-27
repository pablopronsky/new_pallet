"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";
import type { Role } from "@/types/domain";

interface NavItem {
  href: string;
  label: string;
}

const navItemsByRole: Record<Role, NavItem[]> = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/proveedor", label: "All Covering" },
    { href: "/dashboard/stock", label: "Stock" },
    { href: "/dashboard/ventas", label: "Ventas" },
    { href: "/dashboard/ingresos", label: "Ingresos" },
    { href: "/dashboard/bajas", label: "Bajas" },
    { href: "/dashboard/traslados", label: "Movimientos" },
    { href: "/dashboard/historial", label: "Historial" },
    { href: "/dashboard/auditorias", label: "Auditorías" },
    { href: "/dashboard/configuracion", label: "Configuración" },
    { href: "/dashboard/usuarios", label: "Usuarios" },
    { href: "/dashboard/exportar", label: "Exportar" },
  ],
  controlador: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/auditorias", label: "Auditorías" },
    { href: "/dashboard/traslados", label: "Movimientos" },
  ],
  vendedor: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/ventas", label: "Ventas" },
    { href: "/dashboard/historial", label: "Historial" },
  ],
  allcovering: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/proveedor", label: "Portal Proveedor" },
  ],
};

const fallbackNavItems: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const navItems = role ? navItemsByRole[role] : fallbackNavItems;

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-64 md:flex-col md:border-r md:border-border/80 md:bg-[#060A0D]/95 md:shadow-premium md:backdrop-blur-xl">
      <div className="flex h-20 items-center gap-3 border-b border-border/70 px-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary-light/20 bg-transparent p-0.5 shadow-glow">
          <Image
            src="/branding/nuevo-parket-logo.png"
            alt="Nuevo Parket"
            width={40}
            height={40}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <div className="min-w-0 leading-tight">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Nuevo Parket
          </span>
          <span className="block text-sm font-semibold tracking-wide text-text-primary">
            Control interno
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6">
        <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Menú
        </p>
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/12 text-text-primary shadow-glow"
                      : "text-text-secondary hover:bg-primary/10 hover:text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full border transition-colors",
                      active
                        ? "border-primary-light bg-primary-light"
                        : "border-text-muted/50 group-hover:border-primary-light/70",
                    )}
                  />
                  {active && (
                    <span className="absolute left-0 top-2.5 h-6 w-1 rounded-r-full bg-primary-light" />
                  )}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/70 px-4 py-4 text-xs text-text-muted">
        v0.1
      </div>
    </aside>
  );
}
