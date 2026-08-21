// ============================================================
//  SOUM DECO — Centralized Data Sync Worker (BULLETPROOF Edition v2)
// ============================================================
//  STANDALONE Cloudflare Worker. Never throws. Never crashes.
//  Self-heals on every cron cycle.
//
//  THREE ENTRY POINTS:
//
//  1. CRON TRIGGER (every 5 minutes):
//     Calls syncData() which:
//       - Retries Apps Script fetch 3 times with backoff
//       - Always writes meta (so we know cron is firing)
//       - Only writes data on success
//     Even if syncData fails entirely, cron fires again in 5 min.
//     Cron NEVER throws — guarantees next cycle runs.
//
//  2. HTTP GET (visitors fetch from here):
//     ?action=catalog  → {products, stock} in one response
//     ?action=products → legacy single-endpoint
//     ?action=stock    → legacy single-endpoint
//     ?action=health   → {ok, lastSync, lastSyncAttempt, productCount, kvHits}
//     On KV miss → tries to sync immediately (self-heal)
//     On total failure → returns empty (visitor falls back to static JSON)
//
//  3. HTTP POST /refresh?secret=XXX:
//     Admin manual sync trigger (rarely needed — cron is reliable)
//     Wrong secret → 401. Correct secret → 200 with sync result.
//
//  RESILIENCE FEATURES:
//  - KV TTL = 3600s (1 hour) — survives 12 missed cron cycles
//  - Cron retries 3x with backoff before giving up
//  - All code paths wrapped in try/catch
//  - KV writes are best-effort (if write fails, reads still work)
//  - Meta is always written (proves cron is firing)
//  - Health endpoint distinguishes lastSync vs lastSyncAttempt
//  - Apps Script URL + admin secret from env (never in code)
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

// === KV TTL — 1 hour (survives 12 missed cron cycles of 5 min each) ===
const KV_TTL_SECONDS = 3600;

