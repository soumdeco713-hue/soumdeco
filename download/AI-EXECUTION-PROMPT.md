# AI EXECUTION PROMPT — SOUM DECO E-Commerce Website

**Read this ENTIRE file before doing anything. Follow every step in order. Do NOT skip steps.**

---

## PROJECT OVERVIEW

This is a **French-Algerian home decor e-commerce website** called "SOUM DECO". It sells:
- Arts de la table (tableware)
- Cuisine (kitchen items)
- Lampes de chevet (bedside lamps)
- Décoration (decorative items)
- Meubles (furniture)
- Miroirs (mirrors)
- Électroménager (appliances)

**Target audience:** Algerian customers, Arabic + French speakers, COD (cash on delivery) in 58 wilayas.

**Tech stack:**
- Frontend: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Database: Google Sheets (via Google Apps Script)
- Image hosting: Cloudinary (instant uploads) + Cloudflare Pages (bulk serving)
- Hosting: Cloudflare Pages (edge runtime, unlimited bandwidth)
- Admin panel: Built-in (password-protected, at `/#admin`)

---

## WHAT'S IN THE ZIP

```
soumdeco_winning_cloudflare_magic.zip
├── src/                          # Next.js source code
│   ├── app/                      # App router pages
│   │   ├── page.tsx              # Main page (home + product + admin views)
│   │   ├── layout.tsx            # Root layout (fonts, SEO, noscript fallback)
│   │   ├── error.tsx             # Route-level error boundary
│   │   ├── not-found.tsx         # 404 page
│   │   ├── globals.css           # Tailwind + custom styles
│   │   └── api/                  # API routes (edge functions)
│   │       ├── products/route.ts # Products API (KV cache + sheet fallback)
│   │       ├── stock/route.ts    # Stock API (KV cache + sheet fallback)
│   │       ├── order/route.ts    # Order submission API
│   │       ├── r2-upload/         # R2 image upload (disabled, needs credit card)
│   │       └── r2-image/[key]/   # R2 image serving (disabled)
│   ├── components/site/          # React components
│   │   ├── hero.tsx              # Hero section (logo + tagline)
│   │   ├── featured-carousel.tsx # Featured products carousel
│   │   ├── product-card.tsx      # Product card (grid view)
│   │   ├── product-page.tsx      # Product detail page
│   │   ├── product-image.tsx     # Image rendering (lazy + fallback)
│   │   ├── cart-bar.tsx          # Cart drawer
│   │   ├── checkout-modal.tsx    # Checkout flow
│   │   ├── cod-order-form.tsx    # COD order form
│   │   ├── admin-panel.tsx       # Admin panel (CRUD products)
│   │   ├── admin-image-preview.tsx # Admin image preview with fallback
│   │   ├── error-boundary.tsx    # React error boundary
│   │   ├── loading-fallback.tsx  # Stuck-loading detection + refresh
│   │   ├── manifest-preloader.tsx # Image manifest preloader
│   │   ├── health-monitor-starter.tsx # Network health monitor
│   │   ├── all-products.tsx      # All products grid
│   │   ├── categories.tsx        # Category filter
│   │   ├── special-offers-section.tsx # Special offers
│   │   ├── brand-story.tsx       # Brand story section
│   │   ├── site-menu.tsx         # Side menu
│   │   ├── site-footer.tsx       # Footer
│   │   └── ...
│   ├── hooks/                    # React hooks
│   │   ├── use-catalog.ts        # Product catalog state (fetch + cache)
│   │   ├── use-cart.ts           # Cart state (localStorage + validation)
│   │   └── use-stock.ts          # Stock state (cache + seed)
│   ├── lib/                      # Core logic
│   │   ├── products.ts           # Product types, seed data, helpers
│   │   ├── sheet.ts              # Google Apps Script URL + helpers
│   │   ├── client-sheet.ts       # Client-side Apps Script fetcher (timeout + retry)
│   │   ├── image-manifest.ts     # Image manifest loader (local vs Cloudinary)
│   │   ├── adaptive-storage.ts   # localStorage → IndexedDB fallback
│   │   ├── failed-orders.ts      # Failed order retry queue
│   │   ├── health-monitor.ts     # Network connectivity monitor
│   │   ├── r2-upload.ts          # R2 upload helper (disabled)
│   │   ├── drive-upload.ts       # Cloudinary upload helper
│   │   ├── brand-config.ts       # Brand settings (name, password, contact)
│   │   ├── algeria-data.ts       # 58 wilayas + shipping prices
│   │   └── shipping.ts           # Shipping price calculator
│   └── hooks/use-algeria-data.ts # Wilaya/commune data loader
├── public/                       # Static assets
│   ├── images/products/          # 109 product images (served from Pages)
│   ├── image-manifest.json       # List of local images (built by script)
│   ├── stock-seed.json           # Bundled stock data (instant first load)
│   ├── _headers                  # Cache-control headers (no stale HTML)
│   ├── unregister-sw.js          # Removes old service worker
│   ├── logo.jpg                  # Site logo
│   └── robots.txt                # SEO robots
├── scripts/                     # Automation scripts
│   ├── auto-sync.py              # Daily image + stock sync (GitHub Actions)
│   └── build-image-manifest.py  # Builds image-manifest.json
├── .github/workflows/
│   └── auto-sync-images.yml      # GitHub Actions cron (daily at 2 AM UTC)
├── download/                     # Documentation + setup guides
│   ├── apps-script.gs            # Google Apps Script code (deploy to Sheet)
│   ├── Soum-Deco-Sheet-Template.xlsx # Google Sheet template
│   ├── ONE-TIME-SETUP-AUTO-SYNC.md    # GitHub Actions setup guide
│   ├── UPDATE-WORKFLOW-24H.md         # Workflow update guide (15min → 24h)
│   ├── KV-R2-SETUP-GUIDE.md           # KV + R2 setup guide
│   ├── CODE-AUDIT-REPORT.md           # Full code audit (40 issues)
│   ├── PRE-HANDOVER-SCAN.md           # Pre-client scan (78 issues)
│   ├── STUCK-LOADING-ANALYSIS.md     # 60 scenarios analyzed
│   └── AI-EXECUTION-PROMPT.md         # THIS FILE
├── package.json                 # Dependencies + scripts
├── next.config.ts               # Next.js config (ignoreBuildErrors, images)
├── tsconfig.json                # TypeScript config
├── tailwind.config.ts           # Tailwind config
├── postcss.config.mjs           # PostCSS config
├── wrangler.toml                # Cloudflare config (KV namespace ID)
├── .npmrc                       # npm config (legacy-peer-deps)
├── .nvmrc                       # Node version (22)
├── .gitignore                   # Git ignore rules
└── components.json              # shadcn/ui config
```

