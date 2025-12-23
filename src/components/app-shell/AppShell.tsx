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

// Constants for inactivity tracking
const INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const MIN_IDLE_DURATION_MS = 5 * 60 * 1000; // Minimum 5 minutes to prevent false positives
const MAX_IDLE_DURATION_MS = 24 * 60 * 60 * 1000; // Maximum 24 hours to ignore stale timestamps
const LAST_HIDDEN_STORAGE_KEY = "visionm_last_tab_hidden";
const HAS_REFRESHED_STORAGE_KEY = "visionm_has_refreshed_after_idle";
const PAGE_LOAD_TIME_KEY = "visionm_page_load_time";

const AppShellContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sessionReady, user, error } = useProfile();
  
  // Use refs to persist across remounts
  const visibilityChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Show error toast if session restore fails (but suppress soft profile timeouts)
  useEffect(() => {
    if (!sessionReady || !error) return;

    const isProfileTimeout =
      error.includes("Profile fetch timeout after 8 seconds") ||
      error.includes("Profile fetch safety timeout after 10 seconds");

    if (isProfileTimeout) {
      // Treat profile timeouts as soft warnings: keep state, no user-facing toast
      return;
    }

    toast({
      title: "Session Error",
      description: error,
      variant: "destructive",
    });
  }, [sessionReady, error, toast]);

  // Restore route after session is ready and user is authenticated
  useRoutePersistence(sessionReady, user);

  // Track actual user activity and perform a single controlled refresh after long inactivity
  useEffect(() => {
    // Store page load time on mount
    const pageLoadTime = Date.now();
    const ACTIVITY_TIME_KEY = "visionm_last_user_activity";
    
    try {
      const storedLoadTime = sessionStorage.getItem(PAGE_LOAD_TIME_KEY);
      if (!storedLoadTime) {
        sessionStorage.setItem(PAGE_LOAD_TIME_KEY, pageLoadTime.toString());
      }
      
      // Initialize activity time on page load
      sessionStorage.setItem(ACTIVITY_TIME_KEY, pageLoadTime.toString());
    } catch (error) {
      // Ignore storage errors
    }

    // Track user activity - update timestamp on any user interaction
    const updateActivityTime = () => {
      try {
        sessionStorage.setItem(ACTIVITY_TIME_KEY, Date.now().toString());
      } catch (error) {
        // Ignore storage errors
      }
    };

    // Listen to user activity events (throttled to avoid excessive writes)
    let activityThrottleTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateActivity = () => {
      if (activityThrottleTimeout) return;
      updateActivityTime();
      activityThrottleTimeout = setTimeout(() => {
        activityThrottleTimeout = null;
      }, 5000); // Update at most once every 5 seconds
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'keypress', 'scroll', 'touchstart', 'click', 'focus'];
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Check for inactivity periodically (every 1 minute)
    const inactivityCheckInterval = setInterval(() => {
      try {
        // Skip if already refreshed
        const refreshedFlag = sessionStorage.getItem(HAS_REFRESHED_STORAGE_KEY);
        if (refreshedFlag === "true") {
          return;
        }

        // Get last activity time
        const lastActivityStr = sessionStorage.getItem(ACTIVITY_TIME_KEY);
        if (!lastActivityStr) {
          // No activity recorded, initialize it
          sessionStorage.setItem(ACTIVITY_TIME_KEY, Date.now().toString());
          return;
        }

        const lastActivityTime = parseInt(lastActivityStr, 10);
        const pageLoadTimestamp = sessionStorage.getItem(PAGE_LOAD_TIME_KEY);
        
        // Ignore if timestamp is from previous session
        if (pageLoadTimestamp && lastActivityTime < parseInt(pageLoadTimestamp, 10)) {
          sessionStorage.setItem(ACTIVITY_TIME_KEY, Date.now().toString());
          return;
        }

        const inactivityDuration = Date.now() - lastActivityTime;
        const inactivityMinutes = Math.round(inactivityDuration / 1000 / 60);

        // Only refresh if user has been inactive for 10+ minutes
        // AND tab is currently visible (user might be back)
        if (
          inactivityDuration >= INACTIVITY_THRESHOLD_MS &&
          inactivityDuration <= MAX_IDLE_DURATION_MS &&
          !document.hidden
        ) {
          console.log("[AppShell] REFRESH TRIGGERED - User inactive for", inactivityMinutes, "minutes");
          
          // Mark as refreshed
          sessionStorage.setItem(HAS_REFRESHED_STORAGE_KEY, "true");
          
          // Small delay to ensure storage is written
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      } catch (error) {
        console.error("[AppShell] Error in inactivity check:", error);
      }
    }, 60 * 1000); // Check every 1 minute

    return () => {
      clearInterval(inactivityCheckInterval);
      if (activityThrottleTimeout) {
        clearTimeout(activityThrottleTimeout);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledUpdateActivity);
      });
    };
  }, []); // Constants are defined outside component, no need to include them

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

