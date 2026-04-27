"use client";

import { useState } from "react";
import { BRANCHES, BRANCH_LABELS } from "@/lib/constants";
import type { Branch } from "@/types/domain";
import { cn } from "@/lib/cn";

export type BranchFilter = Branch | "all";

export interface BranchSelectorProps {
  value?: BranchFilter;
  onChange?: (value: BranchFilter) => void;
}

const options: { value: BranchFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  ...BRANCHES.map((b) => ({ value: b, label: BRANCH_LABELS[b] })),
];

export function BranchSelector({ value, onChange }: BranchSelectorProps) {
  const [internal, setInternal] = useState<BranchFilter>("all");
  const active = value ?? internal;

  const handle = (next: BranchFilter) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };

  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border/80 bg-surface/80 p-1 shadow-premium backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => {
        const isActive = o.value === active;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => handle(o.value)}
            className={cn(
              "min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-white shadow-glow"
                : "text-text-secondary hover:bg-primary/10 hover:text-text-primary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
