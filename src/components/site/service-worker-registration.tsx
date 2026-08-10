"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistration — registers the service worker on app load.
 *
 * The service worker:
 * 1. Clears old cached versions on activation (fixes "stale site" issue)
 * 2. Serves static assets from cache (fast page loads)
 * 3. Always fetches fresh HTML from the network (no stale content)
 * 4. Falls back to cache if the network fails (offline support)
 *
 * This ensures the client ALWAYS sees the latest version of the site,
 * even if their browser has an old cached version.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register after the page loads (don't block initial render)
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // Registered successfully
        })
        .catch(() => {
          // Registration failed — site still works (just no offline support)
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
