#!/bin/bash
# Build the comprehensive magic zip — full replication package for SOUM DECO
# Intended for replicating the same website with a different brand/products.
# All online things (sheet, Cloudinary, Cloudflare) will be new/changed.

set -e

STAGING="/home/z/my-project/download/soumdeco-magic-zip"
OUT="/home/z/my-project/download/soumdeco-magic.zip"

# Clean staging
rm -rf "$STAGING"
mkdir -p "$STAGING"

# ============================================================
# 1. Apps Script (the backend brain)
# ============================================================
cp /home/z/my-project/download/apps-script.gs "$STAGING/apps-script.gs"
cp /home/z/my-project/upload/apps-script.gs "$STAGING/apps-script-upload.gs" 2>/dev/null || true

# ============================================================
# 2. Full source code (for replication)
# ============================================================
mkdir -p "$STAGING/src/app/api/catalog"
mkdir -p "$STAGING/src/app/api/order"
mkdir -p "$STAGING/src/app/api/products"
mkdir -p "$STAGING/src/app/api/r2-image/[key]"
mkdir -p "$STAGING/src/app/api/r2-upload"
mkdir -p "$STAGING/src/app/api/refresh"
mkdir -p "$STAGING/src/app/api/stock"
mkdir -p "$STAGING/src/app/api/version"
mkdir -p "$STAGING/src/components/site"
mkdir -p "$STAGING/src/hooks"
mkdir -p "$STAGING/src/lib"

# App pages
cp /home/z/my-project/src/app/page.tsx "$STAGING/src/app/page.tsx"
cp /home/z/my-project/src/app/layout.tsx "$STAGING/src/app/layout.tsx"
cp /home/z/my-project/src/app/globals.css "$STAGING/src/app/globals.css"
cp /home/z/my-project/src/app/error.tsx "$STAGING/src/app/error.tsx"
cp /home/z/my-project/src/app/not-found.tsx "$STAGING/src/app/not-found.tsx"

# API routes
for route in catalog order products r2-image r2-upload refresh stock version; do
  if [ -f "/home/z/my-project/src/app/api/$route/route.ts" ]; then
    cp "/home/z/my-project/src/app/api/$route/route.ts" "$STAGING/src/app/api/$route/route.ts"
  fi
done
# Dynamic route (r2-image/[key])
if [ -f "/home/z/my-project/src/app/api/r2-image/[key]/route.ts" ]; then
  mkdir -p "$STAGING/src/app/api/r2-image/[key]"
  cp "/home/z/my-project/src/app/api/r2-image/[key]/route.ts" "$STAGING/src/app/api/r2-image/[key]/route.ts"
fi

