// ============================================================
//  CLIENT-SIDE SHEET API — Bulletproof Edition
// ============================================================
//  Direct browser → Google Apps Script communication.
//  This bypasses the Cloudflare Pages edge API routes entirely,
//  which return 500 errors on Cloudflare's edge runtime
//  (Next.js 16 edge runtime is deprecated and has issues
//  with @cloudflare/next-on-pages v1).
//
//  All public read/write operations go directly from the browser
//  to the Apps Script web app. This is:
//   - Faster (one less network hop)
//   - More reliable (no edge runtime issues)
//   - Simpler (no API route middleware)
//   - Safe (Apps Script is the source of truth, public for reads)
//
//  Admin operations (create/update/delete) also go directly,
//  with image uploads to Cloudinary (unsigned) done client-side.
//
//  ERROR HANDLING:
//  - All fetches have a 30s timeout (AbortController)
//  - Reads retry up to 3 times with exponential backoff
//  - Writes retry up to 2 times (to avoid duplicate orders)
//  - Image uploads NEVER fall back to base64 (would overflow the sheet)
//    — failed uploads return an empty string and are skipped
// ============================================================

import { getClientSheetBaseUrl, type SheetProduct } from "./sheet";

// Fetch timeout — 10 seconds (was 30s which caused "stuck at loading")
// If Apps Script doesn't respond in 10s, we fall back to cached/seed data
const DEFAULT_TIMEOUT_MS = 10_000;

// Retry configuration for read operations (products, stock)
// Reduced from 3 to 2 retries — faster fallback to cached data
const READ_RETRIES = 2;
const READ_RETRY_DELAY_MS = 1000;

// Retry configuration for write operations (product create/update/delete)
const WRITE_RETRIES = 2;
const WRITE_RETRY_DELAY_MS = 2000;

// Image upload configuration
const IMAGE_UPLOAD_TIMEOUT_MS = 45_000; // Cloudinary can be slow for large images
const MAX_IMAGE_RETRIES = 2;

/**
 * Wraps a fetch call with:
 *  - AbortController timeout
 *  - Configurable retry with exponential backoff
 *  - Proper error logging
 *
 * Returns the Response on success, throws on final failure.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  retries: number = 0,
  retryDelayMs: number = 1500,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return res;
      }
      // Retry on 5xx and 429
      if (res.status >= 500 || res.status === 429) {
        if (attempt < retries) {
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      // AbortError = timeout, network error = fetch failed
      if (attempt < retries) {
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error("fetch failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
//  ADMIN SESSION — stored in sessionStorage after login
// ============================================================
//  The session is a signed token (HMAC) issued by /api/admin.
//  It's stored in sessionStorage (not localStorage) so it clears
//  when the browser closes — better security.
const ADMIN_SESSION_KEY = "soumdeco_admin_session";
const ADMIN_SESSION_TIMESTAMP_KEY = "soumdeco_admin_session_ts";
const ADMIN_TOKEN_KEY = "soumdeco_admin_token";
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours (matches server)

/** Get the admin session token (or null if not logged in / expired). */
function getAdminSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    const tsStr = window.sessionStorage.getItem(ADMIN_SESSION_TIMESTAMP_KEY);
    if (!session || !tsStr) return null;
    const ts = parseInt(tsStr, 10);
    if (isNaN(ts) || Date.now() - ts > ADMIN_SESSION_MAX_AGE_MS) {
      // Session expired — clean up
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.sessionStorage.removeItem(ADMIN_SESSION_TIMESTAMP_KEY);
      window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/** Get the admin token (returned by /api/admin after successful login).
 *  Used for direct Apps Script writes (browser fetch handles 302 redirect
 *  correctly, unlike Cloudflare edge runtime fetch). */
function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

/** Save the admin session token + admin token (called after successful login). */
export function setAdminSession(session: string, adminToken?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, session);
    window.sessionStorage.setItem(ADMIN_SESSION_TIMESTAMP_KEY, String(Date.now()));
    if (adminToken) {
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    }
  } catch {
    // sessionStorage might be full — ignore
  }
}

/** Clear the admin session (called on logout). */
export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.sessionStorage.removeItem(ADMIN_SESSION_TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}

/** Check if admin is currently logged in (has valid session). */
export function isAdminLoggedIn(): boolean {
  return getAdminSession() !== null;
}

