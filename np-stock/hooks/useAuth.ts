"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/AuthProvider";
import type { AuthState } from "@/types/auth";

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
