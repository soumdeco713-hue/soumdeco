import { NextResponse } from "next/server";

// Cloudflare edge runtime
export const runtime = "edge";

/**
 * GET /api/catalog — Same-domain proxy to Worker ?action=catalog
 *
 * WHY THIS EXISTS:
 *   The frontend fetches /api/catalog (NOT the Worker URL directly) because:
 *     1. Algerian WiFi networks block *.workers.dev DNS
 *     2. Same-domain requests avoid CORS issues entirely
 *
 * WHY HARDCODED URL:
 *   Reading process.env at runtime on Cloudflare Pages edge can be flaky.
 *   The Worker URL is public knowledge (it only reads from KV, no secrets).
 *   Hardcoding it ensures this route NEVER 500s due to env var issues.
 *
 * CACHING:
 *   The catalog data is already up to 5 minutes stale (Worker KV TTL).
 *   Edge-caching this response for 60 seconds (with 5-minute stale-while-revalidate)
 *   is perfectly safe — it means most visitors get served from Cloudflare's edge
 *   cache without hitting the Worker at all, saving Workers quota.
 *   The browser still gets fresh data on reload (max-age=0 forces revalidation).
 */
export async function GET() {
  const WORKER_URL = "https://soumdeco-data-sync.soumdeco713.workers.dev";

  const cacheHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    // Browser: always revalidate (don't use stale from browser cache)
    "Cache-Control": "no-cache, must-revalidate",
    // Cloudflare edge: cache for 60 seconds, serve stale for up to 5 minutes
    "CDN-Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    "Cloudflare-CDN-Cache-Control": "s-maxage=60, stale-while-revalidate=300",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${WORKER_URL}/?action=catalog`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, { status: 200, headers: cacheHeaders });
    }
  } catch {
    // Fall through to error response
  }

  // Worker failed — return empty catalog so client falls through to
  // static JSON / localStorage / seed (NEVER throws).
  return NextResponse.json(
    { products: "[]", stock: "", ts: Date.now(), error: "worker_unreachable" },
    { status: 200, headers: cacheHeaders },
  );
}
