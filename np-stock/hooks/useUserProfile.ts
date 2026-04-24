"use client";

import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { userDoc } from "@/lib/firestore";
import type { Role, UserProfile } from "@/types/domain";

export interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  role: Role | null;
}

export function useUserProfile(uid: string | null): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(
      userDoc(uid),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [uid]);

  return { profile, loading, role: profile?.role ?? null };
}
