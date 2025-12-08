// src/contexts/profile-context.ts
import { createContext } from "react";

export type ProfileContextType = {
  profile: any | null;
  company: any | null;
  isAdmin: boolean;
  loading: boolean;
  user: any | null;
  sessionReady: boolean;
  error: string | null;
  reloadProfile: () => Promise<void>;
};

// Only export the context here (no components in this file)
export const ProfileContext = createContext<ProfileContextType | undefined>(
  undefined
);
