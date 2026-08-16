// ============================================================
//  SOUM DECO — Centralized Data Sync Worker (Bulletproof Edition)
// ============================================================
//  STANDALONE Cloudflare Worker — not part of Next.js.
//
//  THREE ENTRY POINTS:
//
//  1. CRON TRIGGER (every 5 minutes):
//     Fetches products + stock from Google Apps Script
//     Writes to Cloudflare KV only IF data changed (hash-skip)
//     → Saves ~90% of KV write quota
//
//  2. HTTP GET (visitors fetch from here):
//     ?action=catalog  → returns {products, stock} in one response
//                       (halves quota vs separate endpoints)
//     ?action=products → legacy single-endpoint (backwards compat)
//     ?action=stock    → legacy single-endpoint (backwards compat)
//     ?action=health   → returns {ok, lastSync, kvAge, productCount}
//
//  3. HTTP POST /refresh?secret=XXX:
//     Triggers an immediate sync (used by admin "Refresh now" button)
//     Wrong secret → 401
//     Correct secret → {ok: true, synced: true}
//
//  NEVER-ERROR PRINCIPLE:
//  - Every code path has try/catch
//  - On any failure: return last-known KV data (stale but available)
//  - On total failure: return empty/cached (visitor falls back to static JSON)
//  - Apps Script URL + admin secret come from env (wrangler secret put)
//  - CORS locked to exact Pages domains (no wildcards)
// ============================================================

// === CORS — locked to known Pages domains (no wildcard) ===
const ALLOWED_ORIGINS = new Set([
  "https://soumdeco.pages.dev",
  "https://www.soumdeco.pages.dev",
  // Local dev
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  // Only allow known origins. Unknown origins get no ACAO header (browser blocks).
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

// === JSON helper that never throws ===
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// === Tiny hash (djb2) — used for change detection ===
function hashString(s) {
  if (!s) return "0";
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return String(h >>> 0); // unsigned
}

export default {
  // === CRON TRIGGER ===
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncData(env));
  },

  // === HTTP ENDPOINT ===
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = (url.searchParams.get("action") || "catalog").toLowerCase();
    const cors = corsHeaders(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Handle /refresh (admin trigger)
    if (action === "refresh" || url.pathname === "/refresh") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "method_not_allowed" }, 405, cors);
      }
      const providedSecret =
        request.headers.get("X-Admin-Secret") ||
        url.searchParams.get("secret") ||
        "";
      const expectedSecret = env.ADMIN_SECRET || "";
      if (!expectedSecret) {
        // Secret never configured → fail closed (admin gets clear error)
        return json({ ok: false, error: "no_secret_configured" }, 503, cors);
      }
      if (providedSecret !== expectedSecret) {
        return json({ ok: false, error: "unauthorized" }, 401, cors);
      }
      // Run sync immediately, return result
      try {
        const result = await syncData(env);
        return json(
          { ok: true, synced: true, ...result },
          200,
          cors,
        );
      } catch (err) {
        return json(
          { ok: false, synced: false, error: String(err?.message || err) },
          200, // 200 so admin UI shows the message instead of network error
          cors,
        );
      }
    }

    // Handle /health
    if (action === "health") {
      try {
        const meta = await env.CATALOG_KV.get("__meta", "json");
        const productsRaw = await env.CATALOG_KV.get("products", "text");
        let productCount = 0;
        try {
          const arr = JSON.parse(productsRaw || "[]");
          if (Array.isArray(arr)) productCount = arr.length;
        } catch {}
        return json(
          {
            ok: true,
            lastSync: meta?.lastSync || null,
            lastChange: meta?.lastChange || null,
            kvAge: meta?.lastSync ? Date.now() - meta.lastSync : null,
            productCount,
            kvHits: meta?.kvHits || 0,
          },
          200,
          cors,
        );
      } catch {
        return json({ ok: false, error: "kv_unavailable" }, 503, cors);
      }
    }

    // === Catalog endpoint (combined — saves 50% quota) ===
    if (action === "catalog") {
      try {
        // Read both products + stock from KV in parallel
        const [productsRaw, stockRaw] = await Promise.all([
          env.CATALOG_KV.get("products", "text"),
          env.CATALOG_KV.get("stock", "text"),
        ]);

        // Bump hit counter (best-effort, non-blocking)
        ctx.waitUntil(bumpHitCounter(env).catch(() => {}));

        if (productsRaw) {
          return new Response(
            JSON.stringify({
              products: productsRaw,
              stock: stockRaw || "",
              ts: Date.now(),
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
                ...cors,
              },
            },
          );
        }

        // KV miss — populate synchronously (first run only)
        const result = await syncData(env);
        const freshProducts = await env.CATALOG_KV.get("products", "text");
        const freshStock = await env.CATALOG_KV.get("stock", "text");
        if (freshProducts) {
          return new Response(
            JSON.stringify({
              products: freshProducts,
              stock: freshStock || "",
              ts: Date.now(),
              justSynced: true,
              syncResult: result,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
                ...cors,
              },
            },
          );
        }

        // Total failure — return empty (visitor falls back to static JSON)
        return json(
          { products: "[]", stock: "", ts: Date.now(), error: "no_data" },
          200, // 200 so visitor client doesn't throw — it parses empty
          cors,
        );
      } catch (err) {
        console.error("[Worker] catalog endpoint error:", err);
        return json(
          { products: "[]", stock: "", ts: Date.now(), error: "internal" },
          200,
          cors,
        );
      }
    }

    // === Legacy: products-only endpoint ===
    if (action === "products") {
      try {
        const cached = await env.CATALOG_KV.get("products", "text");
        if (cached) {
          ctx.waitUntil(bumpHitCounter(env).catch(() => {}));
          return new Response(cached, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
              ...cors,
            },
          });
        }
        // Miss → sync then return
        await syncData(env);
        const fresh = await env.CATALOG_KV.get("products", "text");
        return new Response(fresh || "[]", {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...cors,
          },
        });
      } catch (err) {
        console.error("[Worker] products endpoint error:", err);
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }
    }

    // === Legacy: stock-only endpoint ===
    if (action === "stock") {
      try {
        const cached = await env.CATALOG_KV.get("stock", "text");
        if (cached) {
          ctx.waitUntil(bumpHitCounter(env).catch(() => {}));
          return new Response(cached, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
              ...cors,
            },
          });
        }
        await syncData(env);
        const fresh = await env.CATALOG_KV.get("stock", "text");
        return new Response(fresh || "", {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...cors,
          },
        });
      } catch (err) {
        console.error("[Worker] stock endpoint error:", err);
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/csv; charset=utf-8", ...cors },
        });
      }
    }

    // === Unknown action ===
    return json({ ok: false, error: "unknown_action", action }, 404, cors);
  },
};

