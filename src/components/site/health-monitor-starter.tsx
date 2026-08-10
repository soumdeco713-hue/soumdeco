"use client";

import { useEffect } from "react";
import { startHealthMonitor } from "@/lib/health-monitor";

/**
 * HealthMonitorStarter — starts the background health monitor on app load.
 *
 * The monitor checks network connectivity + Apps Script availability every
 * 5 minutes. All checks are SILENT — they never show errors to the user.
 * If something is broken, the existing fallback chains handle it:
 *
 * - Network down → use cached localStorage/IndexedDB data
 * - Apps Script down → use cached catalog (last-known-good)
 * - Image 404 → fall back to Cloudinary
 * - localStorage full → fall back to IndexedDB
 * - Order submit fails → save to retry queue
 *
 * This component renders nothing — it's just for the side effect.
 */
export function HealthMonitorStarter() {
  useEffect(() => {
    startHealthMonitor();
  }, []);

  return null;
}