/**
 * Login to admin panel via /api/admin route.
 * Returns true on success, false on failure.
 *
 * SECURITY: The password is sent to /api/admin (server-side) for validation.
 * The server returns a signed session token. The password is NEVER stored.
 */
export async function clientAdminLogin(password: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeoutAndRetry(
      "/api/admin",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", password }),
      },
      DEFAULT_TIMEOUT_MS,
      0, // no retry — login is sensitive
      0,
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data.ok && data.session) {
      setAdminSession(data.session, data.adminToken);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[clientAdminLogin] failed:", err);
    return false;
  }
}

/**
 * Admin write operation — routes through /api/admin (server-side).
 * Falls back to direct Apps Script call if /api/admin fails (backwards compat).
 *
 * SECURITY: The admin token is added by the server (NEVER in client bundle).
 */
async function adminWrite(
  operation: string,
  params: Record<string, string | number> = {},
  product?: SheetProduct,
): Promise<{ ok: boolean; data?: any }> {
  const session = getAdminSession();
  if (!session) {
    return { ok: false };
  }

  try {
    const body: any = { action: "write", session, operation, params };
    if (product) body.product = product;

    const res = await fetchWithTimeoutAndRetry(
      "/api/admin",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      DEFAULT_TIMEOUT_MS,
      WRITE_RETRIES,
      WRITE_RETRY_DELAY_MS,
    );
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: data.ok === true, data: data.result };
  } catch (err) {
    console.error(`[adminWrite ${operation}] failed:`, err);
    return { ok: false };
  }
}

/**
 * Fetch all products directly from Google Apps Script.
 * Returns an array of SheetProduct (already normalized + deduplicated by ID).
 * Falls back to an empty array on error (after all retries exhausted).
 */
export async function clientListProducts(): Promise<SheetProduct[]> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=products`;
    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow", cache: "no-store" },
      DEFAULT_TIMEOUT_MS,
      READ_RETRIES,
      READ_RETRY_DELAY_MS,
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Deduplicate by ID (sheet sometimes has duplicate rows)
    const seen = new Set<string>();
    const unique: SheetProduct[] = [];
    for (const raw of data) {
      const p = normalizeSheetProduct(raw);
      const id = String(p.id || "").trim();
      if (!id || seen.has(id)) continue;
      // Skip guidance rows (emoji/Arabic in ID)
      if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(id)) continue;
      seen.add(id);
      unique.push(p);
    }
    return unique;
  } catch (err) {
    console.error("[clientListProducts] failed:", err);
    return [];
  }
}

/**
 * Fetch the Stock tab as CSV directly from Google Apps Script.
 */
export async function clientGetStockCsv(): Promise<string> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=stock`;
    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow", cache: "no-store" },
      DEFAULT_TIMEOUT_MS,
      READ_RETRIES,
      READ_RETRY_DELAY_MS,
    );
    if (!res.ok) return "";
    return await res.text();
  } catch (err) {
    console.error("[clientGetStockCsv] failed:", err);
    return "";
  }
}

/**
 * Create or update a product directly via Apps Script POST.
 * The body is JSON-encoded and sent as text/plain (Apps Script
 * requirement to avoid CORS preflight).
 *
 * Returns true on success, false on failure (after retries).
 */
/**
 * Create or update a product.
 * Uses the admin token (received during login) for direct Apps Script writes.
 * Browser fetch handles 302 redirect correctly (unlike Cloudflare edge runtime).
 *
 * SECURITY: The admin token is only revealed after successful password
 * validation via /api/admin. It's stored in sessionStorage (not localStorage).
 */
export async function clientUpsertProduct(
  product: SheetProduct,
): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  const adminToken = getAdminToken();

  // Build URL with admin_token (browser fetch preserves URL params on redirect)
  let url = `${base}?action=product_create`;
  if (adminToken) {
    url += `&admin_token=${encodeURIComponent(adminToken)}`;
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      url,
      {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(product),
      },
      DEFAULT_TIMEOUT_MS,
      WRITE_RETRIES,
      WRITE_RETRY_DELAY_MS,
    );
    // Apps Script POST returns 302 → 405 after redirect, but the product
    // IS saved before the redirect. Treat 200, 302, 405 as success.
    return res.ok || res.status === 302 || res.status === 405;
  } catch (err) {
    console.error("[clientUpsertProduct] failed:", err);
    return false;
  }
}

