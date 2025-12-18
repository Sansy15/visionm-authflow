// src/contexts/ProfileContext.tsx
import React, { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isUserAdmin } from "@/lib/utils/adminUtils";
import { ProfileContext, type ProfileContextType } from "./profile-context";

type ProfileProviderProps = {
  children: ReactNode;
};

export function ProfileProvider({ children }: ProfileProviderProps) {
  const isDev = import.meta.env.DEV;
  const [profile, setProfile] = useState<any | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reloadProfileInProgress = useRef(false);
  // Track in-flight profile loads so multiple callers share the same request
  const loadProfilePromiseRef = useRef<Promise<void> | null>(null);
  const lastProfileUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (session: any) => {
      const userId = session?.user?.id as string | undefined;

      if (!userId) {
        if (isDev) {
          console.log("[ProfileContext] No session.user.id, skipping profile fetch");
        }
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setLoading(false);
        lastProfileUserIdRef.current = null;
        loadProfilePromiseRef.current = null;
        return;
      }

      // If a profile load is already in flight for the same user, reuse it
      if (
        loadProfilePromiseRef.current &&
        lastProfileUserIdRef.current === userId
      ) {
        if (isDev) {
          console.log("[ProfileContext] Reusing in-flight profile load for user:", userId);
        }
        return loadProfilePromiseRef.current;
      }

      lastProfileUserIdRef.current = userId;

      const loadPromise = (async () => {
        try {
          setLoading(true);
          setError(null);

          if (isDev) {
            console.log("[ProfileContext] Fetching profile for user:", userId);
          }

        // Add timeout to profile fetch to prevent infinite hanging
        const profileFetchPromise = supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        const profileTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Profile fetch timeout after 8 seconds")),
            8000
          );
        });

          // Add safety timeout wrapper
          const profileSafetyTimeout = new Promise<{ data: any; error: any }>((resolve) => {
            setTimeout(() => {
              resolve({ data: null, error: new Error("Profile fetch safety timeout after 10 seconds") });
            }, 10000);
          });

          const profileResult: any = await Promise.race([
            Promise.race([
              profileFetchPromise.then((r: any) => ({ data: r.data, error: r.error })),
              profileTimeoutPromise,
            ]),
            profileSafetyTimeout,
          ]);

          const profileData = profileResult.data;
          const profileError = profileResult.error;

          if (profileError) throw profileError;

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
            let companyData: any = null;
            let companyError: any = null;

            try {
              const companyFetchPromise = supabase
                .from("companies")
                .select("*")
                .eq("id", profileData.company_id)
                .maybeSingle();

              // Create a timeout promise that will always reject after 10 seconds
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                  () => reject(new Error("Company fetch timeout after 10 seconds")),
                  10000
                );
              });

              // Wrap Promise.race in a safety timeout to ensure it always resolves
              const racePromise = Promise.race([
                companyFetchPromise.then((r: any) => ({ data: r.data, error: r.error })),
                timeoutPromise,
              ]);

              // Add an additional safety timeout wrapper to ensure we never hang forever
              const safetyTimeout = new Promise<{ data: any; error: any }>((resolve) => {
                setTimeout(() => {
                  resolve({ data: null, error: new Error("Company fetch safety timeout after 12 seconds") });
                }, 12000);
              });

              const result: any = await Promise.race([
                racePromise,
                safetyTimeout,
              ]);

              companyData = result.data;
              companyError = result.error;
            } catch (timeoutError: any) {
              console.error("[ProfileContext] Company fetch timeout or error:", timeoutError);
              companyError = timeoutError;
            }

            if (companyError) {
              console.error("[ProfileContext] Error loading company:", companyError);
              if (isDev) {
                console.log("[ProfileContext] Company fetch failed - continuing without company data");
              }
            }

            if (companyData) {
              setCompany(companyData);
              const adminStatus = isUserAdmin(profileData, companyData);
              setIsAdmin(adminStatus);
              setProfile({ ...profileData, companies: companyData });
            }
          }
        } catch (err: any) {
          console.error("Error loading profile:", err);
          const message = err?.message || "Failed to load profile";
          const isTimeoutError =
            message.includes("Profile fetch timeout after 8 seconds") ||
            message.includes("Profile fetch safety timeout after 10 seconds");

          if (isTimeoutError) {
            // Soft-handle profile timeouts: keep existing profile/company/admin state
            // so the app doesn't temporarily behave as if the user has no profile.
            setError(message);
            if (isDev) {
              console.warn("[ProfileContext] Profile fetch timeout - keeping existing profile state");
            }
          } else {
            // For real errors, preserve existing behavior and clear profile-related state
            setError(message);
            setProfile(null);
            setCompany(null);
            setIsAdmin(false);
          }
        } finally {
          // Always ensure loading is set to false, even if something goes wrong
          // Use setTimeout to ensure this runs even if the function is stuck
          setTimeout(() => {
            setLoading(false);
            if (isDev) {
              console.log("[ProfileContext] loadProfile finally block executed, loading set to false");
            }
          }, 0);
          
          // Also set it immediately (in case setTimeout doesn't help)
          setLoading(false);
          if (isDev) {
            console.log("[ProfileContext] loadProfile completed, loading set to false");
          }
        }
      })();

      loadProfilePromiseRef.current = loadPromise;

      try {
        await loadPromise;
      } finally {
        loadProfilePromiseRef.current = null;
      }
    },
    [isDev]
  );

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        setError(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (!session) {
          setUser(null);
          setProfile(null);
          setCompany(null);
          setIsAdmin(false);
          setSessionReady(true);
          setLoading(false);
          return;
        }

        setUser(session.user);
        // Add a safety timeout to ensure sessionReady is always set, even if loadProfile hangs
        const loadProfileWithTimeout = Promise.race([
          loadProfile(session),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              console.error("[ProfileContext] loadProfile safety timeout - forcing sessionReady");
              resolve();
            }, 15000); // 15 second safety timeout
          }),
        ]);

        try {
          await loadProfileWithTimeout;
          // Set sessionReady after loadProfile completes successfully
          setSessionReady(true);
          if (isDev) {
            console.log("[ProfileContext] Session hydrated successfully");
          }
        } catch (profileError: any) {
          // If loadProfile throws, we still need to set sessionReady
          console.error("[ProfileContext] loadProfile threw error:", profileError);
          setSessionReady(true);
        }
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

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setProfile(null);
        setCompany(null);
        setIsAdmin(false);
        setSessionReady(true);
        setLoading(false);
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        setUser(session.user);
        // Don't set sessionReady until loadProfile completes
        try {
          await loadProfile(session);
          setSessionReady(true);
        } catch (profileError: any) {
          console.error("[ProfileContext] loadProfile threw error in auth state change:", profileError);
          setSessionReady(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value: ProfileContextType = {
    profile,
    company,
    isAdmin,
    loading,
    user,
    sessionReady,
    error,
    reloadProfile: async () => {
      // Prevent concurrent calls to avoid race conditions
      if (reloadProfileInProgress.current) {
        if (isDev) {
          console.log("[ProfileContext] reloadProfile already in progress, skipping");
        }
        return;
      }

      try {
        reloadProfileInProgress.current = true;

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        // Handle errors from getSession()
        if (sessionError) {
          console.error("[ProfileContext] Error getting session in reloadProfile:", sessionError);
          setError(sessionError.message || "Failed to get session");
          return;
        }

        // If no session, silently return (existing behavior)
        if (!session) {
          if (isDev) {
            console.log("[ProfileContext] No session available for reloadProfile");
          }
          return;
        }

        // Load profile with error handling
        try {
          await loadProfile(session);
        } catch (profileError: any) {
          console.error("[ProfileContext] Error loading profile in reloadProfile:", profileError);
          setError(profileError?.message || "Failed to reload profile");
          // Don't rethrow - let the function complete gracefully
        }
      } catch (err: any) {
        console.error("[ProfileContext] Unexpected error in reloadProfile:", err);
        setError(err?.message || "Failed to reload profile");
      } finally {
        reloadProfileInProgress.current = false;
      }
    },
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}
