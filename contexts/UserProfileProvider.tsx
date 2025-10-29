"use client";
import { createContext, useContext, useMemo } from "react";
import type { User } from "firebase/auth";
import { useFirebaseUser } from "@/hooks/useFirebaseUser";
import { useUserProfile, type UserProfile } from "@/hooks/useUserProfile";

type Ctx = {
  user: User | null;
  userLoading: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
};

const UserProfileContext = createContext<Ctx | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useFirebaseUser();
  const { profile, loading: profileLoading } = useUserProfile(user);

  const value = useMemo<Ctx>(() => ({ user, userLoading, profile, profileLoading }), [user, userLoading, profile, profileLoading]);
  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfileContext() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfileContext must be used within UserProfileProvider");
  return ctx;
}


