"use client";

import { useCallback, useState } from "react";
import { deleteField, updateDoc } from "firebase/firestore";
import { userDoc } from "@/lib/firestore";
import { useUserProfiles } from "@/hooks/useUserProfiles";
import type { Branch, Role, UserProfile } from "@/types/domain";

export interface UpdateUserProfilePatch {
  nombre?: string;
  role: Role;
  sucursalAsignada?: Branch;
  activo: boolean;
}

export interface UseManageUsersResult {
  users: UserProfile[];
  loading: boolean;
  error: Error | null;
  updateUserProfile: (
    uid: string,
    patch: UpdateUserProfilePatch,
  ) => Promise<void>;
  submitting: boolean;
}

export function useManageUsers(): UseManageUsersResult {
  const { profiles, loading, error } = useUserProfiles();
  const [submitting, setSubmitting] = useState<boolean>(false);

  const updateUserProfile = useCallback(
    async (uid: string, patch: UpdateUserProfilePatch): Promise<void> => {
      if (!uid.trim()) throw new Error("uid is required");

      setSubmitting(true);
      try {
        await updateDoc(userDoc(uid), {
          nombre: patch.nombre?.trim() || deleteField(),
          role: patch.role,
          activo: patch.activo,
          sucursalAsignada:
            patch.role === "vendedor" && patch.sucursalAsignada
              ? patch.sucursalAsignada
              : deleteField(),
        });
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return {
    users: profiles,
    loading,
    error,
    updateUserProfile,
    submitting,
  };
}
