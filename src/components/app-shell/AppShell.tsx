import React, { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { AppBreadcrumbs } from "./Breadcrumbs";
import { BreadcrumbProvider } from "./breadcrumb-context";
import { useProfile } from "@/hooks/useProfile";
import { useRoutePersistence } from "@/hooks/useRoutePersistence";
import { useToast } from "@/hooks/use-toast";

const AppShellContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionReady, user, error } = useProfile();
  const lastActiveRef = useRef<number>(Date.now());
  const hasRefreshedAfterIdleRef = useRef(false);
  const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  // Handle navigation on sign out (ProfileContext handles state clearing)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/auth");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Show error toast if session restore fails
  useEffect(() => {
    if (sessionReady && error) {
      toast({
        title: "Session Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [sessionReady, error, toast]);

  // Restore route after session is ready and user is authenticated
  useRoutePersistence(sessionReady, user);

  // Track inactivity and perform a single controlled refresh after long idle
  useEffect(() => {
    const handleVisibilityChange = () => {
      const now = Date.now();

      if (document.visibilityState === "hidden") {
        lastActiveRef.current = now;
        return;
      }

      if (document.visibilityState === "visible") {
        const idleDuration = now - lastActiveRef.current;

        if (idleDuration >= INACTIVITY_THRESHOLD_MS && !hasRefreshedAfterIdleRef.current) {
          hasRefreshedAfterIdleRef.current = true;
          // Let existing persistence mechanisms (route, training state) handle restoration
          window.location.reload();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // This component only renders when sessionReady && user (gated by ProtectedRoutes)
  // So we can safely render the UI here
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <AppBreadcrumbs className="mb-6" />
            <Outlet />
          </div>
        </main>
      </div>
      <footer className="border-t bg-background py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} VisionM. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export const AppShell = () => {
  return (
    <BreadcrumbProvider>
      <AppShellContent />
    </BreadcrumbProvider>
  );
};

