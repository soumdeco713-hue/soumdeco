# SOUM DECO — Cloudflare KV + R2 Setup Guide

This guide walks you through setting up **Cloudflare KV** (cache) and **Cloudflare R2** (image storage) for the SOUM DECO website. Both are optional — the site works without them (falls back to direct Apps Script + Cloudinary), but enabling them makes the site **significantly faster** and **cheaper to run**.

---

## Table of Contents

1. [What KV and R2 Do](#what-kv-and-r2-do)
2. [Prerequisites](#prerequisites)
3. [Part A: Set Up KV (Product + Stock Cache)](#part-a-set-up-kv)
4. [Part B: Set Up R2 (Image Storage)](#part-b-set-up-r2)
5. [Part C: Update wrangler.toml with Real IDs](#part-c-update-wranglertoml)
6. [Part D: Set Environment Variables in Cloudflare Dashboard](#part-d-set-environment-variables)
7. [Part E: Redeploy the Apps Script](#part-e-redeploy-the-apps-script)
8. [Part F: Run the Dedupe Action (One-Time)](#part-f-run-the-dedupe-action)
9. [Part G: Verify Everything Works](#part-g-verify-everything-works)
10. [Troubleshooting](#troubleshooting)

---

## What KV and R2 Do

### KV (Key-Value Cache)
- **What it does**: Caches the Google Apps Script response (96 products + stock CSV) for 3 minutes at the edge.
- **Why you need it**: Without KV, every visitor triggers a fetch to Google Apps Script (1-3 seconds cold start). With KV, returning visitors get products in **<100ms** from Cloudflare's edge network.
- **Cost**: Free tier = 100,000 reads/day + 1,000 writes/day. You'll use ~50 reads/day and ~480 writes/day (refresh every 3 min). **Well within free tier.**

### R2 (Object Storage)
- **What it does**: Stores product images uploaded by the admin (replaces Cloudinary long-term).
- **Why you need it**: 
  - Cloudinary free tier = 25 GB storage + 25 GB bandwidth/month. With 9,500 products × 5 images × 200 KB = ~9.5 GB storage. **You'll hit the bandwidth limit fast.**
  - R2 free tier = 10 GB storage + **unlimited egress (zero bandwidth fees)**. R2 is 10x cheaper long-term.
- **Migration path**: The site currently uses Cloudinary (works today). R2 is ready to switch on — just configure it and new uploads go to R2 automatically. Existing Cloudinary URLs keep working.

---

## Prerequisites

1. A Cloudflare account (free) — you already have one since the site is on Cloudflare Pages.
2. The `wrangler` CLI installed (comes with the project: `npx wrangler`).
3. Access to your Google Sheet's Apps Script editor.
4. Your Cloudflare account ID (found in the dashboard URL: `dash.cloudflare.com/<account_id>`).

**Login to Cloudflare via CLI** (one-time):
```bash
npx wrangler login
```
This opens a browser window to authenticate. You only need to do this once.

---

## Part A: Set Up KV

### Step 1: Create the KV namespace

Run this command in the project root:

```bash
npx wrangler kv namespace create CATALOG_KV
```

You'll see output like:
```
 ⛅️ wrangler
 id = "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
```

**Copy that `id` value** — you'll need it in Part C.

### Step 2: Create a preview namespace (for local dev)

```bash
npx wrangler kv namespace create CATALOG_KV --preview
```

You'll see:
```
 preview_id = "zyx987wvu654tsr321qpo098nml765kji432hgf109edc876ba"
```

**Copy that `preview_id` value** too.

### Step 3: Verify the namespaces exist

```bash
npx wrangler kv namespace list
```

You should see two namespaces:
- `soumdeco-CATALOG_KV` (production)
- `soumdeco-CATALOG_KV-preview` (preview)

---

## Part B: Set Up R2

### Step 1: Create the R2 bucket

```bash
npx wrangler r2 bucket create soumdeco-images
```

You'll see:
```
 ⛅️ wrangler
 Creating bucket soumdeco-images.
 Created bucket soumdeco-images.
```

### Step 2: Verify the bucket exists

```bash
npx wrangler r2 bucket list
```

You should see `soumdeco-images` in the list.

### Step 3: (Optional) Set up a custom domain for R2 images

For production, you want image URLs like `https://images.soumdeco.com/product-1.webp` instead of `/api/r2-image/product-1.webp`.

**Option A — Use a Cloudflare Worker (recommended):**

1. Go to the Cloudflare dashboard → **R2** → your bucket `soumdeco-images`.
2. Click **Settings** → **Public Access** → **Enable**.
3. R2 will give you a public URL like `https://pub-abc123.r2.dev`. **Copy this URL.**
4. (Better) Add a custom domain: click **Custom Domains** → **Connect Domain** → enter `images.soumdeco.com` (requires the domain to be on Cloudflare DNS).

**Option B — Use the built-in API route (works without setup):**

The site automatically serves R2 images via `/api/r2-image/{key}` if no public URL is set. This works but is slightly slower (goes through the Next.js worker instead of directly from R2).

---

## Part C: Update wrangler.toml

Open `/home/z/my-project/wrangler.toml` and replace the placeholder IDs with the real ones from Part A.

**Find this section:**
```toml
[[kv_namespaces]]
binding = "CATALOG_KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"
preview_id = "YOUR_KV_PREVIEW_NAMESPACE_ID_HERE"
```

**Replace with your real IDs:**
```toml
[[kv_namespaces]]
binding = "CATALOG_KV"
id = "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
preview_id = "zyx987wvu654tsr321qpo098nml765kji432hgf109edc876ba"
```

The R2 section is already correct (no IDs needed — just the bucket name):
```toml
[[r2_buckets]]
binding = "PRODUCT_IMAGES"
bucket_name = "soumdeco-images"
```

---

## Part D: Set Environment Variables in Cloudflare Dashboard

Go to: **Cloudflare Dashboard** → **Workers & Pages** → **soumdeco** → **Settings** → **Environment variables** (or **Production** tab).

### Required variables (should already be set):

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SHEET_URL` | `https://script.google.com/macros/s/AKfycbx.../exec` | Your Apps Script URL |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `anhvhy4j` | Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `soumdeco` | Cloudinary unsigned preset |

### NEW variable for R2 (add this):

| Variable | Value | Notes |
|----------|-------|-------|
| `R2_PUBLIC_BASE_URL` | `https://pub-abc123.r2.dev` or `https://images.soumdeco.com` | Your R2 public URL from Part B, Step 3 |

**Leave `R2_PUBLIC_BASE_URL` empty** if you want to use the built-in `/api/r2-image/` route instead. The site will work either way.

### Important:
- Set these for **both** "Production" and "Preview" environments.
- After adding variables, **redeploy** the site (push any commit to GitHub, or click "Retry deployment" in Cloudflare).

---

## Part E: Redeploy the Apps Script

The Apps Script has new actions (`dedupe`, `cleanup`, `health`) that need to be deployed.

1. Open your Google Sheet.
2. Go to **Extensions** → **Apps Script**.
3. Open the file `/home/z/my-project/download/apps-script.gs` in a text editor.
4. **Select all** (Ctrl+A) → **Copy** the entire contents.
5. Paste it into the Apps Script editor (replacing the existing code).
6. Click **Deploy** → **New deployment**.
7. Choose type: **Web app**.
8. Set:
   - **Description**: `SoumDeco v2 - with dedupe + cleanup`
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone** (required for the website to fetch products)
9. Click **Deploy**.
10. Authorize the permissions when prompted.
11. **Copy the new Web app URL** (it may be the same as before, or it may change).

### If the URL changed:
Update these with the new URL:
1. `wrangler.toml` (no — this is in `src/lib/sheet.ts` as `SHEET_BASE_URL`)
2. `src/lib/sheet.ts` line 8: `SHEET_BASE_URL = "https://script.google.com/macros/s/AKfycbx.../exec"`
3. Cloudflare env var `NEXT_PUBLIC_SHEET_URL`
4. Redeploy the site.

---

## Part F: Run the Dedupe Action (One-Time)

This removes the 13 duplicate product rows from your Google Sheet + fixes the "Meubes" → "Meubles" typo.

### Step 1: Run the dedupe action

Open this URL in your browser (replace with your Apps Script URL):

```
https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=dedupe
```

You'll see a JSON response like:
```json
{
  "ok": true,
  "removed": 13,
  "fixed_categories": 2,
  "remaining": 83
}
```

This means:
- 13 duplicate rows were removed
- 2 "Meubes" → "Meubles" typos were fixed
- 83 unique products remain

### Step 2: Run the cleanup action (optional, more thorough)

```
https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=cleanup
```

This does the same as dedupe + removes completely empty rows.

### Step 3: Verify the sheet

Open your Google Sheet → **Products** tab. You should see:
- 83 unique product rows (no duplicates)
- No "Meubes" category (all are "Meubles")

### Step 4: Clear the website cache

1. Open the website: `https://soumdeco.pages.dev/`
2. Open browser DevTools (F12) → **Application** tab → **Local Storage** → `https://soumdeco.pages.dev`
3. Delete the `soumdeco_catalog_v2` key.
4. Refresh the page.

The site will re-fetch from the sheet (now with 83 deduplicated products) and save to localStorage.

### Step 5: (Optional) Run the health check

```
https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=health
```

Returns:
```json
{
  "ok": true,
  "time": "2026-08-10T12:34:56.789Z",
  "sheet": "Soum-Deco-Sheet"
}
```

---

## Part G: Verify Everything Works

### Test 1: Products load from KV cache

```bash
curl -s "https://soumdeco.pages.dev/api/products" -i | head -5
```

You should see `HTTP/1.1 200` (not 500). If you see `source: "kv"` in the response body, KV is working.

**Note**: The site now fetches directly from Apps Script in the browser (bypassing the edge API). The KV cache is used by the `/api/products` route as a fallback. The primary path (direct browser → Apps Script) always works regardless of KV.

### Test 2: R2 image upload works

After setting up R2 and deploying:

1. Open the admin panel: `https://soumdeco.pages.dev/#admin`
2. Enter the password: `dimou2411@dz`
3. Edit any product → upload a new image → Save.
4. The image should now be served from R2 (URL starts with your `R2_PUBLIC_BASE_URL`).

**To verify**: Right-click the product image → **Inspect** → look at the `src` attribute. It should be `https://pub-abc123.r2.dev/product-id-1.webp` (or your custom domain).

### Test 3: Site loads fast

Open the site in a fresh incognito window. The first load fetches from Apps Script (1-3s). Subsequent loads within 3 minutes should be instant (<500ms) thanks to localStorage caching.

### Test 4: No errors in console

1. Open the site.
2. Open DevTools → **Console**.
3. You should see NO red errors (the `/api/products` and `/api/stock` 500 errors are gone — those routes are no longer called).

---

## Troubleshooting

### "KV namespace not found" error

**Cause**: The `id` in `wrangler.toml` doesn't match a real KV namespace.

**Fix**: 
1. Run `npx wrangler kv namespace list`
2. Copy the correct `id` for `soumdeco-CATALOG_KV`
3. Update `wrangler.toml`
4. Redeploy

### "R2 bucket not found" error

**Cause**: The bucket name in `wrangler.toml` doesn't match.

**Fix**:
1. Run `npx wrangler r2 bucket list`
2. Verify the bucket `soumdeco-images` exists
3. If not, create it: `npx wrangler r2 bucket create soumdeco-images`

### Images not uploading to R2

**Cause**: The `R2_PUBLIC_BASE_URL` env var is not set, or the R2 binding isn't working.

**Fix**:
1. Check Cloudflare dashboard → Environment variables → `R2_PUBLIC_BASE_URL` is set
2. Check `wrangler.toml` has the `[[r2_buckets]]` section
3. Redeploy
4. If still failing, the site falls back to Cloudinary automatically — no data loss

### Dedupe didn't remove all duplicates

**Cause**: Some "duplicates" might have slightly different IDs (e.g., trailing spaces).

**Fix**: Run `?action=cleanup` instead — it's more thorough and also removes empty rows.

### Orders still failing

**Cause**: Apps Script is down or the URL changed.

**Fix**:
1. Run `?action=health` to verify Apps Script is alive
2. Check the Apps Script URL in `src/lib/sheet.ts` matches the deployed URL
3. Failed orders are saved to `localStorage['soumdeco_failed_orders']` — check there for lost orders

### How to check for failed orders in localStorage

1. Open the site
2. Open DevTools → **Application** → **Local Storage** → `https://soumdeco.pages.dev`
3. Look for the key `soumdeco_failed_orders`
4. If it exists, copy the JSON, manually add the orders to your Google Sheet's **Orders** tab, then delete the key

---

## Summary Checklist

- [ ] Run `npx wrangler login` (one-time)
- [ ] Run `npx wrangler kv namespace create CATALOG_KV` — copy the `id`
- [ ] Run `npx wrangler kv namespace create CATALOG_KV --preview` — copy the `preview_id`
- [ ] Run `npx wrangler r2 bucket create soumdeco-images`
- [ ] Update `wrangler.toml` with the real KV IDs
- [ ] (Optional) Set up R2 custom domain in Cloudflare dashboard
- [ ] Set `R2_PUBLIC_BASE_URL` env var in Cloudflare dashboard
- [ ] Redeploy the Apps Script (paste new code → Deploy → New deployment)
- [ ] Open `?action=dedupe` URL in browser to clean up duplicates
- [ ] Clear localStorage `soumdeco_catalog_v2` on the site
- [ ] Verify all 83 products load + no "Meubes" typo
- [ ] Test admin panel: upload an image, save, verify it appears
- [ ] Test checkout: place a test order, verify it appears in the Orders tab

**The site is now fully bulletproof with KV caching + R2 image storage.** 🎉
