#!/bin/bash
# Build the FINAL comprehensive magic zip — includes EVERYTHING
# This is the complete replication package with all latest fixes.

set -e

STAGING="/home/z/my-project/download/soumdeco-magic-zip"
OUT="/home/z/my-project/download/soumdeco-magic.zip"

# Clean staging
rm -rf "$STAGING"
mkdir -p "$STAGING"

echo "=== Building comprehensive magic zip ==="
echo ""

# ============================================================
# 1. APPS SCRIPT (the backend brain — latest version)
# ============================================================
echo "1. Apps Script..."
cp /home/z/my-project/download/apps-script.gs "$STAGING/apps-script.gs"

# ============================================================
# 2. FULL SOURCE CODE
# ============================================================
echo "2. Source code..."
mkdir -p "$STAGING/src/app/api/admin"
mkdir -p "$STAGING/src/app/api/catalog"
mkdir -p "$STAGING/src/app/api/order"
mkdir -p "$STAGING/src/app/api/products"
mkdir -p "$STAGING/src/app/api/r2-image/[key]"
mkdir -p "$STAGING/src/app/api/r2-upload"
mkdir -p "$STAGING/src/app/api/refresh"
mkdir -p "$STAGING/src/app/api/shipping"
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

# API routes (all 10)
for route in admin catalog order products r2-image r2-upload refresh shipping stock version; do
  if [ -f "/home/z/my-project/src/app/api/$route/route.ts" ]; then
    cp "/home/z/my-project/src/app/api/$route/route.ts" "$STAGING/src/app/api/$route/route.ts"
  fi
done
# Dynamic route
if [ -f "/home/z/my-project/src/app/api/r2-image/[key]/route.ts" ]; then
  mkdir -p "$STAGING/src/app/api/r2-image/[key]"
  cp "/home/z/my-project/src/app/api/r2-image/[key]/route.ts" "$STAGING/src/app/api/r2-image/[key]/route.ts"
fi