/**
 * Delete a product.
 * Uses admin token for direct Apps Script write.
 */
export async function clientDeleteProduct(id: string): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  const adminToken = getAdminToken();

  let url = `${base}?action=product_delete&id=${encodeURIComponent(id)}`;
  if (adminToken) {
    url += `&admin_token=${encodeURIComponent(adminToken)}`;
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow" },
      DEFAULT_TIMEOUT_MS,
      WRITE_RETRIES,
      WRITE_RETRY_DELAY_MS,
    );
    return res.ok;
  } catch (err) {
    console.error("[clientDeleteProduct] failed:", err);
    return false;
  }
}

/**
 * Reset all products.
 * Uses admin token for direct Apps Script write.
 */
export async function clientResetProducts(): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  const adminToken = getAdminToken();

  let url = `${base}?action=product_reset`;
  if (adminToken) {
    url += `&admin_token=${encodeURIComponent(adminToken)}`;
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow" },
      DEFAULT_TIMEOUT_MS,
      WRITE_RETRIES,
      WRITE_RETRY_DELAY_MS,
    );
    return res.ok;
  } catch (err) {
    console.error("[clientResetProducts] failed:", err);
    return false;
  }
}

/**
 * Run the dedupe + cleanup action on the sheet.
 * Uses admin token for direct Apps Script write.
 */
export async function clientDedupeProducts(): Promise<{
  ok: boolean;
  removed?: number;
  fixed_categories?: number;
  remaining?: number;
}> {
  const base = getClientSheetBaseUrl();
  const adminToken = getAdminToken();

  let url = `${base}?action=dedupe`;
  if (adminToken) {
    url += `&admin_token=${encodeURIComponent(adminToken)}`;
  }

  try {
    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow" },
      DEFAULT_TIMEOUT_MS,
      0, // no retry — this is a one-time operation
      0,
    );
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[clientDedupeProducts] failed:", err);
    return { ok: false };
  }
}

/**
 * Upload a single base64 image to Cloudinary (unsigned upload).
 * Non-data URLs (already-uploaded Cloudinary URLs) are returned as-is.
 *
 * CRITICAL: On failure, returns an EMPTY STRING (not the base64 data URL).
 * Returning base64 would overflow the Google Sheet cell limit (50K chars)
 * and cause Apps Script to throw, silently failing the product save.
 */
export async function clientUploadImage(
  dataUrl: string,
  filename: string,
): Promise<string> {
  // Non-data URLs (already on Cloudinary) — return as-is
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const CLOUD_NAME =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ||
    "anhvhy4j";
  const UPLOAD_PRESET =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) ||
    "soumdeco";

  if (!CLOUD_NAME) {
    console.error("[clientUploadImage] No Cloudinary cloud name configured");
    return "";
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_IMAGE_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      IMAGE_UPLOAD_TIMEOUT_MS,
    );

    try {
      const formData = new FormData();
      formData.append("file", dataUrl);
      formData.append("upload_preset", UPLOAD_PRESET);
      // Note: public_id is optional for unsigned uploads. Only include it
      // if the preset allows it. If it causes a 400, the retry will fail
      // and we'll return "" (skip this image).
      formData.append("public_id", filename);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(
          `[clientUploadImage] Cloudinary rejected ${res.status}:`,
          errText.substring(0, 200),
        );
        // Don't retry on 400 (bad request — public_id not allowed, invalid image, etc.)
        if (res.status === 400) {
          // Try once more without public_id (some presets don't allow it)
          if (attempt === 0) {
            const formData2 = new FormData();
            formData2.append("file", dataUrl);
            formData2.append("upload_preset", UPLOAD_PRESET);
            // Use a FRESH AbortController + clean timeout (no leaked handles)
            const controller2 = new AbortController();
            const timeout2 = setTimeout(
              () => controller2.abort(),
              IMAGE_UPLOAD_TIMEOUT_MS,
            );
            try {
              const res2 = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                  method: "POST",
                  body: formData2,
                  signal: controller2.signal,
                },
              );
              if (res2.ok) {
                const data2 = await res2.json();
                if (data2.secure_url) return data2.secure_url;
              }
            } catch {} finally {
              clearTimeout(timeout2);
            }
          }
          return ""; // skip this image
        }
        lastError = new Error(`Cloudinary ${res.status}`);
        if (attempt < MAX_IMAGE_RETRIES) {
          await sleep(1500 * Math.pow(2, attempt));
          continue;
        }
        return "";
      }

      const data = await res.json();
      if (data.secure_url) return data.secure_url;

      console.error("[clientUploadImage] No secure_url in response:", data);
      return "";
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;
      console.error(
        `[clientUploadImage] attempt ${attempt + 1} failed:`,
        err,
      );
      if (attempt < MAX_IMAGE_RETRIES) {
        await sleep(1500 * Math.pow(2, attempt));
        continue;
      }
      return "";
    }
  }

  console.error(
    "[clientUploadImage] All retries exhausted:",
    lastError?.message,
  );
  return "";
}

