import type { User } from "firebase/auth";
import type { Role, UserProfile } from "@/types/domain";

export type AuthUser = User;

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  role: Role | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