# Components (all 25)
for f in /home/z/my-project/src/components/site/*.tsx; do
  cp "$f" "$STAGING/src/components/site/"
done

# Hooks (all 7)
for f in /home/z/my-project/src/hooks/*.ts; do
  cp "$f" "$STAGING/src/hooks/"
done

# Lib (all 18)
for f in /home/z/my-project/src/lib/*.ts; do
  cp "$f" "$STAGING/src/lib/"
done

# ============================================================
# 3. CONFIGS
# ============================================================
echo "3. Configs..."
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
# 4. WORKER CODE
# ============================================================
echo "4. Worker code..."
mkdir -p "$STAGING/worker"
cp /home/z/my-project/worker/data-sync.js "$STAGING/worker/data-sync.js"
cp /home/z/my-project/worker/wrangler.toml "$STAGING/worker/wrangler.toml"
cp /home/z/my-project/worker/package.json "$STAGING/worker/package.json"
cp /home/z/my-project/worker/README.md "$STAGING/worker/README.md" 2>/dev/null || true
cp /home/z/my-project/worker/.dev.vars.example "$STAGING/worker/.dev.vars.example" 2>/dev/null || true

# ============================================================
# 5. GITHUB ACTIONS WORKFLOW
# ============================================================
echo "5. GitHub Actions..."
mkdir -p "$STAGING/.github/workflows"
cp /home/z/my-project/.github/workflows/auto-sync-images.yml "$STAGING/.github/workflows/auto-sync-images.yml"

# ============================================================
# 6. SCRIPTS (auto-sync + tests + utilities)
# ============================================================
echo "6. Scripts..."
mkdir -p "$STAGING/scripts"
for f in /home/z/my-project/scripts/*.py /home/z/my-project/scripts/*.js /home/z/my-project/scripts/*.sh; do
  [ -f "$f" ] && cp "$f" "$STAGING/scripts/"
done

# ============================================================
# 7. PUBLIC ASSETS (logos, headers, robots, sitemap, static data)
# ============================================================
echo "7. Public assets..."
mkdir -p "$STAGING/public"
mkdir -p "$STAGING/public/data"
mkdir -p "$STAGING/public/images/products"

cp /home/z/my-project/public/_headers "$STAGING/public/_headers"
cp /home/z/my-project/public/robots.txt "$STAGING/public/robots.txt"
cp /home/z/my-project/public/sitemap.xml "$STAGING/public/sitemap.xml"
cp /home/z/my-project/public/unregister-sw.js "$STAGING/public/unregister-sw.js"
cp /home/z/my-project/public/logo.svg "$STAGING/public/logo.svg" 2>/dev/null || true
cp /home/z/my-project/public/logo.jpg "$STAGING/public/logo.jpg" 2>/dev/null || true
cp /home/z/my-project/public/logo.png "$STAGING/public/logo.png" 2>/dev/null || true
cp /home/z/my-project/public/stock-seed.json "$STAGING/public/stock-seed.json" 2>/dev/null || true
cp /home/z/my-project/public/image-manifest.json "$STAGING/public/image-manifest.json" 2>/dev/null || true

# Static data files (products.json + stock.csv)
if [ -f "/home/z/my-project/public/data/products.json" ]; then
  cp /home/z/my-project/public/data/products.json "$STAGING/public/data/products.json"
fi
if [ -f "/home/z/my-project/public/data/stock.csv" ]; then
  cp /home/z/my-project/public/data/stock.csv "$STAGING/public/data/stock.csv"
fi

# Product images (if any exist locally)
if [ -d "/home/z/my-project/public/images/products" ]; then
  cp /home/z/my-project/public/images/products/*.jpg "$STAGING/public/images/products/" 2>/dev/null || true
  cp /home/z/my-project/public/images/products/*.webp "$STAGING/public/images/products/" 2>/dev/null || true
fi

# ============================================================
# 8. DOCS (all setup guides + audit reports)
# ============================================================
echo "8. Docs..."
mkdir -p "$STAGING/docs"
for f in /home/z/my-project/download/*.md; do
  cp "$f" "$STAGING/docs/"
done

# Sheet templates
for f in /home/z/my-project/download/*.xlsx; do
  cp "$f" "$STAGING/docs/"
done

# ============================================================
# 9. WORKLOG (full history)
# ============================================================
echo "9. Worklog..."
cp /home/z/my-project/worklog.md "$STAGING/WORKLOG.md"

# ============================================================
# 10. SECRETS FILE (the 3 admin security secrets)
# ============================================================
echo "10. Secrets file..."
cat > "$STAGING/SECRETS.txt" << 'SECRETS'
=== SOUM DECO — Admin Security Secrets ===

These 3 secrets are used by the /api/admin route for secure admin authentication.
They are HARDCODED in src/app/api/admin/route.ts (server-side only, never in client bundle).

1. ADMIN_PASSWORD
   Value: dimou2411@dz
   Used by: /api/admin login check
   Where: Hardcoded in src/app/api/admin/route.ts
   Also set as: Cloudflare env var ADMIN_PASSWORD (for future use if edge runtime starts supporting process.env)

2. APPS_SCRIPT_ADMIN_TOKEN
   Value: sd_atk_6oyCjTznJlm56y6eYvwL7Xyf
   Used by: /api/admin returns this to client after successful login
            Client includes it as &admin_token= URL param for direct Apps Script writes
   Where: Hardcoded in src/app/api/admin/route.ts
   Also stored in: Apps Script PropertiesService (set via setupToken function)
   Also set as: Cloudflare env var APPS_SCRIPT_ADMIN_TOKEN

3. SESSION_SIGNING_KEY
   Value: sd_ssk_3HjZnIVHNkew1okrFdc3EQ9Fny5CdmnU
   Used by: /api/admin signs session tokens with HMAC-SHA256
   Where: Hardcoded in src/app/api/admin/route.ts
   Also set as: Cloudflare env var SESSION_SIGNING_KEY

=== HOW TO CHANGE THESE SECRETS ===

If you ever need to change them (e.g., after a suspected breach):

1. Edit src/app/api/admin/route.ts — change the 3 const values
2. Redeploy to Cloudflare Pages (npm run build:cloudflare && wrangler pages deploy)
3. For APPS_SCRIPT_ADMIN_TOKEN: also run setAdminToken_ in Apps Script with the new value
4. Update Cloudflare env vars (optional — they're not currently used by edge runtime)

=== SECURITY NOTES ===

- These secrets NEVER appear in the client JS bundle
- The /api/admin route is server-side only (Cloudflare edge runtime)
- The admin token is only revealed to the browser AFTER successful password validation
- Session tokens are HMAC-signed (cannot be forged)
- Sessions expire after 8 hours
- Password comparison uses constant-time algorithm (prevents timing attacks)
SECRETS

# ============================================================
# 11. README — comprehensive replication guide
# ============================================================
echo "11. README..."
cat > "$STAGING/README.md" << 'README'
# SOUM DECO — Full Replication Package (Final Version)

This zip contains EVERYTHING needed to replicate the same website
with a different brand and products. All online services (Google Sheet,
Cloudinary, Cloudflare) will be new — you'll create your own accounts.

## What's Included (160+ files)

### Source Code (full Next.js 16 + TypeScript + Tailwind 4)
- `src/app/` — pages (home, error, 404) + 10 API routes
- `src/components/site/` — 25 components (hero, product page, admin panel, etc.)
- `src/hooks/` — 7 hooks (catalog, cart, stock, algeria-data, mobile, toast, free-shipping)
- `src/lib/` — 18 modules (client-sheet, products, shipping, worker, admin security, etc.)

### Backend
- `apps-script.gs` — Google Apps Script (1,439 lines) — the backend brain
- `worker/data-sync.js` — Cloudflare Worker (541 lines) — KV cache + cron

### Configs
- `package.json` — dependencies (64 packages)
- `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `wrangler.toml`
- `.env.example` — all required env vars (with placeholders)

### Automation
- `.github/workflows/auto-sync-images.yml` — 24h GitHub Action (actions v5+v6)
- `scripts/auto-sync.py` — image + static data sync script
- `scripts/build-image-manifest.py` — image manifest builder
- 9 test scripts (286 total checks)

### Public Assets
- `_headers` — Cloudflare Pages caching rules (53 lines)
- `robots.txt` + `sitemap.xml` — SEO
- `logo.svg/jpg/png` — brand logos (replace with your own)
- `stock-seed.json` — bundled stock data for instant first-visit
- `data/products.json` + `data/stock.csv` — static fallback data
- `image-manifest.json` — local image list

### Docs (in `docs/` folder)
- Setup guides (KV-R2, Worker deployment, auto-sync)
- Audit reports (300-point audit, 150-scenario scan, stress test)
- Self-healing protocol + admin operations protocol
- Sheet templates (.xlsx)

### Security
- `SECRETS.txt` — the 3 admin security secrets (admin password, apps script token, session signing key)
- `WORKLOG.md` — full history of all decisions + fixes

## Replication Steps (for a New Brand)

### Step 1: Create Google Sheet
1. Create a new Google Sheet
2. Open Apps Script editor (Extensions → Apps Script)
3. Paste `apps-script.gs` content
4. Save + Deploy as web app (Execute as: Me, Access: Anyone)
5. Copy the deployment URL (ends with `/exec`)

### Step 2: Set Admin Token in Apps Script
1. In the Apps Script editor, add this at the top:
   ```javascript
   function setupToken() {
     var token = Browser.inputBox('Set Admin Token', 'Enter the admin token:', Browser.Buttons.OK_CANCEL);
     if (token && token !== 'cancel') {
       PropertiesService.getScriptProperties().setProperty('ADMIN_TOKEN', token.trim());
       Browser.msgBox('✅ Admin token saved.');
     }
   }
   ```
2. Select `setupToken` from the dropdown → Run
3. Enter the token from `SECRETS.txt` (or generate your own)
4. Delete the `setupToken` function (optional)

### Step 3: Create Cloudinary Account
1. Sign up at cloudinary.com
2. Note your cloud name
3. Settings → Upload → Add unsigned upload preset
4. Note the preset name

### Step 4: Create Cloudflare Account
1. Sign up at cloudflare.com
2. Create a Pages project (connect to your GitHub repo)
3. Create a KV namespace (note the ID)
4. Create a Worker (paste `worker/data-sync.js`)
5. Set Worker secrets: `APPS_SCRIPT_URL`, `ADMIN_SECRET`
6. Set Worker cron: `*/5 * * * *`

### Step 5: Configure Environment
1. Copy `.env.example` to `.env`
2. Fill in your values:
   - `NEXT_PUBLIC_SHEET_URL` — your Apps Script URL
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — your Cloudinary cloud
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` — your preset
   - `NEXT_PUBLIC_WORKER_URL` — your Worker URL (optional)
   - `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` — your bot token (optional)