// === Helper: sync data from Apps Script → KV (with hash-skip) ===
async function syncData(env) {
  const result = {
    productsUpdated: false,
    stockUpdated: false,
    productsChanged: false,
    stockChanged: false,
    error: null,
  };

  try {
    const APPS_SCRIPT_URL = env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      result.error = "no_apps_script_url";
      console.error("[Worker] APPS_SCRIPT_URL not configured");
      return result;
    }

    // Fetch products + stock in parallel
    const [productsRes, stockRes] = await Promise.allSettled([
      fetchFromAppsScript(APPS_SCRIPT_URL, "products"),
      fetchFromAppsScript(APPS_SCRIPT_URL, "stock"),
    ]);

    const productsData = productsRes.status === "fulfilled" ? productsRes.value : null;
    const stockData = stockRes.status === "fulfilled" ? stockRes.value : null;

    // Read existing hashes from KV (to detect change)
    const [existingHashes, existingMeta] = await Promise.all([
      env.CATALOG_KV.get("__hashes", "json").catch(() => null),
      env.CATALOG_KV.get("__meta", "json").catch(() => null),
    ]);

    const newProductsHash = hashString(productsData || "");
    const newStockHash = hashString(stockData || "");
    const oldProductsHash = existingHashes?.products || "";
    const oldStockHash = existingHashes?.stock || "";

    const productsChanged = productsData && newProductsHash !== oldProductsHash;
    const stockChanged = stockData && newStockHash !== oldStockHash;

    // Only write to KV if data actually changed (saves ~90% of writes)
    const writes = [];
    if (productsData && productsChanged) {
      writes.push(env.CATALOG_KV.put("products", productsData, { expirationTtl: 600 }));
      result.productsUpdated = true;
      result.productsChanged = true;
    }
    if (stockData && stockChanged) {
      writes.push(env.CATALOG_KV.put("stock", stockData, { expirationTtl: 600 }));
      result.stockUpdated = true;
      result.stockChanged = true;
    }
    // Always update hashes + meta (tiny writes, but only if changed)
    if (productsChanged || stockChanged || !existingHashes) {
      writes.push(
        env.CATALOG_KV.put("__hashes", JSON.stringify({
          products: newProductsHash,
          stock: newStockHash,
        })),
      );
    }
    // Always update lastSync (even if no data changed — proves cron ran)
    const newMeta = {
      lastSync: Date.now(),
      lastChange: productsChanged || stockChanged ? Date.now() : (existingMeta?.lastChange || Date.now()),
      kvHits: existingMeta?.kvHits || 0,
    };
    writes.push(env.CATALOG_KV.put("__meta", JSON.stringify(newMeta)));

    await Promise.all(writes);
    return result;
  } catch (err) {
    console.error("[Worker] syncData failed:", err);
    result.error = String(err?.message || err);
    return result;
  }
}

// === Helper: fetch from Apps Script with timeout + retry ===
async function fetchFromAppsScript(baseUrl, action) {
  const url = `${baseUrl}?action=${action}`;
  let lastErr = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[Worker] Apps Script ${action} returned ${res.status}`);
        // Don't retry on 4xx (sheet misconfigured), retry on 5xx
        if (res.status >= 400 && res.status < 500) return null;
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      console.warn(`[Worker] Apps Script ${action} attempt ${attempt + 1} failed:`, err?.message || err);
      // Wait 1s before retry (exponential would be overkill for 2 attempts)
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return null;
}

// === Helper: bump KV hit counter (non-blocking, best-effort) ===
async function bumpHitCounter(env) {
  try {
    const meta = await env.CATALOG_KV.get("__meta", "json");
    const next = {
      lastSync: meta?.lastSync || Date.now(),
      lastChange: meta?.lastChange || Date.now(),
      kvHits: (meta?.kvHits || 0) + 1,
    };
    await env.CATALOG_KV.put("__meta", JSON.stringify(next));
  } catch {
    // Best-effort — don't fail the request
  }
}
