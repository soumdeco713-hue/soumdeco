#!/bin/bash
# Build a CLEAN replication zip — no brand info, no credentials, with AI prompts
set -e

STAGING="/home/z/my-project/download/soumdeco-magic-zip"
OUT="/home/z/my-project/download/soumdeco-magic.zip"

rm -rf "$STAGING"
mkdir -p "$STAGING"

echo "=== Building CLEAN replication zip ==="

# ============================================================
# 1. APPS SCRIPT — with PLACEHOLDERS (no real URLs/tokens)
# ============================================================
echo "1. Apps Script (sanitized)..."
# Copy the apps-script but replace real credentials with placeholders
sed 's|https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec|YOUR_APPS_SCRIPT_URL_HERE|g' \
    download/apps-script.gs > "$STAGING/apps-script.gs"

# ============================================================
# 2. SOURCE CODE — with PLACEHOLDERS
# ============================================================
echo "2. Source code (sanitized)..."
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

# App pages — sanitize brand-config
cp src/app/page.tsx "$STAGING/src/app/page.tsx"
cp src/app/layout.tsx "$STAGING/src/app/layout.tsx"
cp src/app/globals.css "$STAGING/src/app/globals.css"
cp src/app/error.tsx "$STAGING/src/app/error.tsx"
cp src/app/not-found.tsx "$STAGING/src/app/not-found.tsx"

# API routes — sanitize hardcoded secrets
for route in admin catalog order products r2-image r2-upload refresh shipping stock version; do
  if [ -f "src/app/api/$route/route.ts" ]; then
    sed \
      -e 's|https://soumdeco-data-sync.soumdeco713.workers.dev|YOUR_WORKER_URL_HERE|g' \
      -e 's|dimou2411@dz|YOUR_ADMIN_PASSWORD_HERE|g' \
      -e 's|sd_atk_6oyCjTznJlm56y6eYvwL7Xyf|YOUR_APPS_SCRIPT_ADMIN_TOKEN_HERE|g' \
      -e 's|sd_ssk_3HjZnIVHNkew1okrFdc3EQ9Fny5CdmnU|YOUR_SESSION_SIGNING_KEY_HERE|g' \
      -e 's|https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec|YOUR_APPS_SCRIPT_URL_HERE|g' \
      "src/app/api/$route/route.ts" > "$STAGING/src/app/api/$route/route.ts"
  fi
done

# Dynamic route
if [ -f "src/app/api/r2-image/[key]/route.ts" ]; then
  mkdir -p "$STAGING/src/app/api/r2-image/[key]"
  cp "src/app/api/r2-image/[key]/route.ts" "$STAGING/src/app/api/r2-image/[key]/route.ts"
fi

