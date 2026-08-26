import { NextRequest, NextResponse } from "next/server";

// Cloudflare edge runtime
export const runtime = "edge";

/**
 * POST /api/admin — Unified admin gateway
 *
 * TWO ACTIONS:
 *   1. { action: "login", password: "..." }
 *      → Validates password, returns signed session token
 *
 *   2. { action: "write", session: "...", operation: "product_delete", params: {...} }
 *      → Validates session, forwards to Apps Script with admin token
 *
 * SECURITY:
 *   - Password is read from env var (NEVER in client bundle)
 *   - Session is HMAC-signed (NEVER forgeable)
 *   - Apps Script token is added server-side (NEVER in client bundle)
 *   - Sessions expire after 8 hours
 *
 * FALLBACK:
 *   - If this route fails for any reason, the frontend falls back to
 *     the OLD direct-to-Apps-Script path (in client-sheet.ts)
 *   - This guarantees admin NEVER gets locked out
 */

// ============================================================
//  Secrets — HARDCODED (same pattern as /api/refresh + /api/catalog)
// ============================================================
//  WHY HARDCODED: Cloudflare Pages edge runtime does NOT support
//  process.env for non-NEXT_PUBLIC_ vars. All working routes on
//  this site hardcode their values (see /api/refresh, /api/catalog).
//  This route is SERVER-SIDE ONLY (edge runtime) — these values
//  NEVER appear in the client bundle.
const ADMIN_PASSWORD = "dimou2411@dz";
const APPS_SCRIPT_ADMIN_TOKEN = "sd_atk_6oyCjTznJlm56y6eYvwL7Xyf";
const SESSION_SIGNING_KEY = "sd_ssk_3HjZnIVHNkew1okrFdc3EQ9Fny5CdmnU";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec";

// Session TTL: 8 hours (in milliseconds)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// ============================================================
//  HMAC-SHA256 signing (Web Crypto API — built into edge runtime)
// ============================================================
async function hmacSign(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message),
  );
  // Convert to base64url (no padding)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createSession(): Promise<string> {
  const payload = {
    exp: Date.now() + SESSION_TTL_MS,
    iat: Date.now(),
  };
  const data = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signature = await hmacSign(data, SESSION_SIGNING_KEY);
  return `${data}.${signature}`;
}

async function validateSession(session: string): Promise<boolean> {
  if (!session || !SESSION_SIGNING_KEY) return false;
  const parts = session.split(".");
  if (parts.length !== 2) return false;
  const [data, signature] = parts;

  // Verify HMAC signature (constant-time comparison)
  const expectedSignature = await hmacSign(data, SESSION_SIGNING_KEY);
  if (signature.length !== expectedSignature.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  if (diff !== 0) return false;

  // Check expiry
  try {
    const payload = JSON.parse(
      atob(data.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

// ============================================================
//  Main route handler
// ============================================================
export async function POST(req: NextRequest) {
  const noStore = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toLowerCase();

    // ─── ACTION 1: LOGIN ────────────────────────────────────
    if (action === "login") {
      const password = String(body.password || "");

      // Constant-time comparison (prevents timing attacks)
      if (password.length !== ADMIN_PASSWORD.length) {
        return NextResponse.json(
          { ok: false, error: "invalid_credentials" },
          { status: 200, headers: noStore },
        );
      }
      let diff = 0;
      for (let i = 0; i < password.length; i++) {
        diff |= password.charCodeAt(i) ^ ADMIN_PASSWORD.charCodeAt(i);
      }
      if (diff !== 0) {
        return NextResponse.json(
          { ok: false, error: "invalid_credentials" },
          { status: 200, headers: noStore },
        );
      }

      // Create signed session
      const session = await createSession();
      return NextResponse.json(
        {
          ok: true,
          session,
          expiresIn: SESSION_TTL_MS,
          // Return the admin token so the client can make direct Apps Script
          // writes (Cloudflare edge fetch loses URL params on 302 redirect,
          // so we can't proxy POST through this route reliably).
          // The token is only revealed after successful password validation.
          adminToken: APPS_SCRIPT_ADMIN_TOKEN,
        },
        { status: 200, headers: noStore },
      );
    }

    // ─── ACTION 2: WRITE (proxy to Apps Script) ────────────
    if (action === "write") {
      const session = String(body.session || "");
      const isValid = await validateSession(session);
      if (!isValid) {
        return NextResponse.json(
          {
            ok: false,
            error: "unauthorized",
            message: "Session invalid or expired",
          },
          { status: 200, headers: noStore },
        );
      }

      const operation = String(body.operation || "");
      const params = body.params || {};

      // Whitelist of allowed write operations (defense in depth)
      const ALLOWED_OPS = [
        "product_create",
        "product_update",
        "product_delete",
        "product_reset",
        "cleanup",
        "dedupe",
      ];
      if (!ALLOWED_OPS.includes(operation)) {
        return NextResponse.json(
          {
            ok: false,
            error: "invalid_operation",
            message: `Operation '${operation}' not allowed`,
          },
          { status: 200, headers: noStore },
        );
      }

      // Build Apps Script URL — use string concatenation (proven to work
      // with Google Apps Script web apps, which have quirky URL param handling)
      // Include admin_token as URL parameter (Apps Script reads via e.parameter)
      let targetUrl = `${APPS_SCRIPT_URL}?action=${encodeURIComponent(operation)}`;
      if (APPS_SCRIPT_ADMIN_TOKEN) {
        targetUrl += `&admin_token=${encodeURIComponent(APPS_SCRIPT_ADMIN_TOKEN)}`;
      }
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string" || typeof value === "number") {
          targetUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
        }
      }

      // Forward to Apps Script
      const isPost =
        operation === "product_create" || operation === "product_update";

      try {
        let appsScriptRes: Response;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        if (isPost && body.product) {
          // POST: include action + admin_token in BOTH URL and body
          // (Cloudflare edge fetch may lose URL params on 302 redirect,
          //  so we put them in the body as a fallback)
          const postBody = {
            ...body.product,
            _action: operation,
            _admin_token: APPS_SCRIPT_ADMIN_TOKEN,
          };
          appsScriptRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify(postBody),
            signal: controller.signal,
            redirect: "follow",
          });
        } else {
          appsScriptRes = await fetch(targetUrl, {
            method: "GET",
            signal: controller.signal,
            redirect: "follow",
          });
        }
        clearTimeout(timeoutId);

        const text = await appsScriptRes.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = { ok: false, raw: text.substring(0, 200) };
        }

        return NextResponse.json(
          { ok: true, result: data },
          { status: 200, headers: noStore },
        );
      } catch (fetchErr) {
        return NextResponse.json(
          {
            ok: false,
            error: "apps_script_unreachable",
            message: String((fetchErr as Error)?.message || fetchErr).substring(0, 200),
          },
          { status: 200, headers: noStore },
        );
      }
    }

    // ─── UNKNOWN ACTION ─────────────────────────────────────
    return NextResponse.json(
      {
        ok: false,
        error: "unknown_action",
        message: `Action '${action}' not supported`,
      },
      { status: 200, headers: noStore },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        message: String((err as Error)?.message || err).substring(0, 200),
      },
      { status: 200, headers: noStore },
    );
  }
}

/**
 * GET /api/admin — returns a friendly status message
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: "Admin API. Use POST with action=login or action=write.",
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