export default {
  // === CRON TRIGGER — fires every 5 minutes, NEVER throws ===
  async scheduled(event, env, ctx) {
    // Wrap in try/catch — even if syncData throws, cron returns cleanly
    // so the next 5-min cycle fires normally.
    ctx.waitUntil(
      (async () => {
        try {
          await syncData(env);
        } catch (err) {
          // Log but don't throw — cron must complete cleanly
          console.error("[Worker CRON] syncData threw (caught):", err?.message || err);
        }
      })(),
    );
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
        return json({ ok: false, error: "no_secret_configured" }, 503, cors);
      }
      if (providedSecret !== expectedSecret) {
        return json({ ok: false, error: "unauthorized" }, 401, cors);
      }

      // RATE LIMITING: max 1 refresh per 3 seconds.
      // Prevents quota abuse (each /refresh = 4 KV writes).
      try {
        const meta = await env.CATALOG_KV.get("__meta", "json").catch(() => null);
        const lastRefreshAttempt = meta?.lastSyncAttempt || 0;
        const now = Date.now();
        const COOLDOWN_MS = 3_000;
        if (now - lastRefreshAttempt < COOLDOWN_MS) {
          const waitMs = COOLDOWN_MS - (now - lastRefreshAttempt);
          return json(
            { ok: false, synced: false, error: "rate_limited", retryAfterMs: waitMs },
            200,
            cors,
          );
        }
      } catch {}

      try {
        const result = await syncData(env);
        return json({ ok: true, synced: true, ...result }, 200, cors);
      } catch (err) {
        // Even on failure, return 200 with error info (admin sees friendly msg)
        return json(
          { ok: false, synced: false, error: String(err?.message || err) },
          200,
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
        const now = Date.now();
        const lastSync = meta?.lastSync || null;
        const lastSyncAttempt = meta?.lastSyncAttempt || lastSync;
        // Healthy = sync succeeded within last 15 min (3 cron cycles)
        const isHealthy = lastSync && now - lastSync < 15 * 60 * 1000;
        return json(
          {
            ok: !!isHealthy,
            lastSync,
            lastSyncAttempt,
            lastChange: meta?.lastChange || null,
            kvAge: lastSync ? now - lastSync : null,
            productCount,
            kvHits: meta?.kvHits || 0,
            consecutiveFailures: meta?.consecutiveFailures || 0,
          },
          200,
          cors,
        );
      } catch (err) {

        // KV might be down — return degraded health
        return json(
          { ok: false, error: "kv_unavailable", detail: String(err?.message || err) },
          200, // 200 so frontend doesn't throw — it can still serve static
          cors,
        );
      }
    }

    // === Version endpoint (TINY — 8 bytes. Used for smart polling) ===
    // Visitors poll this endpoint to check if the catalog changed.
    // If the version matches, they DON'T fetch the full 70KB catalog.
    // This saves 80% of Worker requests and KV reads.
    if (action === "version") {
      try {
        const meta = await env.CATALOG_KV.get("__meta", "json").catch(() => null);
        return json(
          {
            v: meta?.lastChange || 0,
          },
          200,
          cors,
        );
      } catch {
        return json({ v: 0 }, 200, cors);
      }
    }

    // === Catalog endpoint (combined — saves 50% quota) ===
    if (action === "catalog") {
      try {
        // Read both products + stock from KV in parallel
        const [productsRaw, stockRaw] = await Promise.all([
          env.CATALOG_KV.get("products", "text").catch(() => null),
          env.CATALOG_KV.get("stock", "text").catch(() => null),
        ]);

        // NOTE: bumpHitCounter removed to save KV writes (was 1000/day at 50K visitors)

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

        // KV miss — populate synchronously (self-heal on first visit)
        try {
          await syncData(env);
        } catch (err) {
          console.error("[Worker] self-heal sync failed:", err?.message || err);
        }
        const freshProducts = await env.CATALOG_KV.get("products", "text").catch(() => null);
        const freshStock = await env.CATALOG_KV.get("stock", "text").catch(() => null);
        if (freshProducts) {
          return new Response(
            JSON.stringify({
              products: freshProducts,
              stock: freshStock || "",
              ts: Date.now(),
              justSynced: true,
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
        console.error("[Worker] catalog endpoint error:", err?.message || err);
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
        const cached = await env.CATALOG_KV.get("products", "text").catch(() => null);
        if (cached) {
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
        try { await syncData(env); } catch {}
        const fresh = await env.CATALOG_KV.get("products", "text").catch(() => null);
        return new Response(fresh || "[]", {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...cors,
          },
        });
      } catch (err) {
        console.error("[Worker] products endpoint error:", err?.message || err);
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }
    }

    // === Legacy: stock-only endpoint ===
    if (action === "stock") {
      try {
        const cached = await env.CATALOG_KV.get("stock", "text").catch(() => null);
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
              ...cors,
            },
          });
        }
        try { await syncData(env); } catch {}
        const fresh = await env.CATALOG_KV.get("stock", "text").catch(() => null);
        return new Response(fresh || "", {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            ...cors,
          },
        });
      } catch (err) {
        console.error("[Worker] stock endpoint error:", err?.message || err);
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

// === Helper: sync data from Apps Script → KV ===
// NEVER throws — wraps everything in try/catch, returns result object.
// Always writes meta (so we can track "cron is firing" vs "data is fresh").
async function syncData(env) {
  const result = {
    productsUpdated: false,
    stockUpdated: false,
    productsChanged: false,
    stockChanged: false,
    error: null,
    attemptCount: 0,
  };

  try {
    const APPS_SCRIPT_URL = env.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) {
      result.error = "no_apps_script_url";
      console.error("[Worker] APPS_SCRIPT_URL not configured");
      await updateMetaOnFailure(env, "no_apps_script_url").catch(() => {});
      return result;
    }

    // Read existing hashes + meta + actual data (for change detection + TTL check)
    const [existingHashes, existingMeta, existingProducts, existingStock] = await Promise.all([
      env.CATALOG_KV.get("__hashes", "json").catch(() => null),
      env.CATALOG_KV.get("__meta", "json").catch(() => null),
      env.CATALOG_KV.get("products", "text").catch(() => null),
      env.CATALOG_KV.get("stock", "text").catch(() => null),
    ]);

    // Fetch products + stock in parallel (each retried 3 times internally)
    const [productsRes, stockRes] = await Promise.allSettled([
      fetchFromAppsScript(APPS_SCRIPT_URL, "products"),
      fetchFromAppsScript(APPS_SCRIPT_URL, "stock"),
    ]);

    const productsData = productsRes.status === "fulfilled" ? productsRes.value : null;
    const stockData = stockRes.status === "fulfilled" ? stockRes.value : null;

    // If BOTH fetches failed, mark failure and bail (but still write meta)
    if (!productsData && !stockData) {
      result.error = "both_fetches_failed";
      console.error("[Worker] Both Apps Script fetches failed");
      await updateMetaOnFailure(env, "both_fetches_failed", existingMeta).catch(() => {});
      return result;
    }

    // Compute hashes for change detection
    const newProductsHash = hashString(productsData || "");
    const newStockHash = hashString(stockData || "");
    const oldProductsHash = existingHashes?.products || "";
    const oldStockHash = existingHashes?.stock || "";

    const productsChanged = productsData && newProductsHash !== oldProductsHash;
    const stockChanged = stockData && newStockHash !== oldStockHash;

    // CRITICAL QUOTA FIX: Only write data when it actually changed OR if TTL needs refresh.
    // CRITICAL BUG FIX: Also write if the KV key is MISSING (expired/wiped) even if hash matches.
    // Hash-skip alone is not enough — the key can expire (TTL) while __hashes persists (no TTL).
    const now = Date.now();
    const TTL_REFRESH_THRESHOLD = 30 * 60 * 1000; // 30 minutes
    const needsTtlRefresh = !existingMeta?.lastSync || (now - existingMeta.lastSync > TTL_REFRESH_THRESHOLD);
    // If the key is MISSING (expired/wiped), we MUST write it regardless of hash
    const productsMissing = !existingProducts;
    const stockMissing = !existingStock;

    const writes = [];
    if (productsData && (productsChanged || needsTtlRefresh || productsMissing)) {
      writes.push(env.CATALOG_KV.put("products", productsData, { expirationTtl: KV_TTL_SECONDS }));
      result.productsUpdated = true;
      result.productsChanged = !!productsChanged;
    } else if (productsData) {
      result.productsUpdated = false;
      result.productsChanged = false;
    }
    if (stockData && (stockChanged || needsTtlRefresh || stockMissing)) {
      writes.push(env.CATALOG_KV.put("stock", stockData, { expirationTtl: KV_TTL_SECONDS }));
      result.stockUpdated = true;
      result.stockChanged = !!stockChanged;
    } else if (stockData) {
      // Data unchanged and TTL is fresh — skip write to save quota
      result.stockUpdated = false;
      result.stockChanged = false;
    }
    // Update hashes (no TTL — persists forever, only changes when data changes)
    if (productsChanged || stockChanged || !existingHashes) {
      writes.push(
        env.CATALOG_KV.put("__hashes", JSON.stringify({
          products: newProductsHash,
          stock: newStockHash,
        })),
      );
    }
    // Update meta — track BOTH lastSync (success) AND lastSyncAttempt (any try)
    // We ALWAYS write meta because it's tiny and needed for health checks + rate limiting.
    const newMeta = {
      lastSync: now, // success!
      lastSyncAttempt: now,
      lastChange: productsChanged || stockChanged ? now : (existingMeta?.lastChange || now),
      kvHits: existingMeta?.kvHits || 0,
      consecutiveFailures: 0, // reset on success
    };
    writes.push(env.CATALOG_KV.put("__meta", JSON.stringify(newMeta)));

    // Run all writes in parallel — best-effort (if some fail, others still succeed)
    await Promise.allSettled(writes);
    return result;
  } catch (err) {
    // Catch-all — syncData NEVER throws
    console.error("[Worker] syncData caught error:", err?.message || err);
    result.error = String(err?.message || err);
    await updateMetaOnFailure(env, result.error).catch(() => {});
    return result;
  }
}

// === Helper: update meta on failure (so we can track consecutiveFailures) ===
async function updateMetaOnFailure(env, error, existingMeta) {
  try {
    const meta = existingMeta || await env.CATALOG_KV.get("__meta", "json").catch(() => null);
    const newMeta = {
      lastSync: meta?.lastSync || null, // keep last successful sync
      lastSyncAttempt: Date.now(), // mark this attempt
      lastChange: meta?.lastChange || null,
      kvHits: meta?.kvHits || 0,
      consecutiveFailures: (meta?.consecutiveFailures || 0) + 1,
      lastError: error,
      lastErrorAt: Date.now(),
    };
    await env.CATALOG_KV.put("__meta", JSON.stringify(newMeta));
  } catch {
    // KV might be down — nothing we can do, but syncData must not throw
  }
}

// === Helper: fetch from Apps Script with timeout + 3 retries ===
async function fetchFromAppsScript(baseUrl, action) {
  const url = `${baseUrl}?action=${action}`;
  let lastErr = null;

  // 3 attempts with exponential backoff (1s, 2s, 4s)
  for (let attempt = 0; attempt < 3; attempt++) {
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
        console.warn(`[Worker] Apps Script ${action} attempt ${attempt + 1} returned ${res.status}`);
        // Don't retry on 4xx (sheet misconfigured) — retry on 5xx + network errors
        if (res.status >= 400 && res.status < 500) return null;
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        // Success
        return await res.text();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      console.warn(`[Worker] Apps Script ${action} attempt ${attempt + 1} failed: ${err?.name || ""} ${err?.message || err}`);
    }

    // Wait before retry (exponential backoff) — but only if we have attempts left
    if (attempt < 2) {
      const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.error(`[Worker] Apps Script ${action} all 3 attempts failed. Last error: ${lastErr?.message || lastErr}`);
  return null;
}

// === Helper: bump KV hit counter (non-blocking, best-effort) ===
// === Helper: bump KV hit counter (SAMPLED — 1-in-50) ===
// CRITICAL: Sampling prevents KV write quota exhaustion.
// At 50K visitors/day, unsampled = 50K writes/day (50× the 1K/day quota).
// Sampled at 1-in-50 = ~1K writes/day (at the limit, safe).
async function bumpHitCounter(env) {
  try {
    // Sample: only bump ~2% of requests (1 in 50)
    if (Math.random() > 0.02) return; // skip 98% of the time

    const meta = await env.CATALOG_KV.get("__meta", "json").catch(() => null);
    const next = {
      lastSync: meta?.lastSync || Date.now(),
      lastSyncAttempt: meta?.lastSyncAttempt || Date.now(),
      lastChange: meta?.lastChange || Date.now(),
      // Scale up by 50× to approximate the real hit count
      kvHits: (meta?.kvHits || 0) + 50,
      consecutiveFailures: meta?.consecutiveFailures || 0,
    };
    await env.CATALOG_KV.put("__meta", JSON.stringify(next));
  } catch {
    // Best-effort — don't fail the request
  }
}