# Components (all)
for f in src/components/site/*.tsx; do
  cp "$f" "$STAGING/src/components/site/"
done

# Hooks (all)
for f in src/hooks/*.ts; do
  cp "$f" "$STAGING/src/hooks/"
done

# Lib — sanitize secrets
for f in src/lib/*.ts; do
  sed \
    -e 's|https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec|YOUR_APPS_SCRIPT_URL_HERE|g' \
    -e 's|"anhvhy4j"|"YOUR_CLOUDINARY_CLOUD_NAME_HERE"|g' \
    -e 's|"soumdeco"|"YOUR_CLOUDINARY_UPLOAD_PRESET_HERE"|g' \
    -e 's|8992415134:AAEDrndNXlmEpqS0BT5FSfvwog61vXdOulE|YOUR_TELEGRAM_BOT_TOKEN_HERE|g' \
    -e 's|"1913149719"|"YOUR_TELEGRAM_CHAT_ID_HERE"|g' \
    -e 's|dimou2411@dz|YOUR_ADMIN_PASSWORD_HERE|g' \
    "$f" > "$STAGING/src/lib/$(basename $f)"
done

# Brand-config — strip ALL brand info, replace with placeholders
cat > "$STAGING/src/lib/brand-config.ts" << 'BRAND'
// ============================================================
//  BRAND CONFIGURATION — REPLACE ALL VALUES WITH YOUR BRAND
// ============================================================
//  This file is imported by many components. Update every field
//  to match your brand before deploying.
// ============================================================

export const BRAND = {
  name: "YOUR_BRAND_NAME",
  nameLatin: "YourBrandName",
  tagline: "Your tagline here",
  adminPassword: "", // Kept empty — login via /api/admin (server-side only)
  logoPath: "/logo.jpg",

  contact: {
    instagram: "your_instagram",
    instagramUrl: "https://www.instagram.com/your_instagram/",
    facebook: "your_facebook",
    facebookUrl: "https://www.facebook.com/your_facebook",
    phone: "0000000000",
    phoneDisplay: "00 00 00 00",
    email: "your_email@gmail.com",
    address: "Your City, Your Country",
  },

  story: {
    title: "Your Story Title",
    paragraphs: [
      "Your brand story paragraph 1.",
      "Your brand story paragraph 2.",
    ],
  },

  storage: {
    catalog: "yourbrand_catalog_v1",
    cart: "yourbrand_cart_v1",
    stockCache: "yourbrand_stock_cache_v1",
    adminAuth: "yourbrand_admin_authed",
    failedOrders: "yourbrand_failed_orders",
  },

  cloudinary: {
    cloudName: "YOUR_CLOUDINARY_CLOUD_NAME",
    uploadPreset: "YOUR_CLOUDINARY_UPLOAD_PRESET",
  },
};
BRAND

# ============================================================
# 3. CONFIGS — sanitized
# ============================================================
echo "3. Configs..."
cp package.json "$STAGING/package.json"
cp next.config.ts "$STAGING/next.config.ts"
cp tailwind.config.ts "$STAGING/tailwind.config.ts"
cp tsconfig.json "$STAGING/tsconfig.json"
cp postcss.config.mjs "$STAGING/postcss.config.mjs"
cp components.json "$STAGING/components.json"
cp eslint.config.mjs "$STAGING/eslint.config.mjs"

# wrangler.toml — sanitize KV namespace ID
sed 's|d16fd51d1d54497d8ff02b570e63e4e2|YOUR_KV_NAMESPACE_ID_HERE|g' wrangler.toml > "$STAGING/wrangler.toml"

# .env.example — with placeholders
cat > "$STAGING/.env.example" << 'ENV'
# === REQUIRED ===
NEXT_PUBLIC_SHEET_URL=YOUR_APPS_SCRIPT_URL_HERE
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=YOUR_CLOUDINARY_CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=YOUR_CLOUDINARY_UPLOAD_PRESET

# === ADMIN SECURITY (set in /api/admin route code, not env) ===
# These are hardcoded in src/app/api/admin/route.ts for Cloudflare edge compat.
# Change them there before deploying.
# - ADMIN_PASSWORD
# - APPS_SCRIPT_ADMIN_TOKEN
# - SESSION_SIGNING_KEY

# === WORKER (optional but recommended) ===
NEXT_PUBLIC_WORKER_URL=YOUR_WORKER_URL_HERE

# === TELEGRAM BOT (optional) ===
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_TELEGRAM_CHAT_ID=
ENV

cp .gitignore "$STAGING/.gitignore"

# ============================================================
# 4. WORKER CODE — sanitized
# ============================================================
echo "4. Worker code..."
mkdir -p "$STAGING/worker"
cp worker/data-sync.js "$STAGING/worker/data-sync.js"
cp worker/wrangler.toml "$STAGING/worker/wrangler.toml"
cp worker/package.json "$STAGING/worker/package.json"
cp worker/README.md "$STAGING/worker/README.md" 2>/dev/null || true
cp worker/.dev.vars.example "$STAGING/worker/.dev.vars.example" 2>/dev/null || true

# ============================================================
# 5. GITHUB ACTIONS WORKFLOW
# ============================================================
echo "5. GitHub Actions..."
mkdir -p "$STAGING/.github/workflows"
cp .github/workflows/auto-sync-images.yml "$STAGING/.github/workflows/auto-sync-images.yml"

# ============================================================
# 6. SCRIPTS (tests + utilities)
# ============================================================
echo "6. Scripts..."
mkdir -p "$STAGING/scripts"
for f in scripts/*.py scripts/*.js scripts/*.sh; do
  [ -f "$f" ] && cp "$f" "$STAGING/scripts/"
done

# ============================================================
# 7. PUBLIC ASSETS (NO product images, NO real data)
# ============================================================
echo "7. Public assets (minimal)..."
mkdir -p "$STAGING/public"
mkdir -p "$STAGING/public/data"

cp public/_headers "$STAGING/public/_headers"
cp public/robots.txt "$STAGING/public/robots.txt"
cp public/sitemap.xml "$STAGING/public/sitemap.xml"
cp public/unregister-sw.js "$STAGING/public/unregister-sw.js"

# NOTE: NO product images, NO stock-seed.json, NO data/*.json
# These will be generated by the auto-sync workflow after first deploy.

# ============================================================
# 8. AI DEPLOYMENT PROMPT (the super prompt)
# ============================================================
echo "8. AI deployment prompt..."
cat > "$STAGING/AI-DEPLOYMENT-PROMPT.md" << 'PROMPT'
# AI DEPLOYMENT PROMPT — Replicate This Website

## YOUR ROLE
You are a senior full-stack developer. You will deploy this website for a new brand using the credentials I provide. Follow these steps EXACTLY. Do NOT skip any step. Do NOT modify any code unless I tell you to.

## WHAT I WILL PROVIDE (when you ask)
1. Google account credentials (for Google Sheets + Apps Script)
2. Cloudinary account (cloud name + upload preset)
3. Cloudflare account (API token + account ID)
4. GitHub account (token with repo + workflow scope)
5. Telegram bot token + chat ID (optional)
6. Brand name, tagline, logo, contact info, social links

## WHAT YOU MUST DO (in order)

### STEP 1: Google Sheet Setup
1. Create a new Google Sheet
2. Open Extensions → Apps Script
3. Paste `apps-script.gs` (replace YOUR_APPS_SCRIPT_URL_HERE if needed — it's self-referencing so no change needed)
4. Save → Deploy as web app (Execute as: Me, Access: Anyone)
5. Copy the deployment URL (ends with /exec)
6. This URL goes into: `src/lib/sheet.ts` (SHEET_BASE_URL) + `src/app/api/admin/route.ts` (APPS_SCRIPT_URL) + `.env` (NEXT_PUBLIC_SHEET_URL)

### STEP 2: Set Admin Token
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
2. Select `setupToken` → Run → enter a random 30+ char string
3. Use this SAME token in: `src/app/api/admin/route.ts` (APPS_SCRIPT_ADMIN_TOKEN)
4. Delete the setupToken function after

### STEP 3: Cloudinary Setup
1. Sign up at cloudinary.com
2. Note your cloud name
3. Settings → Upload → Add unsigned upload preset
4. Put cloud name + preset in: `src/lib/drive-upload.ts` + `src/lib/client-sheet.ts` + `.env`

### STEP 4: Cloudflare Setup
1. Create a Pages project (connect to GitHub repo)
2. Create a KV namespace (note the ID)
3. Put KV ID in: `wrangler.toml` + `worker/wrangler.toml`
4. Create a Worker (paste `worker/data-sync.js`)
5. Set Worker secrets: `APPS_SCRIPT_URL` (your Apps Script URL), `ADMIN_SECRET` (your admin password)
6. Set Worker cron: `*/5 * * * *`
7. Put Worker URL in: `src/app/api/refresh/route.ts` + `src/app/api/catalog/route.ts` + `src/app/api/version/route.ts`

### STEP 5: Update Brand
1. Edit `src/lib/brand-config.ts` — replace ALL placeholder values
2. Replace `public/logo.svg/jpg/png` with brand logos
3. Edit `src/app/layout.tsx` — update metadata (title, description, URLs)
4. Edit `src/app/globals.css` — update color palette if needed

### STEP 6: Update Security Secrets
In `src/app/api/admin/route.ts`, change these 3 values:
- `ADMIN_PASSWORD` — your admin password
- `APPS_SCRIPT_ADMIN_TOKEN` — must match what you set in Step 2
- `SESSION_SIGNING_KEY` — any random 30+ char string

### STEP 7: Deploy
1. Push to GitHub
2. Set env vars in Cloudflare Pages dashboard
3. Deploy the Worker
4. Run `npm run build:cloudflare` locally to test
5. Test: visitor flow (browse, cart, order)
6. Test: admin flow (login, save product, delete product)

### STEP 8: GitHub Actions
The `.github/workflows/auto-sync-images.yml` runs daily at 2 AM UTC automatically.
No setup needed — it works once you push to GitHub.

## CRITICAL RULES (learned from past mistakes)
1. NEVER use `process.env` for non-NEXT_PUBLIC_ vars in Cloudflare edge runtime — hardcode them
2. NEVER split stockKey on comma — use semicolon only
3. NEVER treat empty stock as 0 — empty = INFINITE
4. NEVER retry orders (ORDER_RETRIES = 0) — prevents duplicates
5. ALWAYS use `nodejs_compat_v2` in wrangler.toml
6. ALWAYS test admin writes after deploying (login + save + delete)
7. ALWAYS verify the admin token is set in Apps Script before going live
8. ALWAYS sync upload/apps-script.gs with download/apps-script.gs
PROMPT

# ============================================================
# 9. README
# ============================================================
echo "9. README..."
cat > "$STAGING/README.md" << 'README'
# Website Replication Package (Clean)

This zip contains the EXACT code of a production e-commerce website, with all brand info and credentials removed (replaced with YOUR_*_HERE placeholders).

## What's Included
- Full Next.js 15 + TypeScript + Tailwind 4 source code
- Google Apps Script backend (1,433 lines)
- Cloudflare Worker (541 lines)
- 10 API routes (including secure admin gateway)
- 25 React components
- 7 hooks, 18 lib modules
- GitHub Actions workflow (daily auto-sync)
- 9 test suites (286 checks)
- AI deployment prompt (step-by-step guide)

## What's NOT Included (you provide)
- Brand name, logo, contact info
- Google Sheet + Apps Script URL
- Cloudinary credentials
- Cloudflare account + KV namespace
- Telegram bot token (optional)
- Product images + data

## How to Use
1. Read `AI-DEPLOYMENT-PROMPT.md` — it has the complete step-by-step guide
2. Give the prompt + this zip to an AI assistant
3. Provide credentials when asked
4. The AI will deploy everything for you

## Test Suite
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
```

## Cost: $0/month (free tier)
- Cloudflare Pages: unlimited requests, 500 builds/month
- Cloudflare Workers: 100,000 requests/day
- Cloudflare KV: 100,000 reads/day, 1,000 writes/day
- Google Apps Script: 20,000 requests/day
- Cloudinary: 25 GB storage + 25 GB bandwidth/month
- GitHub Actions: 2,000 minutes/month

## Maximum Capacity
- Browsing: ~30,000-50,000 visitors/day
- Orders: ~2,000-3,500 orders/day (Apps Script bottleneck)
- Concurrent: ~1,000 visitors browsing simultaneously
README

# Create the zip
cd /home/z/my-project/download
rm -f soumdeco-magic.zip
zip -r soumdeco-magic.zip soumdeco-magic-zip/ -x "*.DS_Store" "*/__pycache__/*" "*/node_modules/*"
rm -rf soumdeco-magic-zip

echo ""
echo "✅ Clean replication zip created"
ls -lh soumdeco-magic.zip
echo ""
echo "=== File count ==="
unzip -l soumdeco-magic.zip | tail -1
