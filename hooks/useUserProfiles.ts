"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { usersCollection } from "@/lib/firestore";
import type { UserProfile } from "@/types/domain";

export interface UseUserProfilesResult {
  profiles: UserProfile[];
  byUid: Record<string, UserProfile>;
  loading: boolean;
  error: Error | null;
}

export function useUserProfiles(): UseUserProfilesResult {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      usersCollection(),
      (snap) => {
        setProfiles(snap.docs.map((d) => d.data()));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const byUid = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    for (const p of profiles) map[p.uid] = p;
    return map;
  }, [profiles]);

  return { profiles, byUid, loading, error };
}

export function displayNameForUser(profile: UserProfile | undefined, uid: string): string {
  if (profile?.nombre && profile.nombre.trim()) return profile.nombre;
  if (profile?.email) return profile.email;
  return `${uid.slice(0, 8)}…`;
}
