import { NextResponse } from "next/server";
import {
  getServerWorkerUrl,
  fetchWithTimeout,
  noStoreHeaders,
} from "@/lib/worker-server";

// Cloudflare edge runtime — must be edge for env var access + fetch
export const runtime = "edge";

/**
 * GET /api/catalog
 *
 * Same-domain proxy to the standalone Worker's ?action=catalog endpoint.
 *
 * WHY THIS EXISTS:
 *   The frontend fetches /api/catalog (NOT the Worker URL directly) because:
 *     1. Algerian WiFi networks block *.workers.dev DNS
 *     2. Same-domain requests avoid CORS issues entirely
 *     3. The Pages Function runs on soumdeco.pages.dev (same origin as site)
 *
 * WHAT IT DOES:
 *   - Fetches {WORKER_URL}/?action=catalog with a 5s timeout
 *   - Returns the exact same JSON body with no-store headers
 *   - On failure, returns {products: "[]", stock: "", ts: now, error: "proxy_failed"}
 *     with HTTP 200 (so the client doesn't throw — it falls through to static JSON)
 *
 * CACHE BUSTING:
 *   We set Cache-Control: no-store AND Cloudflare-CDN-Cache-Control: no-store
 *   to ensure Cloudflare's edge cache NEVER serves stale responses.
 *   The frontend also sends ?_t=${Date.now()} as a cache-buster.
 */
export async function GET() {
  const workerUrl = getServerWorkerUrl();

  try {
    const res = await fetchWithTimeout(
      `${workerUrl}/?action=catalog`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      5000, // 5s timeout — Worker should respond in <100ms
    );

    if (res && res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...noStoreHeaders(),
        },
      });
    }
  } catch {
    // Fall through to error response
  }

  // Worker failed — return empty catalog so client falls through to
  // static JSON / localStorage / seed (NEVER throws).
  return NextResponse.json(
    {
      products: "[]",
      stock: "",
      ts: Date.now(),
      error: "worker_unreachable",
    },
    {
      status: 200, // 200 so client doesn't throw — it falls through cleanly
      headers: noStoreHeaders(),
    },
  );
}
