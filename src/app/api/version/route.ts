import { NextResponse } from "next/server";

// Cloudflare edge runtime
export const runtime = "edge";

/**
 * GET /api/version — Same-domain proxy to Worker ?action=version
 *
 * WHY THIS EXISTS:
 *   The frontend polls this endpoint every 5 min to check if the catalog
 *   changed. Same-domain proxy because Algerian WiFi blocks *.workers.dev.
 *
 * WHY HARDCODED URL:
 *   Reading process.env at runtime on Cloudflare Pages edge can be flaky.
 *   The Worker URL is public knowledge (it only reads from KV, no secrets).
 *   Hardcoding it ensures this route NEVER 500s due to env var issues.
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
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${WORKER_URL}/?action=version`, {
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

  // Worker failed — return v:0 (signals frontend to fetch full catalog)
  return NextResponse.json({ v: 0 }, { status: 200, headers: noStore });
}
