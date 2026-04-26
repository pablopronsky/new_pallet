"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Branch } from "@/types/domain";

export type BranchFilterValue = Branch | "all";

interface BranchFilterContextValue {
  selectedBranch: BranchFilterValue;
  setSelectedBranch: (branch: BranchFilterValue) => void;
}

const BranchFilterContext = createContext<BranchFilterContextValue | null>(null);

export function BranchFilterProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [selectedBranch, setSelectedBranch] =
    useState<BranchFilterValue>("all");

  useEffect(() => {
    if (role !== "admin" && selectedBranch !== "all") {
      setSelectedBranch("all");
    }
  }, [role, selectedBranch]);

  const value = useMemo<BranchFilterContextValue>(
    () => ({
      selectedBranch,
      setSelectedBranch,
    }),
    [selectedBranch],
  );

  return (
    <BranchFilterContext.Provider value={value}>
      {children}
    </BranchFilterContext.Provider>
  );
}

export function useBranchFilter() {
  const context = useContext(BranchFilterContext);
  if (!context) {
    throw new Error("useBranchFilter must be used within BranchFilterProvider");
  }
  return context;
}