/**
 * Upload multiple images to Cloudinary client-side.
 * Replaces base64 data URLs with Cloudinary URLs.
 * Failed uploads are SKIPPED (returned as empty strings, then filtered out).
 *
 * Uses limited parallelism (2 at a time) for speed without overwhelming
 * Cloudinary's rate limits.
 */
export async function clientUploadImages(
  images: string[],
  productId: string,
): Promise<string[]> {
  const results: string[] = [];

  // Process images with limited parallelism (2 at a time)
  for (let i = 0; i < images.length; i += 2) {
    const batch = images.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map((img, j) => {
        if (!img || !img.startsWith("data:")) {
          // Already a URL — return as-is
          return Promise.resolve(img);
        }
        return clientUploadImage(img, `${productId}-${i + j + 1}`);
      }),
    );
    results.push(...batchResults);
  }

  // Filter out empty strings (failed uploads) — don't save them to the sheet
  return results.filter((url) => url && url.trim() !== "");
}

/**
 * Submit an order directly to Apps Script.
 * Uses GET with URL params (Apps Script doGet handles this).
 * Returns true on success, false on failure.
 *
 * This is the BULLETPROOF order submission — no `no-cors` mode
 * (which would hide failures). Uses real CORS mode so we can
 * detect success/failure.
 */
