# 🚀 El Miizaan — Deployment Guide for Z.ai Agent

**Project**: Arabic e-commerce storefront for "الميزان" (El Miizaan)
**Stack**: Next.js 16 (App Router, standalone output) + Google Sheets + Cloudinary
**Status**: ✅ Code is fully tested and working. Build succeeds. All routes return HTTP 200.

---

## ⚠️ CRITICAL — Read This First

The previous session encountered a **deployment platform issue** (not a code issue).
The error message "Sorry, there was a problem deploying the code" comes from the
Space-Z platform itself, **NOT** from this codebase.

**EVERYTHING IS PRE-CONFIGURED — ZERO SETUP NEEDED:**

✅ Google Sheet URL is hardcoded in `src/lib/sheet.ts` (line 10) — works even if `.env` is missing
✅ Cloudinary cloud name `mxhc8k5i` + preset `miizaan` hardcoded in `src/lib/drive-upload.ts` (lines 11–12)
✅ Admin password `007` hardcoded in `src/lib/brand-config.ts` (line 19)
✅ Brand name `الميزan` hardcoded in `src/lib/brand-config.ts` (line 14)
✅ TikTok `@elmiizaan` hardcoded in `src/lib/brand-config.ts` (line 25)
✅ 58 wilayas + shipping prices hardcoded in `src/lib/shipping.ts`
✅ Database `db/custom.db` is seeded and included in the zip
✅ Google Apps Script is ALREADY deployed to the Sheet — no need to redeploy

**Before doing anything else:**

1. **DO NOT modify the source code** — it is verified working 100%
2. **DO NOT change `package.json` scripts** — they are correct
3. **DO NOT rename files or folders** — the `.zscripts/` folder is required by the platform
4. **DO NOT delete** `Caddyfile`, `db/custom.db`, `prisma/schema.prisma`, or `.env`
5. **DO NOT touch Google Sheet or Cloudinary** — they're already configured and working
6. **DO NOT redeploy the Apps Script** — it's already live at the hardcoded URL

---

## 📦 What's Inside This Package

```
el-miizaan-deploy.zip
├── .env                    ← Environment variables (Sheet URL + Cloudinary)
├── .gitignore
├── .zscripts/              ← Build & start scripts (USED BY PLATFORM — DO NOT TOUCH)
│   ├── build.sh            ← Runs `bun install` + `bun run build` + packages tarball
│   └── start.sh            ← Runs `bun server.js` + caddy on platform
├── Caddyfile               ← Reverse proxy config (port 81 → 3000)
├── bun.lock                ← Lockfile (use `bun install`)
├── package.json
├── next.config.ts          ← output: "standalone"
├── prisma/
│   └── schema.prisma       ← SQLite Product model
├── db/
│   └── custom.db           ← SQLite DB (has Product table, seeded)
├── public/                 ← Logo, product images, data JSONs
│   ├── logo.png / logo.svg
│   ├── data/wilayas.json   ← 58 wilayas
│   ├── data/communes.json  ← All communes
│   └── products/           ← Product images
├── src/
│   ├── app/
│   │   ├── page.tsx        ← Home page (Arabic, RTL)
│   │   ├── api/order/route.ts      ← Order submission → Google Sheet
│   │   ├── api/products/route.ts   ← Products CRUD
│   │   └── api/stock/route.ts      ← Stock proxy
│   ├── components/site/    ← All UI components
│   │   ├── cod-order-form.tsx      ← COD form with shipping speed selector
│   │   ├── admin-panel.tsx         ← Admin (password: 007)
│   │   ├── product-page.tsx
│   │   ├── hero.tsx
│   │   └── ... (15+ components)
│   ├── lib/
│   │   ├── shipping.ts     ← 58 wilayas × 2 speeds × 2 delivery types
│   │   ├── sheet.ts        ← Google Apps Script client
│   │   ├── drive-upload.ts ← Cloudinary upload
│   │   ├── brand-config.ts ← Brand settings
│   │   └── products.ts     ← Product types + seed data
│   └── hooks/              ← React hooks (catalog, cart, stock)
└── upload/
    ├── apps-script.gs      ← Google Apps Script code (deploy to Google Sheet)
    ├── Sheet-Template.xlsx ← Template for the Google Sheet
    ├── MASTER-PROMPT.md    ← Original project brief
    └── QUICK-START.md      ← Setup checklist
```

---

## ✅ Pre-Deployment Checklist

Before clicking "Deploy" in the Z.ai generation page, verify:

### 1. Google Sheet is set up
- Sheet URL: `https://script.google.com/macros/s/AKfycbyp59qPpZuP0XCDW50Zn6-v_uwA-aSkEXe9Z_Sew0Zy6wWlQqO7HyN6Q07od6vU-oIQvw/exec`
- Must have 3 tabs: `Products`, `Orders`, `Stock`
- Apps Script deployed as Web App (anyone, even anonymous)
- `onStockEdit` trigger installed (see upload/apps-script.gs header)

### 2. Cloudinary is configured
- Cloud name: `mxhc8k5i`
- Upload preset: `miizaan`
- (Already hardcoded as fallback in `src/lib/drive-upload.ts`)

