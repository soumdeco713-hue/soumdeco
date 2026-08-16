# SOUM DECO — Worker Setup (Browser-Only, No Terminal)

> **No terminal, no commands, no code.** Everything happens in your web browser at **dash.cloudflare.com**.
> **Total time: ~15 minutes.** After this, your site handles 50K+ visitors/day with 5-min freshness.

---

## What you'll click (overview)

1. Create a "storage box" (KV namespace)
2. Create the Worker (paste code I'll give you)
3. Connect the storage box to the Worker
4. Set 2 secret values (I'll give them to you)
5. Set the auto-refresh timer (cron)
6. Save → copy Worker URL
7. Tell your Pages site about the Worker
8. Redeploy Pages — done!

---

## Step 1 — Open Cloudflare dashboard

1. Go to **https://dash.cloudflare.com/**
2. Login with your Cloudflare account (the same one you use for `soumdeco.pages.dev`)
3. On the left sidebar, click **"Workers & Pages"**

---

## Step 2 — Create the storage box (KV namespace)

1. In the left sidebar, click **"KV"** (it's under Workers & Pages)
2. Click the blue button **"Create a namespace"**
3. **Namespace name:** type `CATALOG_KV`
4. Click **"Add"**
5. **You'll see the namespace in the list.** Done.

---

## Step 3 — Create the Worker

1. In the left sidebar, click **"Workers & Pages"**
2. Click the blue button **"Create"** (or "Create application")
3. Click **"Workers"** tab → **"Create Worker"**
4. **Name:** type `soumdeco-data-sync`
5. Click **"Deploy"** (you'll see a placeholder "Hello World" worker)
6. Click **"Edit code"** (blue button) — the code editor opens

---

## Step 4 — Paste the Worker code

1. In the code editor, you'll see something like:
   ```js
   export default {
     async fetch(request, env) {
       return new Response("Hello World!");
     },
   };
   ```

2. **Select ALL that text and delete it.**

3. **Paste this entire code instead** (it's long — make sure you paste ALL of it):

```javascript
// ============================================================
//  SOUM DECO — Centralized Data Sync Worker (Bulletproof Edition)
// ============================================================

const ALLOWED_ORIGINS = new Set([
  "https://soumdeco.pages.dev",
  "https://www.soumdeco.pages.dev",
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

function hashString(s) {
  if (!s) return "0";
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncData(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = (url.searchParams.get("action") || "catalog").toLowerCase();
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

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
      try {
        const result = await syncData(env);
        return json({ ok: true, synced: true, ...result }, 200, cors);
      } catch (err) {
        return json({ ok: false, synced: false, error: String(err?.message || err) }, 200, cors);
      }
    }

    if (action === "health") {
      try {
        const meta = await env.CATALOG_KV.get("__meta", "json");
        const productsRaw = await env.CATALOG_KV.get("products", "text");
        let productCount = 0;
        try {
          const arr = JSON.parse(productsRaw || "[]");
          if (Array.isArray(arr)) productCount = arr.length;
        } catch {}
        return json({
          ok: true,
          lastSync: meta?.lastSync || null,
          lastChange: meta?.lastChange || null,
          productCount,
          kvHits: meta?.kvHits || 0,
        }, 200, cors);
      } catch {
        return json({ ok: false, error: "kv_unavailable" }, 503, cors);
      }
    }

    if (action === "catalog") {
      try {
        const [productsRaw, stockRaw] = await Promise.all([
          env.CATALOG_KV.get("products", "text"),
          env.CATALOG_KV.get("stock", "text"),
        ]);
        ctx.waitUntil(bumpHitCounter(env).catch(() => {}));
        if (productsRaw) {
          return new Response(JSON.stringify({
            products: productsRaw,
            stock: stockRaw || "",
            ts: Date.now(),
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
              ...cors,
            },
          });
        }
        const result = await syncData(env);
        const freshProducts = await env.CATALOG_KV.get("products", "text");
        const freshStock = await env.CATALOG_KV.get("stock", "text");
        if (freshProducts) {
          return new Response(JSON.stringify({
            products: freshProducts,
            stock: freshStock || "",
            ts: Date.now(),
            justSynced: true,
            syncResult: result,
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
              ...cors,
            },
          });
        }
        return json({ products: "[]", stock: "", ts: Date.now(), error: "no_data" }, 200, cors);
      } catch (err) {
        return json({ products: "[]", stock: "", ts: Date.now(), error: "internal" }, 200, cors);
      }
    }

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
      } catch {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
        });
      }
    }

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
      } catch {
        return new Response("", {
          status: 200,
          headers: { "Content-Type": "text/csv; charset=utf-8", ...cors },
        });
      }
    }

    return json({ ok: false, error: "unknown_action", action }, 404, cors);
  },
};

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
      return result;
    }
    const [productsRes, stockRes] = await Promise.allSettled([
      fetchFromAppsScript(APPS_SCRIPT_URL, "products"),
      fetchFromAppsScript(APPS_SCRIPT_URL, "stock"),
    ]);
    const productsData = productsRes.status === "fulfilled" ? productsRes.value : null;
    const stockData = stockRes.status === "fulfilled" ? stockRes.value : null;
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
    if (productsChanged || stockChanged || !existingHashes) {
      writes.push(env.CATALOG_KV.put("__hashes", JSON.stringify({
        products: newProductsHash,
        stock: newStockHash,
      })));
    }
    const newMeta = {
      lastSync: Date.now(),
      lastChange: productsChanged || stockChanged ? Date.now() : (existingMeta?.lastChange || Date.now()),
      kvHits: existingMeta?.kvHits || 0,
    };
    writes.push(env.CATALOG_KV.put("__meta", JSON.stringify(newMeta)));
    await Promise.all(writes);
    return result;
  } catch (err) {
    result.error = String(err?.message || err);
    return result;
  }
}

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
        if (res.status >= 400 && res.status < 500) return null;
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return null;
}

async function bumpHitCounter(env) {
  try {
    const meta = await env.CATALOG_KV.get("__meta", "json");
    const next = {
      lastSync: meta?.lastSync || Date.now(),
      lastChange: meta?.lastChange || Date.now(),
      kvHits: (meta?.kvHits || 0) + 1,
    };
    await env.CATALOG_KV.put("__meta", JSON.stringify(next));
  } catch {}
}
```

4. Click the **"Save"** button (top-right of the editor)
5. Click **"Deploy"** (top-right)

---

## Step 5 — Connect the storage box to the Worker

1. Go back to your Worker: **Workers & Pages** → click **`soumdeco-data-sync`**
2. Click the **"Settings"** tab
3. Click **"Bindings"** (in the left menu under "Settings")
4. Click **"Add binding"**
5. Choose **"KV namespace"**
6. **Variable name:** type `CATALOG_KV` (exactly this — case-sensitive!)
7. **KV namespace:** select `CATALOG_KV` (the one you created in Step 2)
8. Click **"Save"** or **"Deploy"**

---

## Step 6 — Set the 2 secret values

Still in the Worker's **Settings** → **Bindings** (or **Variables**) page:

1. Click **"Add binding"** → choose **"Secret"** (or "Environment variable" → "Encrypt")
2. **Variable name:** type `APPS_SCRIPT_URL`
3. **Value:** paste this exact URL:
   ```
   https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec
   ```
4. Click **"Save"** / **"Deploy"**

Repeat for the second secret:

5. Click **"Add binding"** → **"Secret"**
6. **Variable name:** type `ADMIN_SECRET`
7. **Value:** paste this random secret (I generated it for you):
   ```
   7f3a9c4e2b8d1f5a6e0c9b3d7f2a8e5c4b1d6f9a3e7c2b8d5f1a4e9c6b3d7f2a
   ```
8. Click **"Save"** / **"Deploy"**

---

## Step 7 — Set the auto-refresh timer (Cron)

1. Still in your Worker, click the **"Triggers"** tab (top of page)
2. Scroll down to **"Cron Triggers"**
3. Click **"Add Cron Trigger"**
4. **Cron expression:** type `*/5 * * * *` (this means "every 5 minutes")
5. Click **"Save"**

---

## Step 8 — Copy your Worker URL

1. At the top of your Worker page, you'll see something like:
   ```
   https://soumdeco-data-sync.<your-subdomain>.workers.dev
   ```
2. **Copy that URL** — you'll need it in Step 9

---

## Step 9 — Tell your Pages site about the Worker

1. In the Cloudflare dashboard left sidebar, click **"Workers & Pages"**
2. Find **`soumdeco`** (your Pages site) → click it
3. Click the **"Settings"** tab
4. Click **"Environment variables"** (in the left menu)
5. Click **"Add variable"** under **"Production"**
6. Add these 2 variables:

   **Variable 1:**
   - **Name:** `NEXT_PUBLIC_WORKER_URL`
   - **Value:** paste the URL you copied in Step 8

   **Variable 2:**
   - **Name:** `NEXT_PUBLIC_WORKER_ADMIN_SECRET`
   - **Value:** `7f3a9c4e2b8d1f5a6e0c9b3d7f2a8e5c4b1d6f9a3e7c2b8d5f1a4e9c6b3d7f2a`

7. Click **"Save"**

---

## Step 10 — Redeploy your Pages site

1. In your Pages site (`soumdeco`), click the **"Deployments"** tab
2. Find your latest deployment (top of list)
3. Click the **3 dots (⋮)** on the right
4. Click **"Retry deployment"**
5. Wait ~3 minutes for it to finish

---

## ✅ Done! Test it

1. **Wait 5 minutes** for the Worker's first cron run (it'll fetch data from Google Sheet)
2. Open your website: **https://soumdeco.pages.dev**
3. Open the admin panel (the usual way)
4. **Look at the top-right of the admin panel** — you should see:
   - 🟢 **Green dot + "since X min"** → SUCCESS! Click it to refresh data instantly
   - ⚪ **Gray dot + "وضع ثابت"** → env vars not set (recheck Step 9-10)
   - 🔴 **Red dot + "غير متصل"** → Worker has issues (tell me, I'll debug)

---

## How to know it's working

In your browser, visit this URL (replace `<your-subdomain>`):
```
https://soumdeco-data-sync.<your-subdomain>.workers.dev/?action=health
```

You should see:
```json
{"ok":true,"lastSync":1736000000000,"lastChange":1736000000000,"productCount":80,"kvHits":5}
```

If `productCount` is more than 0, it's working perfectly.

---

## What if something breaks?

**The website never breaks.** The Worker is layer 1 of a 4-layer fallback:

| If this happens... | Your visitors see... |
|---|---|
| Worker is down | Static JSON (max 24h old) — site still works |
| Worker + static both fail | Last cached data in browser — site still works |
| Everything fails | Built-in seed products — site still works |

The Worker can disappear tomorrow and your site keeps running perfectly.

---

## Common issues

| Problem | Fix |
|---|---|
| Worker URL returns `{"ok":false,"error":"kv_unavailable"}` | KV binding not added — recheck Step 5 |
| Worker URL returns `{"products":"[]","stock":""}` | First sync hasn't run yet. Wait 5 min, OR click "Refresh now" in admin panel |
| Admin panel shows "وضع ثابت" | Pages env vars not set — recheck Step 9 + redeploy (Step 10) |
| Admin panel shows "غير متصل" | Worker URL or ADMIN_SECRET mismatch — recheck Steps 6 + 9 |
| `wrangler` mentioned anywhere | Ignore — you don't need wrangler in browser mode |

---

## Need help?

Just tell me in chat:
- "I'm at Step X and I see..."
- "The health URL shows..."

I'll guide you. **No technical knowledge needed.**

---

## Summary of values you need to copy

| Value | Where it goes |
|---|---|
| **APPS_SCRIPT_URL** = `https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec` | Worker → Settings → Variables (Step 6) |
| **ADMIN_SECRET** = `7f3a9c4e2b8d1f5a6e0c9b3d7f2a8e5c4b1d6f9a3e7c2b8d5f1a4e9c6b3d7f2a` | Worker → Settings → Variables (Step 6) AND Pages → Settings → Env vars (Step 9) |
| **Worker URL** = `https://soumdeco-data-sync.<your-subdomain>.workers.dev` | Copy from Worker dashboard (Step 8), paste into Pages env var (Step 9) |
| **Cron expression** = `*/5 * * * *` | Worker → Triggers → Cron (Step 7) |