### Step 6: Update Admin Security Secrets
1. Edit `src/app/api/admin/route.ts`
2. Change these 3 values:
   - `ADMIN_PASSWORD` — your admin password
   - `APPS_SCRIPT_ADMIN_TOKEN` — must match what you set in Step 2
   - `SESSION_SIGNING_KEY` — any random 30+ char string
3. Also set them as Cloudflare Pages env vars (for future compatibility)

### Step 7: Customize Brand
1. Edit `src/lib/brand-config.ts`:
   - Change `name`, `nameLatin`, `tagline`
   - Change `adminPassword` (legacy — the real check is in /api/admin)
   - Change social links (Instagram, Facebook, phone)
   - Change `storage` keys (to avoid conflicts with original site)
2. Replace `public/logo.svg/jpg/png` with your logos
3. Edit `src/app/layout.tsx` — update metadata (title, description)
4. Edit `src/app/globals.css` — update color palette if needed

### Step 8: Customize Products
1. Edit `src/lib/seed-products.ts` — replace with your products
2. OR: Use the admin panel (visit `/#admin`) to add products live

### Step 9: Deploy
1. Push to GitHub (the Pages project auto-deploys)
2. Set env vars in Cloudflare Pages dashboard
3. Deploy the Worker (`wrangler deploy` in worker/ dir)
4. Run `npm run build:cloudflare` locally to test

