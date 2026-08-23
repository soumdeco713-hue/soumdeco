import { NextResponse } from "next/server";
import {
  getServerWorkerUrl,
  fetchWithTimeout,
  noStoreHeaders,
} from "@/lib/worker-server";

// Cloudflare edge runtime — must be edge for env var access + fetch
export const runtime = "edge";

// NEVER cache this response — version must be fresh on every poll
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/version
 *
 * Same-domain proxy to the standalone Worker's ?action=version endpoint.
 *
 * WHY THIS EXISTS:
 *   The frontend polls this endpoint every 5 minutes (when tab is visible)
 *   to check if the catalog changed. The response is tiny (~8 bytes: {v:1234567890}).
 *   If the version matches the last known version, the frontend SKIPS the
 *   full catalog fetch (saving ~70KB per poll = 80% quota reduction).
 *
 *   Same-domain proxy because Algerian WiFi blocks *.workers.dev DNS.
 *
 * WHAT IT DOES:
 *   - Fetches {WORKER_URL}/?action=version with a 3s timeout
 *   - Returns {v: <timestamp>} (the Worker's lastChange timestamp)
 *   - On failure, returns {v: 0} (treated as "Worker blocked — fetch full catalog")
 *
 * CACHE BUSTING:
 *   We set Cache-Control: no-store AND Cloudflare-CDN-Cache-Control: no-store
 *   to ensure Cloudflare's edge cache NEVER serves stale version numbers.
 *   The frontend also sends ?_t=${Date.now()} as a cache-buster.
 */
export async function GET() {
  const workerUrl = getServerWorkerUrl();

  try {
    const res = await fetchWithTimeout(
      `${workerUrl}/?action=version`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      3000, // 3s timeout — version endpoint is tiny and should be instant
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

    // Worker failed — return v:0 (signals frontend to fetch full catalog)
    return NextResponse.json(
      { v: 0, error: "worker_unreachable" },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (err) {
    return NextResponse.json(
      { v: 0, error: "proxy_exception" },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  }
}
