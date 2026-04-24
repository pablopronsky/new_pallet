"use client";

import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { AuthState, AuthUser } from "@/types/auth";

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const { profile, loading: profileLoading, role } = useUserProfile(
    user?.uid ?? null,
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      profile,
      profileLoading,
      role,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, loading, profile, profileLoading, role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
