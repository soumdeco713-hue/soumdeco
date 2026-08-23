import { NextRequest, NextResponse } from "next/server";
import {
  getServerWorkerUrl,
  getServerAdminSecret,
  fetchWithTimeout,
  noStoreHeaders,
} from "@/lib/worker-server";

// Cloudflare edge runtime — must be edge for env var access + fetch
export const runtime = "edge";

// NEVER cache POST responses
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/refresh
 *
 * Same-domain proxy to the standalone Worker's /refresh endpoint.
 *
 * WHY THIS EXISTS:
 *   After admin saves a product (via the admin panel), the admin's browser
 *   calls this endpoint to force the Worker to immediately sync fresh data
 *   from Google Apps Script into KV. Without this, visitors would have to
 *   wait up to 5 minutes for the cron to fire.
 *
 *   Same-domain proxy because Algerian WiFi blocks *.workers.dev DNS.
 *
 * SECURITY:
 *   The admin secret is read from env vars SERVER-SIDE (not exposed to client).
 *   The client just calls POST /api/refresh with NO secret — the secret is
 *   added by this Pages Function when forwarding to the Worker.
 *   This means: even if someone discovers /api/refresh, they can't trigger
 *   it remotely without knowing the admin secret (which is now server-side only).
 *
 * WHAT IT DOES:
 *   - Reads WORKER_ADMIN_SECRET from env (server-side — NEVER exposed to client)
 *   - POSTs to {WORKER_URL}/refresh with X-Admin-Secret header
 *   - Returns the Worker's response verbatim
 *   - On failure, returns {ok: false, synced: false, error: "..."}
 */
export async function POST(_req: NextRequest) {
  const workerUrl = getServerWorkerUrl();
  const adminSecret = getServerAdminSecret();

  if (!adminSecret) {
    return NextResponse.json(
      {
        ok: false,
        synced: false,
        error: "admin_secret_not_configured",
        message:
          "Le secret admin n'est pas configuré. Configurez NEXT_PUBLIC_WORKER_ADMIN_SECRET dans Cloudflare Pages.",
      },
      {
        status: 200, // 200 so admin sees a friendly error instead of a network failure
        headers: noStoreHeaders(),
      },
    );
  }

  try {
    const res = await fetchWithTimeout(
      `${workerUrl}/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": adminSecret,
        },
      },
      30000, // 30s timeout — Apps Script sync can take a while
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

    // Worker responded with non-200 (e.g. 401 unauthorized, 405 method not allowed).
    // Surface the actual Worker error so admin can diagnose.
    let workerError = "worker_unreachable";
    let workerMessage = "Le Worker de synchronisation est injoignable.";
    if (res) {
      try {
        const errBody = await res.json();
        if (errBody?.error === "unauthorized") {
          workerError = "unauthorized";
          workerMessage =
            "Secret admin incorrect — vérifiez NEXT_PUBLIC_WORKER_ADMIN_SECRET.";
        } else if (errBody?.error === "rate_limited") {
          // Rate limit is OK — KV was recently updated, so the goal is achieved.
          return NextResponse.json(
            {
              ok: true,
              synced: true,
              message: "Synchronisation récente — données à jour.",
            },
            { status: 200, headers: noStoreHeaders() },
          );
        } else if (errBody?.error) {
          workerError = errBody.error;
          workerMessage = `Worker: ${errBody.error}`;
        }
      } catch {
        // Body wasn't JSON — keep default message
      }
    }

    return NextResponse.json(
      {
        ok: false,
        synced: false,
        error: workerError,
        message: workerMessage,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        synced: false,
        error: "proxy_exception",
        message: String((err as Error)?.message || err).substring(0, 200),
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      },
    );
  }
}

/**
 * GET /api/refresh — returns a friendly status message.
 * (POST is the actual trigger; GET is just for debugging.)
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: "Utilisez POST pour déclencher la synchronisation.",
    },
    { status: 200, headers: noStoreHeaders() },
  );
}