# Components (all 23)
for f in /home/z/my-project/src/components/site/*.tsx; do
  cp "$f" "$STAGING/src/components/site/"
done

# Hooks (all 6 — use-free-shipping.ts was deleted)
for f in /home/z/my-project/src/hooks/*.ts; do
  cp "$f" "$STAGING/src/hooks/"
done

# Lib (all 19)
for f in /home/z/my-project/src/lib/*.ts; do
  cp "$f" "$STAGING/src/lib/"
done

# ============================================================
# 3. Configs
# ============================================================
cp /home/z/my-project/package.json "$STAGING/package.json"
cp /home/z/my-project/next.config.ts "$STAGING/next.config.ts"
cp /home/z/my-project/tailwind.config.ts "$STAGING/tailwind.config.ts"
cp /home/z/my-project/tsconfig.json "$STAGING/tsconfig.json"
cp /home/z/my-project/postcss.config.mjs "$STAGING/postcss.config.mjs"
cp /home/z/my-project/components.json "$STAGING/components.json"
cp /home/z/my-project/eslint.config.mjs "$STAGING/eslint.config.mjs"
cp /home/z/my-project/wrangler.toml "$STAGING/wrangler.toml"
cp /home/z/my-project/.env.example "$STAGING/.env.example"
cp /home/z/my-project/.gitignore "$STAGING/.gitignore"

# ============================================================
# 4. Worker code
# ============================================================
mkdir -p "$STAGING/worker"
cp /home/z/my-project/worker/data-sync.js "$STAGING/worker/data-sync.js"
cp /home/z/my-project/worker/wrangler.toml "$STAGING/worker/wrangler.toml"
cp /home/z/my-project/worker/package.json "$STAGING/worker/package.json"
cp /home/z/my-project/worker/README.md "$STAGING/worker/README.md" 2>/dev/null || true

# ============================================================
# 5. GitHub Actions workflow
# ============================================================
mkdir -p "$STAGING/.github/workflows"
cp /home/z/my-project/.github/workflows/auto-sync-images.yml "$STAGING/.github/workflows/auto-sync-images.yml"

# ============================================================
# 6. Scripts (auto-sync + tests + utilities)
# ============================================================
mkdir -p "$STAGING/scripts"
for f in /home/z/my-project/scripts/*.py /home/z/my-project/scripts/*.js /home/z/my-project/scripts/*.sh; do
  [ -f "$f" ] && cp "$f" "$STAGING/scripts/"
done

# ============================================================
# 7. Public assets (logos, headers, robots, sitemap)
# ============================================================
mkdir -p "$STAGING/public"
cp /home/z/my-project/public/_headers "$STAGING/public/_headers"
cp /home/z/my-project/public/robots.txt "$STAGING/public/robots.txt"
cp /home/z/my-project/public/sitemap.xml "$STAGING/public/sitemap.xml"
cp /home/z/my-project/public/unregister-sw.js "$STAGING/public/unregister-sw.js"
cp /home/z/my-project/public/logo.svg "$STAGING/public/logo.svg" 2>/dev/null || true
cp /home/z/my-project/public/logo.jpg "$STAGING/public/logo.jpg" 2>/dev/null || true
cp /home/z/my-project/public/logo.png "$STAGING/public/logo.png" 2>/dev/null || true

# ============================================================
# 8. Docs (all setup guides + audit reports)
# ============================================================
mkdir -p "$STAGING/docs"
for f in /home/z/my-project/download/*.md; do
  cp "$f" "$STAGING/docs/"
done

# ============================================================
# 9. Worklog (full history)
# ============================================================
cp /home/z/my-project/worklog.md "$STAGING/WORKLOG.md"

# ============================================================
# 10. README — replication guide
# ============================================================
cat > "$STAGING/README.md" << 'README'
# SOUM DECO — Full Replication Package

This zip contains EVERYTHING needed to replicate the same website
with a different brand and products. All online services (Google Sheet,
Cloudinary, Cloudflare) will be new — you'll create your own accounts.

## What's Included

### Source Code (full Next.js 16 + TypeScript + Tailwind 4)
- `src/app/` — pages (home, error, 404) + 9 API routes
- `src/components/site/` — 23 components (hero, product page, admin panel, etc.)
- `src/hooks/` — 6 hooks (catalog, cart, stock, algeria-data, mobile, toast)
- `src/lib/` — 19 modules (client-sheet, products, shipping, worker, etc.)

### Backend
- `apps-script.gs` — Google Apps Script (1,353 lines) — the backend brain
- `worker/data-sync.js` — Cloudflare Worker (541 lines) — KV cache + cron

### Configs
- `package.json` — dependencies (64 packages)
- `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `wrangler.toml`
- `.env.example` — all required env vars (with placeholders)

### Automation
- `.github/workflows/auto-sync-images.yml` — 24h GitHub Action
- `scripts/auto-sync.py` — image + static data sync script
- `scripts/build-image-manifest.py` — image manifest builder
- 9 test scripts (286 total checks)

### Public Assets
- `_headers` — Cloudflare Pages caching rules
- `robots.txt` + `sitemap.xml` — SEO
- `logo.svg/jpg/png` — brand logos (replace with your own)

### Docs (in `docs/` folder)
- Setup guides (KV-R2, Worker deployment, auto-sync)
- Audit reports (300-point audit, 150-scenario scan, stress test)
- Self-healing protocol + admin operations protocol

## Replication Steps (for a New Brand)

### Step 1: Create Google Sheet
1. Create a new Google Sheet
2. Open Apps Script editor (Extensions → Apps Script)
3. Paste `apps-script.gs` content
4. Save + Deploy as web app (Execute as: Me, Access: Anyone)
5. Copy the deployment URL (ends with `/exec`)

### Step 2: Create Cloudinary Account
1. Sign up at cloudinary.com
2. Note your cloud name
3. Settings → Upload → Add unsigned upload preset
4. Note the preset name

### Step 3: Create Cloudflare Account
1. Sign up at cloudflare.com
2. Create a Pages project (connect to your GitHub repo)
3. Create a KV namespace (note the ID)
4. Create a Worker (paste `worker/data-sync.js`)
5. Set Worker secrets: `APPS_SCRIPT_URL`, `ADMIN_SECRET`
6. Set Worker cron: `*/5 * * * *`

### Step 4: Configure Environment
1. Copy `.env.example` to `.env`
2. Fill in your values:
   - `NEXT_PUBLIC_SHEET_URL` — your Apps Script URL
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — your Cloudinary cloud
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — your preset
   - `NEXT_PUBLIC_WORKER_URL` — your Worker URL (optional)
   - `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` — your bot token (optional)

### Step 5: Customize Brand
1. Edit `src/lib/brand-config.ts`:
   - Change `name`, `nameLatin`, `tagline`
   - Change `adminPassword`
   - Change social links (Instagram, Facebook, phone)
   - Change `storage` keys (to avoid conflicts with original site)
2. Replace `public/logo.svg/jpg/png` with your logos
3. Edit `src/app/layout.tsx` — update metadata (title, description)
4. Edit `src/app/globals.css` — update color palette if needed

### Step 6: Customize Products
1. Edit `src/lib/seed-products.ts` — replace with your products
2. OR: Use the admin panel (visit `/#admin`) to add products live

