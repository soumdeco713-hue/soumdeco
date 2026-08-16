// ============================================================
//  SOUM DECO — Centralized Data Sync Worker
// ============================================================
//  This is a STANDALONE Cloudflare Worker (not part of Next.js).
//  It does TWO things:
//
//  1. CRON TRIGGER (every 5 minutes):
//     Fetches products + stock from Google Apps Script
//     Writes the response to Cloudflare KV (instant edge cache)
//
//  2. HTTP ENDPOINT (visitors fetch from here):
//     GET /?action=products → reads from KV (50ms, never calls Apps Script)
//     GET /?action=stock → reads from KV (50ms, never calls Apps Script)
//
//  This eliminates ALL per-visitor Apps Script calls.
//  Apps Script is only called by the cron trigger (288 times/day).
//  Visitors get fresh data (max 5 minutes old) from KV (instant).
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec";

// CORS headers for cross-origin requests from soumdeco.pages.dev
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  // === CRON TRIGGER: runs every 5 minutes ===
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncData(env));
  },

  // === HTTP ENDPOINT: visitors fetch from here ===
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "products";

    try {
      // Read from KV (instant, <5ms)
      const cached = await env.CATALOG_KV.get(action, "text");
      if (cached) {
        return new Response(cached, {
          headers: {
            "Content-Type": action === "stock" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...CORS_HEADERS,
          },
        });
      }

      // KV miss — fetch from Apps Script (first run only, or KV expired)
      const data = await fetchFromAppsScript(action);
      if (data) {
        // Store in KV (5 minute TTL)
        await env.CATALOG_KV.put(action, data, { expirationTtl: 300 });
        return new Response(data, {
          headers: {
            "Content-Type": action === "stock" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...CORS_HEADERS,
          },
        });
      }

      // Apps Script failed — return empty (visitor falls back to static JSON)
      return new Response(action === "stock" ? "" : "[]", {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err) {
      // Any error — return empty (visitor falls back to static JSON)
      return new Response(action === "stock" ? "" : "[]", {
        status: 503,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  },
};

// === Helper: fetch from Apps Script and store in KV ===
async function syncData(env) {
  try {
    // Sync products
    const productsData = await fetchFromAppsScript("products");
    if (productsData) {
      await env.CATALOG_KV.put("products", productsData, { expirationTtl: 300 });
    }

    // Sync stock
    const stockData = await fetchFromAppsScript("stock");
    if (stockData) {
      await env.CATALOG_KV.put("stock", stockData, { expirationTtl: 300 });
    }
  } catch (err) {
    // Silent fail — KV keeps the previous data (stale but available)
    console.error("[Worker] Sync failed:", err);
  }
}

// === Helper: fetch from Apps Script with timeout ===
async function fetchFromAppsScript(action) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`[Worker] Apps Script fetch failed (${action}):`, err);
    return null;
  }
}