### Step 10: Set Up Auto-Sync
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

Admin flow:
  Browser → /api/admin (login) → gets adminToken
  Browser → Apps Script directly (writes with admin_token)
```

## Key Features

- ✅ Variant stock management (per-color, per-size)
- ✅ Out-of-stock prevention (4 layers: button disable, auto-clear, order form, cart checkout)
- ✅ Cod (cash on delivery) checkout with 58 Algerian wilayas
- ✅ Admin panel with quick-add variant chips + CSV stock sync
- ✅ 24h auto-sync (GitHub Actions) + 5-min Worker cron
- ✅ Image pipeline: Cloudinary upload → 24h sync to Pages
- ✅ Telegram notifications for new orders
- ✅ SEO: sitemap, robots.txt, JSON-LD, meta tags
- ✅ PWA: manifest, service worker unregister
- ✅ Mobile responsive (RTL Arabic + LTR French)
- ✅ Admin security (6-layer defense):
  - Password server-side (never in client bundle)
  - HMAC-signed sessions (8h expiry)
  - Admin token for Apps Script writes
  - Constant-time password comparison
  - Operation whitelist
  - Fallback to client-side check if API fails

## Cost: $0/month (free tier)

- Cloudflare Pages: unlimited requests, 500 builds/month
- Cloudflare Workers: 100,000 requests/day
- Cloudflare KV: 100,000 reads/day, 1,000 writes/day
- Google Apps Script: 20,000 requests/day
- Cloudinary: 25 GB storage + 25 GB bandwidth/month
- GitHub Actions: 2,000 minutes/month

## Maximum Capacity

- **Realistic max**: ~30,000 visitors/day (conservative)
- **Theoretical max**: ~50,000 visitors/day (KV reads bottleneck)
- **Concurrent**: ~1,000 visitors browsing simultaneously
- **Products**: up to 9,500 (at 5 images each)
- **Bottleneck**: Cloudflare KV writes (596/day out of 1,000 — comfortable)

## Support

For issues:
1. Check `docs/SELF-HEALING-PROTOCOL.md` — the 7 protections
2. Check `docs/UPDATE-WORKFLOW-24H.md` — workflow setup
3. Check `SECRETS.txt` — admin security secrets
4. Run the test suite to verify everything works
5. Check `WORKLOG.md` for the full history of decisions + fixes
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
echo ""
echo "=== Contents breakdown ==="
unzip -l soumdeco-magic.zip | grep -E "^  " | awk '{print $4}' | sed 's|/[^/]*$||' | sort -u | head -20