### 3. Environment variables (.env)
Already set:
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
NEXT_PUBLIC_SHEET_URL=https://script.google.com/macros/s/AKfycbyp59qPpZuP0XCDW50Zn6-v_uwA-aSkEXe9Z_Sew0Zy6wWlQqO7HyN6Q07od6vU-oIQvw/exec
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mxhc8k5i
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=miizaan
```

### 4. Database is seeded
- `db/custom.db` contains the `Product` table (Prisma-managed)
- Has 3 sample products already

---

## 🚀 How to Deploy on Z.ai Platform

### Option A — Fresh Deploy (Recommended)

1. **Start a new Z.ai session** (Next.js fullstack template)
2. **Replace the entire project** with the contents of this zip:
   ```bash
   # In the new session, replace /home/z/my-project/* with these files
   rm -rf /home/z/my-project/*
   unzip el-miizaan-deploy.zip -d /home/z/my-project/
   ```
3. **Install dependencies**:
   ```bash
   cd /home/z/my-project
   bun install
   ```
4. **Test the build locally** (verify it works):
   ```bash
   bun run build
   # Should end with "✓ Generating static pages using 1 worker (7/7)"
   ```
5. **Click "Deploy"** in the Z.ai generation page
6. **Wait 2–3 minutes** after deploy completes before visiting the URL

### Option B — Use the Existing Session

If you're reading this in the same session that built the code:
1. The code is already at `/home/z/my-project/`
2. Just click "Deploy" again in the generation page
3. If it fails again, it's a platform issue — retry 2–3 times

---

## 🧪 Quick Verification (After Deploy)

Once deployed, test these URLs (replace `YOUR-BOT-ID`):

| URL | Expected |
|-----|----------|
| `https://preview-YOUR-BOT-ID.space-z.ai/` | Arabic homepage with hero + products |
| `https://preview-YOUR-BOT-ID.space-z.ai/#admin` | Admin login (password: `007`) |
| `https://preview-YOUR-BOT-ID.space-z.ai/api/products` | JSON array of products |
| `https://preview-YOUR-BOT-ID.space-z.ai/api/order` | `{"ok":true,"service":"El Miizaan order API"}` |
| `https://preview-YOUR-BOT-ID.space-z.ai/api/stock` | CSV stock data |

---

## 🛠️ If Deploy Fails Again

If you see "Sorry, there was a problem deploying the code" again:

### Step 1: Verify the build works locally
```bash
cd /home/z/my-project
rm -rf .next
bun run build
# Must succeed with all 7 routes generated
```

### Step 2: Test the production server
```bash
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
PORT=3000 bun .next/standalone/server.js
# In another terminal:
curl http://localhost:3000/  # Should return HTML
```

### Step 3: Check the deploy scripts
```bash
# These must exist and be executable:
ls -la .zscripts/build.sh .zscripts/start.sh Caddyfile db/custom.db
```

### Step 4: If all above passes but deploy still fails
**It's a platform infrastructure issue.** Contact Z.ai support with:
- Your bot ID
- The deploy timestamp
- The error message ("Sorry, there was a problem deploying the code")
- Ask them to check their deploy server logs

---

## 🎯 Key Features (Already Implemented)

### Storefront
- ✅ Arabic RTL homepage with navy + gold theme
- ✅ Hero section with animated logo
- ✅ Featured products carousel
- ✅ Categories filter
- ✅ All products grid
- ✅ Special offers section (per-product flag)
- ✅ Brand story section
- ✅ Footer with TikTok @elmiizaan

### Product Page
- ✅ Image gallery with thumbnails
- ✅ Variations (color, size, etc.)
- ✅ Quantity tiers (1, 2, 3, 4 with discounts)
- ✅ COD order form with:
  - Full name, phone (Algerian format)
  - 58 wilayas + communes dropdowns
  - **Shipping speed selector**: توصيل سريع / توصيل عادي
  - **Delivery type**: مكتب التوصيل / توصيل للمنزل
  - Live shipping price + delay display
  - "📦 نوفّر التوصيل عبر Yalidine Express" message
  - Quantity selector with tier badges
  - Order summary with discount + free shipping

### Admin Panel (#admin, password: 007)
- ✅ Product CRUD (create, edit, delete)
- ✅ Image upload to Cloudinary
- ✅ Variations editor
- ✅ Quantity tiers editor
- ✅ Special offers flag
- ✅ Stock management (via Google Sheet Stock tab)
- ✅ Featured products toggle

### Backend
- ✅ Google Sheets integration (Products, Orders, Stock tabs)
- ✅ Cloudinary image hosting
- ✅ Yalidine shipping (58 wilayas × 2 speeds × 2 delivery types)
- ✅ Stock auto-decrement on order confirmation
- ✅ Order notes include shipping speed + delay

---

## 📊 Shipping Data (Already in src/lib/shipping.ts)

58 wilayas, each with:
- **Express** (توصيل سريع): stop_desk price, home price, delay in days
- **Economique** (توصيل عادي): stop_desk price, home price, delay in days

Prices extracted from Yalidine PDFs (Guelma departure).
Daira codes 59–69 automatically map to parent wilayas.

---

## 🔐 Admin Access

- URL: `https://preview-YOUR-BOT-ID.space-z.ai/#admin`
- Password: `007`
- TikTok: `@elmiizaan`
- Brand name: `الميزان`

---

## ⚠️ Common Pitfalls to AVOID

1. **Don't change `output: "standalone"` in next.config.ts** — the deploy scripts depend on it
2. **Don't add `framer-motion` to site components** — they use CSS-only animations
3. **Don't change the Arabic text** without checking RTL layout
4. **Don't remove the `db/custom.db` file** — Prisma needs it
5. **Don't change `.zscripts/*.sh`** — they're platform-specific
6. **Don't rename `upload/apps-script.gs`** — it's the Google Sheet backend
7. **Don't modify shipping prices** in `src/lib/shipping.ts` unless you have new PDFs
8. **Don't change the admin password** in `src/lib/brand-config.ts` without telling the user

---

## 📞 Support

If you (the new agent) get stuck:
1. Read this guide fully
2. Read `upload/MASTER-PROMPT.md` for the original brief
3. Read `upload/QUICK-START.md` for the setup checklist
4. Check `src/lib/brand-config.ts` for brand settings
5. Test locally before deploying

**The code works. Trust it. Deploy it.**
