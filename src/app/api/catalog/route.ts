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
 * CACHE BUSTING:
 *   We set Cache-Control: no-store AND Cloudflare-CDN-Cache-Control: no-store
 *   to ensure Cloudflare's edge cache NEVER serves stale responses.
 */
export async function GET() {
  const WORKER_URL = "https://soumdeco-data-sync.soumdeco713.workers.dev";

  const noStore = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
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
      return new NextResponse(text, { status: 200, headers: noStore });
    }
  } catch {
    // Fall through to error response
  }

  // Worker failed — return empty catalog so client falls through to
  // static JSON / localStorage / seed (NEVER throws).
  return NextResponse.json(
    { products: "[]", stock: "", ts: Date.now(), error: "worker_unreachable" },
    { status: 200, headers: noStore },
  );
}