### Step 7: Deploy
1. Push to GitHub (the Pages project auto-deploys)
2. Set env vars in Cloudflare Pages dashboard
3. Deploy the Worker (`wrangler deploy` in worker/ dir)
4. Run `npm run build:cloudflare` locally to test

### Step 8: Set Up Auto-Sync
1. The `.github/workflows/auto-sync-images.yml` runs daily at 2 AM UTC
2. It downloads new Cloudinary images to `public/images/products/`
3. It updates `public/stock-seed.json` + `public/data/*.json` (static fallback)
4. No setup needed — works automatically once you push to GitHub

## Test Suite

Run all 286 tests to verify everything works:
```bash
node scripts/test-comprehensive.js    # 212 checks
node scripts/test-stock-logic.js      # 7 checks
node scripts/test-variant-flow.js     # 4 checks
node scripts/test-server-extraction.js # 6 checks
node scripts/test-notes-extraction.js # 8 checks
node scripts/test-comma-bug-fix.js    # 2 checks
node scripts/test-stock-sync.js       # 11 checks
node scripts/test-cart-rapture.js     # 18 checks
node scripts/test-worker-wiring.js    # 18 checks
node scripts/verify-apps-script.js    # syntax check
```

## Architecture

```
Visitor → Cloudflare Pages (static HTML + JS)
                ↓
         /api/catalog (Pages Function)
                ↓
         Cloudflare Worker (KV cache, 5-min TTL)
                ↓
         Google Apps Script (source of truth)
                ↓
         Google Sheet (Products + Orders + Stock tabs)

Fallback chain:
  Worker (5-min KV) → static JSON (24h) → localStorage → seed data
```

## Key Features

- ✅ Variant stock management (per-color, per-size)
- ✅ Out-of-stock prevention (4 layers: button disable, auto-clear, order form, cart checkout)
- ✅ Cod (cash on delivery) checkout with 58 Algerian wilayas
- ✅ Admin panel with quick-add variant chips
- ✅ 24h auto-sync (GitHub Actions) + 5-min Worker cron
- ✅ Image pipeline: Cloudinary upload → 24h sync to Pages
- ✅ Telegram notifications for new orders
- ✅ SEO: sitemap, robots.txt, JSON-LD, meta tags
- ✅ PWA: manifest, service worker unregister
- ✅ Mobile responsive (RTL Arabic + LTR French)

## Cost: $0/month (free tier)

- Cloudflare Pages: unlimited requests, 500 builds/month
- Cloudflare Workers: 100,000 requests/day
- Cloudflare KV: 100,000 reads/day, 1,000 writes/day
- Google Apps Script: 20,000 requests/day
- Cloudinary: 25 GB storage + 25 GB bandwidth/month
- GitHub Actions: 2,000 minutes/month

## Support

For issues:
1. Check `docs/SELF-HEALING-PROTOCOL.md` — the 7 protections
2. Check `docs/UPDATE-WORKFLOW-24H.md` — workflow setup
3. Run the test suite to verify everything works
4. Check `WORKLOG.md` for the full history of decisions + fixes
README

# Create the zip
cd /home/z/my-project/download
rm -f soumdeco-magic.zip
zip -r soumdeco-magic.zip soumdeco-magic-zip/ -x "*.DS_Store" "*/__pycache__/*" "*/node_modules/*"
rm -rf soumdeco-magic-zip

echo ""
echo "✅ Magic zip created: /home/z/my-project/download/soumdeco-magic.zip"
ls -lh soumdeco-magic.zip
echo ""
echo "=== File count ==="
unzip -l soumdeco-magic.zip | tail -1
