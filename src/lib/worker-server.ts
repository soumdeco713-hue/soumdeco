// ============================================================
//  WORKER SERVER — Server-side config for Pages Function proxies
// ============================================================
//  These helpers are used ONLY by /api/catalog, /api/version, and
//  /api/refresh Next.js API routes (which run on the Cloudflare
//  Pages edge runtime).
//
//  They read the Worker URL + admin secret from env vars, with a
//  hardcoded fallback URL for bulletproofing (matches the pattern
//  in src/lib/sheet.ts for SHEET_BASE_URL).
//
//  WHY THIS EXISTS:
//  The frontend (worker-client.ts) calls /api/catalog etc. on the
//  SAME domain as the site (soumdeco.pages.dev) to bypass DNS
//  blocking on Algerian WiFi networks that block *.workers.dev.
//  These routes are Next.js API routes that simply proxy to the
//  standalone Worker — adding CORS-friendly same-domain access.
// ============================================================

// Hardcoded live Worker URL — guarantees the Worker is ALWAYS reachable
// even if env vars fail to inline at build time on Cloudflare Pages.
const FALLBACK_WORKER_URL = "https://soumdeco-data-sync.soumdeco713.workers.dev";

/**
 * Get the Worker URL for server-side use.
 * Priority: WORKER_URL > NEXT_PUBLIC_WORKER_URL > hardcoded fallback.
 */
export function getServerWorkerUrl(): string {
  const fromEnv =
    process.env.WORKER_URL ||
    process.env.NEXT_PUBLIC_WORKER_URL ||
    FALLBACK_WORKER_URL;
  return fromEnv.endsWith("/") ? fromEnv.slice(0, -1) : fromEnv;
}

/**
 * Get the admin secret for triggering Worker /refresh.
 * Priority: WORKER_ADMIN_SECRET > NEXT_PUBLIC_WORKER_ADMIN_SECRET.
 * Returns empty string if not set (refresh route will refuse).
 */
export function getServerAdminSecret(): string {
  return (
    process.env.WORKER_ADMIN_SECRET ||
    process.env.NEXT_PUBLIC_WORKER_ADMIN_SECRET ||
    ""
  );
}

/**
 * Fetch with timeout — never throws, returns null on failure.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Build no-store headers to prevent Cloudflare edge caching.
 * These are CRITICAL — without them, Cloudflare caches the response
 * and visitors see stale data even after the Worker writes fresh data to KV.
 */
export function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, max-age=0, stale-while-revalidate=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
  };
}
