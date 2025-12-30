// Utility helpers for persisting and restoring the last visited protected route

const STORAGE_KEY = "visionm_last_route";

/** Save the last visited route path (including search/hash) */
export function saveLastRoute(path: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, path);
  } catch (error) {
    console.error("[routePersistence] Failed to save last route:", error);
  }
}

/** Get the last visited route path if available */
export function getLastRoute(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored || null;
  } catch (error) {
    console.error("[routePersistence] Failed to get last route:", error);
    return null;
  }
}

/** Optional helper in case we want to clear route on logout */
export function clearLastRoute() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("[routePersistence] Failed to clear last route:", error);
  }
}