---

## DEPLOYMENT STEPS (FOLLOW IN ORDER)

### STEP 1: Prerequisites

Before starting, you need:
1. A **Google account** (for Google Sheets + Apps Script)
2. A **GitHub account** (for code hosting)
3. A **Cloudflare account** (for hosting — free)
4. A **Cloudinary account** (for image uploads — free, no credit card needed)

### STEP 2: Create the Google Sheet

1. Go to [sheets.new](https://sheets.new) — create a new Google Sheet
2. Name it "Soum Deco Sheet"
3. Open the template file `download/Soum-Deco-Sheet-Template.xlsx` (or build it manually)
4. Create 4 tabs (sheets):
   - **Products** (17 columns): id, name, description, category, price, image, images, featured, isSpecialOffer, variations, variants, stock, highlights, sortOrder, badge, oldPrice, quantityTiers
   - **Orders** (14 columns): Date, Status, Product, Qty, Unit Price, Shipping, Total, Customer, Phone, Wilaya, Commune, Delivery, Company, Notes
   - **Stock** (2 columns): Product Name, Stock Count
   - **Statistics** (formulas)
5. Add a guidance row (row 2) with Arabic hints for the admin
6. Add sample products (or import from the template)

### STEP 3: Deploy the Apps Script

1. In the Google Sheet, go to **Extensions → Apps Script**
2. Open `download/apps-script.gs` from the zip
3. **Select all** (Ctrl+A) → **Copy** the entire contents
4. Paste it into the Apps Script editor (replacing the existing code)
5. Click **Deploy → New deployment**
6. Choose type: **Web app**
7. Set:
   - Description: `SoumDeco v2 - with dedupe + cleanup`
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone** (required for the website to fetch products)
8. Click **Deploy**
9. Authorize the permissions when prompted
10. **Copy the Web app URL** (looks like `https://script.google.com/macros/s/AKfycbx.../exec`)

### STEP 4: Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com) → sign up (free)
2. Note your **Cloud Name** (e.g., `anhvhy4j`)
3. Go to **Settings → Upload**
4. Under **Upload presets**, create a new unsigned preset:
   - Name: `soumdeco`
   - Signing mode: **Unsigned**
   - Folder: (leave empty)
5. Save

### STEP 5: Update the Code with Your Values

Open `src/lib/sheet.ts` and update the `SHEET_BASE_URL` with your Apps Script URL from Step 3:

```typescript
export const SHEET_BASE_URL =
  "https://script.google.com/macros/s/YOUR_APPS_SCRIPT_URL/exec";
```

Open `src/lib/brand-config.ts` and update:
- `adminPassword` (change from the default)
- `contact` info (Instagram, Facebook, phone, email)

### STEP 6: Push Code to GitHub

1. Create a new GitHub repository (private or public)
2. Extract the zip contents into the repo
3. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit: SOUM DECO website"
   git push origin main
   ```

### STEP 7: Deploy to Cloudflare Pages

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Click **Create a project** → **Connect to Git**
3. Select your GitHub repository
4. Set build configuration:
   - **Framework preset:** Next.js
   - **Build command:** `npx @cloudflare/next-on-pages@1`
   - **Build output directory:** `.vercel/output/static`
   - **Node version:** 22 (set in Environment variables)
5. Add Environment variables:
   - `NEXT_PUBLIC_SHEET_URL` = your Apps Script URL
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` = your Cloudinary cloud name
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` = `soumdeco`
6. Click **Save and Deploy**
7. Wait for the first build to complete (~2-3 minutes)

### STEP 8: Set Up KV Namespace (for caching)

1. In Cloudflare Dashboard, go to **Workers & Pages → KV**
2. Click **Create a namespace** → name it `CATALOG_KV`
3. Copy the namespace ID
4. Update `wrangler.toml` with the ID:
   ```toml
   [[kv_namespaces]]
   binding = "CATALOG_KV"
   id = "YOUR_NAMESPACE_ID_HERE"
   ```
5. Push to GitHub → Cloudflare auto-redeploys

### STEP 9: Set Up GitHub Actions (Auto-Sync)

This is the ONE-TIME manual step (GitHub requires manual workflow file creation):

1. Go to your GitHub repository
2. Click **Add file → Create new file**
3. Name it: `.github/workflows/auto-sync-images.yml`
4. Copy the content from `.github/workflows/auto-sync-images.yml` in the zip
5. Commit the file
6. Go to **Actions tab** → "Auto-Sync Product Images" → **Run workflow** to test

This runs daily at 2 AM UTC to:
- Download new product images from Cloudinary to the repo
- Delete orphaned images (when products are deleted)
- Update the stock seed file
- Keep everything in sync automatically

### STEP 10: Verify Everything Works

1. Visit your Cloudflare Pages URL (e.g., `https://soumdeco.pages.dev`)
2. Check:
   - Home page loads with products
   - Product cards show images
   - Cart works (add items, checkout)
   - Admin panel works (go to `/#admin`, enter password)
3. Test admin operations:
   - Add a product (upload images)
   - Edit a product
   - Delete a product
4. Check the Google Sheet — new products should appear there

---

## ARCHITECTURE (HOW IT WORKS)

### Image Loading Strategy (bulletproof)

```
Admin uploads image
    ↓
Image goes to Cloudinary (instant, free 25GB bandwidth/month)
    ↓
Daily GitHub Action (2 AM UTC) downloads image to /public/images/products/
    ↓
Cloudflare rebuilds (2-3 min) → image now on Pages
    ↓
Visitors see image from Pages (unlimited bandwidth, no throttling)
```

**Fallback chain:** If a local image 404s, `ProductImage` falls back to Cloudinary automatically.

### Data Loading Strategy (instant)

```
Visitor opens site
    ↓
Show cached products from localStorage (0ms — instant)
    ↓
Fetch fresh products from Google Apps Script (background, non-blocking)
    ↓
Update display when fetch completes
```

**Fallback chain:** Sheet → localStorage → IndexedDB → SEED_PRODUCTS (29 hardcoded products)

### Self-Healing Mechanisms (9 layers)

1. **ErrorBoundary** — catches render errors, shows friendly UI
2. **Failed orders retry queue** — orders saved to localStorage, retried on next visit
3. **Adaptive storage** — localStorage → IndexedDB fallback (handles 9,500 products)
4. **Image onError fallback** — local image 404 → Cloudinary URL
5. **Fetch retry + timeout** — 10s timeout, 2 retries, exponential backoff
6. **Catalog fallback chain** — sheet → cache → seed
7. **Health monitor** — background network checks every 5 min
8. **Cart corruption recovery** — validates + sanitizes cart on load
9. **Stock fetch self-healing** — keeps current data on fetch failure
10. **LoadingFallback** — detects stuck loading + blank screen, auto-refresh

### Performance Optimizations

- **Lazy loading** — only visible images load (70% bandwidth reduction)
- **Smart image sizes** — w_400 for cards (~10KB), w_800 for detail (~21KB)
- **Cloudinary optimization** — q_auto, f_auto (WebP/AVIF)
- **Cloudflare Pages** — unlimited bandwidth, global CDN
- **localStorage cache** — instant page loads for returning visitors
- **Stock seed** — bundled in repo, instant first visit
- **Staggered fetches** — catalog first, stock after 1s delay

---

## ADMIN PANEL GUIDE

### Accessing the Admin Panel
1. Go to `https://yoursite.com/#admin`
2. Enter the password (default: `dimou2411@dz` — change this in `brand-config.ts`)

### Adding a Product
1. Click **"إضافة منتج"** (Add Product)
2. Fill in:
   - **Name** (required)
   - **Description** (French/Arabic)
   - **Category** (or type a new one)
   - **Price** (in DA — Algerian Dinar)
   - **Images** (upload up to 5 — auto-resized to 850px WebP)
   - **Featured** (check to show in carousel)
   - **Special Offer** (check to show in special offers section)
   - **Badge** (e.g., "عرض خاص", "جديد")
   - **Quantity Tiers** (e.g., "buy 2+ = free shipping")
3. Click **Save** (image uploads to Cloudinary instantly, product saves to Sheet)

### Editing a Product
1. Click the **pencil icon** on any product
2. Make changes
3. Click **Save**

### Deleting a Product
1. Click the **trash icon** on any product
2. Confirm deletion
3. Product is removed from the Sheet instantly
4. Image files are removed from the repo within 24 hours (auto-sync)

### Reordering Products
1. Use the **up/down arrows** on each product
2. Products are sorted by `sortOrder` (lower = first)

### Quantity Tiers (Special Offers)
- **Mode "فقط" (exact):** triggers ONLY at exactly that quantity
- **Mode "+" (min):** triggers at that quantity OR MORE
- Example: "2+" with "both" free shipping = buy 2+ items → free shipping (both desk + home)

---

## TROUBLESHOOTING

### Site is slow / stuck at loading
1. Check if Google Apps Script is responding: visit your Apps Script URL in a browser
2. Check Cloudflare Pages status: [cloudflarestatus.com](https://cloudflarestatus.com)
3. Clear browser cache: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
4. Check browser console (F12) for errors

### Images not showing
1. Check if images exist in `/public/images/products/`
2. Check the image manifest: visit `https://yoursite.com/image-manifest.json`
3. Check if Cloudinary is working: visit one of the Cloudinary URLs directly
4. If using new uploads: wait 24h for auto-sync to move them to Pages

### Admin panel not working
1. Check the password in `src/lib/brand-config.ts`
2. Check browser console for errors
3. Make sure you're accessing `/#admin` (with the hash)

### Orders not reaching the Sheet
1. Check the Apps Script URL in `src/lib/sheet.ts`
2. Check the Apps Script deployment (must be "Anyone" access)
3. Check browser console for fetch errors
4. Failed orders are saved to localStorage (`soumdeco_failed_orders`) and retried on next visit

### Build fails on Cloudflare
1. Check the build log in Cloudflare dashboard
2. Common issues:
   - Missing environment variables (NEXT_PUBLIC_SHEET_URL, etc.)
   - Node version (must be 22)
   - `legacy-peer-deps` not set (check `.npmrc`)

---

## LIMITS (FREE TIER)

| Resource | Limit | Usage | Status |
|----------|-------|-------|--------|
| Cloudflare Pages bandwidth | Unlimited | ~225 GB/month (800K visits) | ✅ |
| Cloudflare Pages builds | 500/month | ~30/month (daily sync) | ✅ 6% |
| Cloudflare Pages files | 20,000 | 109 (current) → 19,000 max | ✅ |
| Cloudinary bandwidth | 25 GB/month | ~0 (images on Pages) | ✅ |
| Cloudinary storage | 25 GB | ~2 MB (current) | ✅ |
| Google Apps Script | 20K-30K exec/day | ~27K/day (800K visits) | ✅ |
| GitHub Actions | 2000 min/month | ~30 min/month | ✅ |
| KV reads | 100K/day | ~50K/day | ✅ |

**Capacity:** 3,800 products × 5 images = 19,000 files (95% of 20K limit). Free forever, no credit card.

---

## KEY FILES TO KNOW

| File | What it does |
|------|-------------|
| `src/lib/brand-config.ts` | Brand name, password, contact info, social links |
| `src/lib/sheet.ts` | Google Apps Script URL (hardcoded) |
| `src/lib/products.ts` | Product types, seed data, localStorage helpers |
| `src/lib/client-sheet.ts` | Apps Script fetcher (timeout + retry + dedup) |
| `src/hooks/use-catalog.ts` | Catalog state (fetch + cache + fallback) |
| `src/hooks/use-stock.ts` | Stock state (cache + seed + fallback) |
| `src/hooks/use-cart.ts` | Cart state (localStorage + validation) |
| `src/app/page.tsx` | Main page (home + product + admin views) |
| `src/components/site/admin-panel.tsx` | Admin panel (CRUD products) |
| `src/components/site/product-image.tsx` | Image rendering (lazy + fallback) |
| `public/_headers` | Cache-control headers |
| `public/image-manifest.json` | List of local images |
| `public/stock-seed.json` | Bundled stock data |
| `.github/workflows/auto-sync-images.yml` | Daily sync workflow |
| `scripts/auto-sync.py` | Sync script (downloads + cleans + builds manifest) |
| `wrangler.toml` | Cloudflare config (KV namespace) |

---

## SECURITY NOTES

- **Admin password** is in the client-side bundle (`brand-config.ts`). Anyone can read it from the JS source. This is acceptable for a small e-commerce site, but for larger sites, use server-side auth.
- **Cloudinary** unsigned uploads are public. Anyone can upload to your Cloudinary account if they know the preset name. This is fine for admin use but not for public uploads.
- **Google Apps Script** is public (Anyone access). Anyone can read your products + stock data. This is intentional (the website needs to fetch them). Orders are submitted via GET/POST — no authentication needed.

---

## SUPPORT

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Read `download/STUCK-LOADING-ANALYSIS.md` (60 scenarios analyzed)
3. Read `download/PRE-HANDOVER-SCAN.md` (78 issues found + fixed)
4. Check the browser console (F12) for errors
5. Check Cloudflare Pages build logs
6. Check Google Apps Script logs (in the Apps Script editor)

---

## FINAL CHECKLIST

Before going live:
- [ ] Google Sheet created with 4 tabs
- [ ] Apps Script deployed (URL copied)
- [ ] Apps Script URL updated in `src/lib/sheet.ts`
- [ ] Cloudinary account created (cloud name + preset noted)
- [ ] Cloudinary values added to Cloudflare env vars
- [ ] Code pushed to GitHub
- [ ] Cloudflare Pages project created + deployed
- [ ] KV namespace created + ID in `wrangler.toml`
- [ ] GitHub Actions workflow added (one-time manual step)
- [ ] Admin password changed from default
- [ ] Contact info updated in `brand-config.ts`
- [ ] Test: add a product via admin panel
- [ ] Test: place a test order
- [ ] Test: check order appears in Google Sheet

**Once all checkboxes are done, the site is live and bulletproof.** 🎉
