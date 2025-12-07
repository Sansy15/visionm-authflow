import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ROUTE_STORAGE_KEY = "visionm_last_route";

/**
 * Hook to persist and restore the current route on page refresh
 * Saves route to localStorage and restores it after session hydration
 */
export const useRoutePersistence = (isSessionReady: boolean) => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasRestored = useRef(false);
  const initialRoute = useRef<string | null>(null);

  // Capture initial route on mount (before any saves happen)
  useEffect(() => {
    if (initialRoute.current === null) {
      initialRoute.current = location.pathname + location.search;
    }
  }, []);

  // Save route to localStorage on navigation changes (only for app routes)
  // Only save AFTER we've restored (to avoid overwriting saved route during initial load)
  useEffect(() => {
    // Only save if we've already restored (session is ready and restore has happened)
    if (isSessionReady && hasRestored.current) {
      const isAppRoute = location.pathname.startsWith("/dashboard") || 
                        location.pathname.startsWith("/account") ||
                        location.pathname.startsWith("/dataset");
      
      if (isAppRoute && location.pathname !== "/auth") {
        try {
          localStorage.setItem(ROUTE_STORAGE_KEY, location.pathname + location.search);
        } catch (error) {
          console.warn("Failed to save route to localStorage:", error);
        }
      }
    }
  }, [location, isSessionReady]);

  // Restore route after session is ready (only once)
  useEffect(() => {
    if (!isSessionReady || hasRestored.current) return;

    try {
      const savedRoute = localStorage.getItem(ROUTE_STORAGE_KEY);
      const currentRoute = location.pathname + location.search;
      
      // If no saved route exists, save the current route (user's first visit or cleared storage)
      if (!savedRoute) {
        const isAppRoute = location.pathname.startsWith("/dashboard") || 
                          location.pathname.startsWith("/account") ||
                          location.pathname.startsWith("/dataset");
        
        if (isAppRoute && location.pathname !== "/auth") {
          try {
            localStorage.setItem(ROUTE_STORAGE_KEY, currentRoute);
            hasRestored.current = true;
            return;
          } catch (error) {
            console.warn("Failed to save initial route:", error);
          }
        }
        hasRestored.current = true;
        return;
      }
      
      // Always restore if we have a saved route that's different from current
      // This handles the case where user refreshes on a sub-route
      if (savedRoute !== currentRoute) {
        // Validate that saved route is a valid app route
        const isSavedRouteValid = 
          savedRoute.startsWith("/dashboard") || 
          savedRoute.startsWith("/account") || 
          savedRoute.startsWith("/dataset");
        
        // Check if current route is a default/landing route that should be replaced
        const isDefaultRoute = 
          location.pathname === "/dashboard" || 
          location.pathname === "/" ||
          location.pathname === "/auth";
        
        // Check if current route is a valid app route
        const isCurrentRouteValid = 
          location.pathname.startsWith("/dashboard") || 
          location.pathname.startsWith("/account") || 
          location.pathname.startsWith("/dataset");
        
        // Restore if saved route is valid and different from current
        // This handles all cases:
        // - User refreshes on /dashboard/projects → stays on /dashboard/projects (routes match, no restore needed)
        // - User refreshes but React Router redirects to /dashboard → restore to /dashboard/projects
        // - User is on default route but has saved route → restore to saved route
        if (isSavedRouteValid) {
          console.log("[RoutePersistence] Checking route restore:", { 
            savedRoute, 
            currentRoute, 
            isDefaultRoute, 
            isCurrentRouteValid,
            shouldRestore: isDefaultRoute || !isCurrentRouteValid || savedRoute !== currentRoute
          });
          
          // Restore if:
          // 1. We're on a default route (should always restore)
          // 2. Current route is not valid (might have been redirected)
          // 3. Saved route is different from current (user was on different route)
          if (isDefaultRoute || !isCurrentRouteValid || savedRoute !== currentRoute) {
            hasRestored.current = true;
            navigate(savedRoute, { replace: true });
          } else {
            // Already on the correct route
            hasRestored.current = true;
          }
        } else {
          // Saved route is not valid, mark as restored
          hasRestored.current = true;
        }
      } else {
        // Routes match or no saved route - mark as restored
        hasRestored.current = true;
      }
    } catch (error) {
      console.warn("Failed to restore route from localStorage:", error);
      hasRestored.current = true;
    }
  }, [isSessionReady, location.pathname, location.search, navigate]);

  return null;
};