export async function clientSubmitOrder(payload: {
  product: string;
  quantity: string;
  price: number | null;
  shippingPrice: number;
  grandTotal: number;
  shippingCompanyLabel: string;
  fullName: string;
  phone: string;
  wilaya: string;
  commune: string;
  deliveryLabel: string;
  notes: string;
  /** Optional variant name (e.g., "Red" or "Red - Large") — written to the
   *  Variant column in the Orders sheet. */
  variant?: string;
  /** The EXACT Stock tab entry name for variant stock tracking.
   *  Built by the frontend as: "ProductName - VariantName"
   *  Only set for variants that have |stock in the variants string.
   *  Used by the SUMIFS formula in the Stock tab to auto-decrement on "Confirmed". */
  stockKey?: string;
}): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  try {
    const params = new URLSearchParams();
    params.set("action", "order");
    params.set("product", (payload.product || "").substring(0, 200));
    params.set("quantity", String(payload.quantity || "1"));
    params.set(
      "price",
      payload.price === null || payload.price === undefined
        ? ""
        : String(payload.price),
    );
    params.set("shippingPrice", String(payload.shippingPrice ?? 0));
    params.set("grandTotal", String(payload.grandTotal ?? 0));
    params.set(
      "shippingCompanyLabel",
      (payload.shippingCompanyLabel || "").substring(0, 50),
    );
    params.set("fullName", (payload.fullName || "").substring(0, 100));
    params.set("phone", (payload.phone || "").substring(0, 20));
    params.set("wilaya", (payload.wilaya || "").substring(0, 50));
    params.set("commune", (payload.commune || "").substring(0, 50));
    params.set("deliveryLabel", (payload.deliveryLabel || "").substring(0, 50));
    params.set("notes", (payload.notes || "").substring(0, 200));

    // ============================================================
    //  VARIANT EXTRACTION — extract variant from product name
    //  and send as separate URL param for the new Variant column.
    //
    //  Product names look like:
    //    "Cocotte (اللون: Red) ×1" → variant = "Red"
    //    "Product (المقاس: 10L) ×2" → variant = "10L"
    //    "Simple Product ×1" → variant = "" (no variant)
    //
    //  NOTE: The product name includes " ×N" at the end (quantity).
    //  We must strip that FIRST, then extract the variant from
    //  the parentheses.
    // ============================================================
    let variantParam = payload.variant || "";
    // If variant wasn't passed from the form, extract it from the product name
    if (!variantParam && payload.product) {
      // Strip " ×N" suffix first (e.g., "Product (variant) ×1" → "Product (variant)")
      const stripped = payload.product.replace(/\s*[×x]\s*\d+\s*$/, "").trim();
      // Now extract variant from parentheses
      const variantMatch = stripped.match(/\(([^)]+)\)\s*$/);
      if (variantMatch) {
        const variantContent = variantMatch[1].trim();
        const variantParts = variantContent.split("·");
        const extractedValues: string[] = [];
        for (const part of variantParts) {
          const trimmed = part.trim();
          const colonIdx = trimmed.lastIndexOf(":");
          if (colonIdx >= 0) {
            const value = trimmed.substring(colonIdx + 1).trim();
            if (value) extractedValues.push(value);
          } else if (trimmed) {
            extractedValues.push(trimmed);
          }
        }
        variantParam = extractedValues.join(" - ");
      }
    }
    params.set("variant", variantParam.substring(0, 100));
    params.set("stockKey", (payload.stockKey || "").substring(0, 200));

    const url = `${base}?${params.toString()}`;

    // ============================================================
    //  CRITICAL: ZERO RETRIES FOR ORDERS
    // ============================================================
    //  Google Apps Script does NOT support idempotency — every request
    //  creates a new row in the Sheet. If the first request succeeds but
    //  the response is slow/times out, retrying would create DUPLICATE
    //  rows in the sheet (this caused real duplicate orders in production).
    //
    //  Fix: Send ONCE. If it fails, return false — the failed-orders
    //  retry queue (failed-orders.ts) will retry ONCE on next page visit.
    //  This guarantees no more than 2 rows can ever be created per order:
    //    1. Initial attempt (this call)
    //    2. Retry queue attempt (next page visit, only if #1 failed)
    // ============================================================
    const ORDER_RETRIES = 0; // NO RETRIES for orders (prevents duplicates)

    // Check URL length — if too long, fall back to POST (which Apps Script
    // also handles via doPost → doGet redirect)
    if (url.length > 2000) {
      // Use POST with text/plain body (avoids CORS preflight)
      const res = await fetchWithTimeoutAndRetry(
        base,
        {
          method: "POST",
          redirect: "follow",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "order", ...payload }),
        },
        DEFAULT_TIMEOUT_MS,
        ORDER_RETRIES,
        0,
      );
      return res.ok;
    }

    const res = await fetchWithTimeoutAndRetry(
      url,
      { method: "GET", redirect: "follow" },
      DEFAULT_TIMEOUT_MS,
      ORDER_RETRIES,
      0,
    );
    return res.ok;
  } catch (err) {
    console.error("[clientSubmitOrder] failed:", err);
    return false;
  }
}

// ---------- internal ----------

function normalizeSheetProduct(p: any): SheetProduct {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    description: String(p.description ?? ""),
    category: String(p.category ?? ""),
    price:
      p.price === null ||
      p.price === undefined ||
      p.price === "" ||
      (typeof p.price === "object" && p.price !== null)
        ? null
        : Number(p.price),
    image: String(p.image ?? ""),
    images: String(p.images ?? ""),
    featured: (p.featured === true ||
               p.featured === 1 ||
               p.featured === "1" ||
               (typeof p.featured === "string" &&
                p.featured.toLowerCase() === "true")),
    isSpecialOffer: (p.isSpecialOffer === true ||
                     p.isSpecialOffer === 1 ||
                     p.isSpecialOffer === "1" ||
                     (typeof p.isSpecialOffer === "string" &&
                      p.isSpecialOffer.toLowerCase() === "true")),
    variations: String(p.variations ?? ""),
    variants: String(p.variants ?? ""),
    stock:
      p.stock === null ||
      p.stock === undefined ||
      p.stock === "" ||
      (typeof p.stock === "object" && p.stock !== null)
        ? null
        : Number(p.stock),
    highlights: String(p.highlights ?? ""),
    sortOrder: p.sortOrder === null || p.sortOrder === undefined ? 999 : Number(p.sortOrder),
    badge: String(p.badge ?? ""),
    oldPrice: p.oldPrice === null || p.oldPrice === undefined || p.oldPrice === "" ? null : Number(p.oldPrice),
    quantityTiers: String(p.quantityTiers ?? ""),
  };
}
