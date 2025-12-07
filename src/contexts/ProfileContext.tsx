/* eslint-disable react-refresh/only-export-components */
// src/contexts/ProfileContext.tsx
// NOTE: Keep exports stable. Avoid reassigning exported bindings.
// This file exports both a hook (useProfile) and a component (ProfileProvider), which is necessary for the context pattern.
// Fast Refresh will do a full reload for this file instead of hot-reloading (this is expected and acceptable).

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/utils/adminUtils";

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

// stable const context (never reassign)
// Made internal (not exported) to fix Fast Refresh issue - only ProfileProvider and useProfile need to be exported
const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// stable named function export for the hook (do NOT switch to default or reassign)
export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

type ProfileProviderProps = {
  children: ReactNode;
};

// Use a named function for the provider — keeps HMR consistent
export function ProfileProvider({ children }: ProfileProviderProps) {
  const isDev = import.meta.env.DEV;
  const [profile, setProfile] = useState<any | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (session: any) => {
    if (!session?.user?.id) {
      if (isDev) {
        console.log("[ProfileContext] No session.user.id, skipping profile fetch");
      }
      setUser(null);
      setProfile(null);
      setCompany(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userId = session.user.id;

      if (isDev) {
        console.log("[ProfileContext] Fetching profile for user:", userId);
      }

      // Fetch profile with fresh data (no cache)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        if (isDev) {
          console.log("[ProfileContext] Profile not found for user:", userId);
        }
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setCompany(null);
      setIsAdmin(false);

      if (profileData.company_id) {
        // Fetch company with fresh data (no cache)
        // Add timeout to prevent infinite hanging
        let companyData = null;
        let companyError = null;
        
        try {
          const companyFetchPromise = supabase
            .from("companies")
            .select("*")
            .eq("id", profileData.company_id)
            .maybeSingle();
          
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Company fetch timeout after 10 seconds")), 10000)
          );
          
          const result = await Promise.race([
            companyFetchPromise,
            timeoutPromise
          ]);
          
          companyData = result.data;
          companyError = result.error;
        } catch (timeoutError: any) {
          console.error("[ProfileContext] Company fetch timeout or error:", timeoutError);
          companyError = timeoutError;
          if (isDev) {
            console.log("[ProfileContext] Company fetch failed - likely RLS issue. Apply APPLY_RLS_FIX_NOW.sql in Supabase SQL Editor.");
          }
        }

        if (companyError) {
          console.error("[ProfileContext] Error loading company:", companyError);
          if (isDev) {
            console.log("[ProfileContext] Company fetch error details:", {
              companyId: profileData.company_id,
              error: companyError.message,
              code: companyError.code,
              details: companyError.details,
              hint: companyError.hint,
            });
          }
        }

        if (companyData) {
          setCompany(companyData);
          const adminStatus = isUserAdmin(profileData, companyData);
          setIsAdmin(adminStatus);
          setProfile({ ...profileData, companies: companyData });

          if (isDev) {
            console.log("[ProfileContext] Profile loaded successfully:", {
              hasProfile: !!profileData,
              hasCompany: !!profileData?.company_id,
              profileEmail: profileData.email,
              companyAdminEmail: companyData.admin_email,
              emailsMatch: profileData.email === companyData.admin_email,
              isAdmin: adminStatus,
            });
          }
        } else {
          if (isDev) {
            console.log("[ProfileContext] Profile loaded, company not found:", {
              hasProfile: !!profileData,
              hasCompany: false,
              isAdmin: false,
              profileCompanyId: profileData.company_id,
              companyError: companyError ? {
                message: companyError.message,
                code: companyError.code,
                details: companyError.details,
              } : null,
              companyData: companyData,
            });
          }
        }
      } else {
        if (isDev) {
          console.log("[ProfileContext] Profile loaded successfully:", {
            hasProfile: !!profileData,
            hasCompany: false,
            isAdmin: false,
          });
        }
      }
    } catch (err: any) {
      console.error("Error loading profile:", err);
      setError(err?.message || "Failed to load profile");
      setProfile(null);
      setCompany(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [isDev]);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        setError(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (isDev) {
          console.log("[ProfileContext] getSession() result:", {
            hasSession: !!session,
            userId: session?.user?.id,
            email: session?.user?.email,
          });
        }

        if (!mounted) return;

        if (!session) {
          setUser(null);
          setProfile(null);
          setCompany(null);
          setIsAdmin(false);
          setSessionReady(true);
          setLoading(false);
          if (isDev) {
            console.log("[ProfileContext] No session found, session ready");
          }
          return;
        }

        setUser(session.user);
        setSessionReady(true);

        await loadProfile(session);
      } catch (err: any) {
        console.error("Error hydrating session:", err);
        setError(err?.message || "Failed to restore session");
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setSessionReady(true);
        setLoading(false);
      }
    };

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (isDev) {
        console.log("[ProfileContext] Auth state change:", event, {
          hasSession: !!session,
          userId: session?.user?.id,
        });
      }

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setSessionReady(true);
        setLoading(false);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setUser(session.user);
        setSessionReady(true);
        await loadProfile(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, isDev]);

  const reloadProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await loadProfile(session);
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        company,
        isAdmin,
        loading,
        user,
        sessionReady,
        error,
        reloadProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
