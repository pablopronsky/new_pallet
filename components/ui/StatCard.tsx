import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

export type StatTone = "default" | "primary" | "accent" | "danger" | "success";

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}

const toneClasses: Record<StatTone, string> = {
  default: "text-text-primary",
  primary: "text-primary-light",
  accent: "text-accent",
  danger: "text-danger",
  success: "text-success",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative flex min-h-36 flex-col gap-3 overflow-hidden",
        "before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary-light/45 before:to-transparent",
        tone !== "default" && "shadow-glow",
        className,
      )}
    >
      <div className="flex items-center justify-between text-text-secondary">
        <span className="text-xs font-medium uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className={cn("text-3xl font-semibold tracking-tight md:text-4xl", toneClasses[tone])}>
        {value}
      </div>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </Card>
  );
}
