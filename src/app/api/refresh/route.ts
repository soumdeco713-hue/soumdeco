import { NextRequest, NextResponse } from "next/server";

// Cloudflare edge runtime
export const runtime = "edge";

/**
 * POST /api/refresh — Same-domain proxy to Worker /refresh
 *
 * WHY THIS EXISTS:
 *   After admin saves a product, the admin's browser calls this endpoint
 *   to force the Worker to immediately sync fresh data from Google Apps
 *   Script into KV. Same-domain proxy because Algerian WiFi blocks *.workers.dev.
 *
 * SECURITY:
 *   The admin secret is hardcoded here (server-side only, never exposed
 *   to the client bundle). The frontend just calls POST /api/refresh with
 *   NO secret — this Pages Function adds the secret when forwarding to the Worker.
 */
export async function POST(_req: NextRequest) {
  const WORKER_URL = "https://soumdeco-data-sync.soumdeco713.workers.dev";
  const ADMIN_SECRET = "dimou2411@dz"; // Must match Worker's ADMIN_SECRET

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
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${WORKER_URL}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": ADMIN_SECRET,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, { status: 200, headers: noStore });
    }

    // Worker responded with non-200 — surface the actual error
    if (res.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          synced: false,
          error: "unauthorized",
          message: "Secret admin incorrect — vérifiez la configuration.",
        },
        { status: 200, headers: noStore },
      );
    }

    // Try to parse Worker error response
    try {
      const errBody = await res.json();
      if (errBody?.error === "rate_limited") {
        // Rate limit is OK — KV was recently updated, so the goal is achieved.
        return NextResponse.json(
          {
            ok: true,
            synced: true,
            message: "Synchronisation récente — données à jour.",
          },
          { status: 200, headers: noStore },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          synced: false,
          error: errBody?.error || "worker_error",
          message: errBody?.error || "Erreur Worker.",
        },
        { status: 200, headers: noStore },
      );
    } catch {
      // Body wasn't JSON — return generic error
      return NextResponse.json(
        {
          ok: false,
          synced: false,
          error: "worker_unreachable",
          message: "Le Worker de synchronisation est injoignable.",
        },
        { status: 200, headers: noStore },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        synced: false,
        error: "proxy_exception",
        message: String((err as Error)?.message || err).substring(0, 200),
      },
      { status: 200, headers: noStore },
    );
  }
}

/**
 * GET /api/refresh — returns a friendly status message (POST is the trigger)
 */
export async function GET() {
  return NextResponse.json(
    { ok: false, message: "Utilisez POST pour déclencher la synchronisation." },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      },
    },
  );
}
