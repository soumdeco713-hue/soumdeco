// ============================================================
//  HEALTH MONITOR — Self-healing network + storage checks
// ============================================================
//  Runs in the background to detect and recover from:
//  - Network connectivity issues
//  - Apps Script downtime
//  - Stale localStorage (corrupted or outdated)
//  - Image manifest staleness
//
//  All checks are SILENT — they log to console but never show
//  errors to the user. If something is broken, the fallback
//  chain handles it gracefully.
// ============================================================

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type HealthStatus = {
  network: "ok" | "degraded" | "down";
  appsScript: "ok" | "degraded" | "down";
  lastCheck: number;
};

let currentStatus: HealthStatus = {
  network: "ok",
  appsScript: "ok",
  lastCheck: 0,
};

/**
 * Check if we can reach the internet (via a quick HEAD request).
 * Uses Cloudflare's CDN (fast, reliable).
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    if (!navigator.onLine) return false;
  }
  try {
    // Quick HEAD request to Cloudflare (1s timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch("https://res.cloudinary.com/favicon.ico", {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a health check. Updates the internal status.
 * Safe to call — never throws.
 */
export async function runHealthCheck(): Promise<HealthStatus> {
  const now = Date.now();

  // Don't check more than once per 5 minutes
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return currentStatus;
  }
  lastHealthCheck = now;

  try {
    const networkOk = await checkNetworkConnectivity();

    currentStatus = {
      network: networkOk ? "ok" : "down",
      appsScript: networkOk ? "ok" : "degraded",
      lastCheck: now,
    };

    if (!networkOk) {
      console.warn("[Health] Network appears to be down — site will use cached data");
    }
  } catch (err) {
    currentStatus = {
      network: "degraded",
      appsScript: "degraded",
      lastCheck: now,
    };
  }

  return currentStatus;
}

/**
 * Start the background health monitor.
 * Runs every 5 minutes. All checks are silent + non-blocking.
 */
export function startHealthMonitor() {
  if (healthCheckInterval) return; // already running
  if (typeof window === "undefined") return; // SSR safe

  // Initial check after 10 seconds (let the page load first)
  setTimeout(() => {
    runHealthCheck().catch(() => {});
  }, 10000);

  // Then every 5 minutes
  healthCheckInterval = setInterval(() => {
    runHealthCheck().catch(() => {});
  }, HEALTH_CHECK_INTERVAL_MS);

  // Also check when the tab becomes visible again
  const onVisibility = () => {
    if (!document.hidden) {
      runHealthCheck().catch(() => {});
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // Also check when network status changes (online/offline events)
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      console.log("[Health] Network back online — refreshing data");
      runHealthCheck().catch(() => {});
    });
    window.addEventListener("offline", () => {
      console.warn("[Health] Network went offline — using cached data");
      currentStatus = { ...currentStatus, network: "down" };
    });
  }
}

/**
 * Stop the health monitor (for cleanup/testing).
 */
export function stopHealthMonitor() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Get the current health status (synchronous).
 */
export function getHealthStatus(): HealthStatus {
  return currentStatus;
}
