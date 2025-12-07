import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { AppBreadcrumbs } from "./Breadcrumbs";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { useRoutePersistence } from "@/hooks/useRoutePersistence";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/pages/LoadingState";

const AppShellContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionReady, error, loading } = useProfile();

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

  // Restore route after session is ready
  useRoutePersistence(sessionReady);

  // Show loading state while session is being hydrated
  // Only show if we're not on auth page (to avoid blocking auth flow)
  if (!sessionReady && !window.location.pathname.includes("/auth")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Restoring session..." />
      </div>
    );
  }

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
    <ProfileProvider>
      <AppShellContent />
    </ProfileProvider>
  );
};

