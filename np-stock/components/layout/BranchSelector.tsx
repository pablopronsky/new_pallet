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
    <div className="hidden items-center gap-1 rounded-xl border border-border bg-surface p-1 lg:inline-flex">
      {options.map((o) => {
        const isActive = o.value === active;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => handle(o.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
