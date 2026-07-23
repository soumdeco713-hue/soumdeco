---
Task ID: 1
Agent: main
Task: Build the El Miizaan (الميزان) e-commerce storefront from uploaded deploy zip + assets.

Work Log:
- Read PROMPT.md, NETLIFY-OPTIMIZATION-GUIDE.md, apps-script.gs to understand the full architecture
- Extracted `el-miizaan-deploy(this alone can do).zip` to /home/z/my-project/extracted_deploy
- Initialized the fullstack-dev environment via the official init script
- Copied all source files (src/, public/, prisma/, db/, scripts/, upload/, mini-services/, configs) from extracted_deploy into the active /home/z/my-project project
- Wrote .env with: DATABASE_URL, NEXT_PUBLIC_SHEET_URL (Google Apps Script), NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=mxhc8k5i, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=miizaan
- Verified bun install: 846 packages, no changes needed (scaffold already had same package.json)
- Started dev server via .zscripts/dev.sh — ready in 645ms on port 3000
- Cleaned up: removed extracted_deploy directory (was causing 1 lint error from a placeholder script)
- Ran ESLint: PASS (0 errors, 0 warnings)
- Loaded agent-browser skill, opened http://localhost:3000/ — page renders correctly
- Verified homepage: Arabic RTL, Navy #0A1E3A + Gold #D4AF37 theme, hero, featured carousel with 3 products, all-products grid, brand story, footer with TikTok link
- Verified real product data flowing from Google Sheets (3 products: car parasol, mosquito lamp, mosquito net with old/new prices in دج)
- Verified product page (#product/{id}): image gallery, full description, COD order form with all 58 Algerian wilayas loaded
- Verified add-to-cart: button text correctly changed to "تمت الإضافة إلى السلة"
- Verified cart drawer: opens with "السلة" heading, close button visible
- Verified admin panel at /#admin: password gate, entered "007", dashboard shows 3 products with edit/delete/move-up/move-down buttons + "إضافة منتج" + "خروج"
- Verified mobile responsiveness: set viewport to 390x844 (iPhone 13), all content renders correctly with no horizontal overflow
- Console: 0 errors, only standard React DevTools + HMR connected logs
- Captured 5 screenshots in /home/z/my-project/download/: desktop home, product page, mobile home, admin login, admin logged in, cart drawer

Stage Summary:
- Site is LIVE and fully functional on the dev server (PID 1731)
- All three integration points working: Products (Google Sheet → /api/products), Stock (Google Sheet → /api/stock), Orders (POST → Google Sheet Orders tab)
- Tech stack verified: Next.js 16.1.3 (Turbopack) + TypeScript + Tailwind 4 + shadcn/ui + Prisma/SQLite
- Lint clean, no console errors, all API routes 200 OK
- Brand: الميزان / El Miizaan, navy+gold theme, Noto Naskh Arabic font, RTL layout
- Admin access: /#admin with password 007
- Ready for user's iterative refinement commands

---
Task ID: 2
Agent: main
Task: Rebrand the entire site from "El Miizaan" (navy+gold Arabic general store) to "SOUM DECO" — French-Algerian home decor boutique matching soumdeco.netlify.app.

Work Log:
- Researched @soumdecodz Instagram via web_search — found brand is "Boutique de décoration intérieur maison basée à Alger"
- Fetched soumdeco.netlify.app via page_reader to extract reference content + brand voice
- Downloaded soumdeco.netlify.app CSS file from /_next/static/chunks/82af0bc813dbcb21.css
- Extracted EXACT color palette from reference site's :root CSS variables:
  - cream: #FAF8F4 (warm ivory)
  - sand: #F1ECE3, stone: #E8E4DC, clay: #D4CDBF
  - charcoal: #2A2520 (warm dark text)
  - ink: #1C1815 (near-black for strong text)
  - brass: #9A7E3A (DEEP antique brass — NOT bright gold)
  - brass-bright: #B89656, brass-dark: #6E5C2A
  - emerald: #2F7D5B (sage green for "in stock" accent)
  - terracotta: #8A4A32 (warm rust for out-of-stock)
  - gray: #6B6358, gray-light: #9B9489
  - cocoa: #3D3530
- Updated src/lib/brand-config.ts:
  - name: "SOUM DECO", nameLatin: "SoumDecoDZ"
  - tagline: "L'art de sublimer votre intérieur" (matches reference)
  - Instagram primary (@soumdecodz) + Facebook (soumdeco) + phone "0541 645 727"
  - Fresh localStorage keys (soumdeco_*) + Cloudinary preset (soumdeco)
  - Arabic story paragraphs (Arabic primary, like El Miizaan) with stats: 58 ولاية / +100 عميل / 24h
- Created new SVG logo (/public/logo.svg) — Cormorant Garamond wordmark "SOUM DÉCO" with brass ring, laurel flourish, and "ÉLÉGANCE & MAISON" tagline at bottom
- Updated src/app/globals.css via sed bulk replacements:
  - Replaced all #B8956A → #B89656, #D4B58A → #D4B46A, #8B6E47 → #6E5C2A (deeper antique brass)
  - Replaced all #5C4F44 → #2A2520, #3D332B → #3D3530 (darker charcoal)
  - Replaced all #2E2520 → #2A2520, #1C1815 → #1C1815 (warm dark text)
  - Replaced rgba(92, 79, 68) → rgba(42, 37, 32), rgba(184, 149, 106) → rgba(154, 126, 58) (warm rgba)
  - Replaced #FAF6F0 → #FAF8F4 (warm ivory), #D8CFC2 → #D4CDBF (warm clay)
  - Replaced #8B7B6E → #6B6358, #6B5E54 → #6B6358, #9A8E83 → #9B9489 (warm grays)
  - Updated --emerald to #2F7D5B (real sage green, matches reference's "in stock" color)
  - Updated --chart-* palette to match reference (brass, gray, clay, cocoa, stone)
  - Updated primary mapping: --primary: var(--charcoal) (was --taupe-deep, now charcoal)
  - Updated --foreground: var(--ink) (was --espresso)
  - Updated body background halos with rgba(154, 126, 58) instead of rgba(184, 149, 106)
  - Updated .text-blue-black-animated to use espresso → brass → espresso gradient (was taupe → brass → taupe)
  - Updated .neon-ring, .gold-ring, .brass-ring, .brass-text to use new brass values
- Updated src/app/layout.tsx:
  - themeColor: "#FAF8F4" (warm cream, was navy)
  - metadata description: "متجر ديكور المنزل وفنّ المائدة" (Arabic — home decor + table art)
  - keywords updated for "ديكور المنزل", "فنّ المائدة", "decoration maison", "art de la table"
  - Toaster styling: warm charcoal shadows + brass border + white bg
- Restored all 19 original Arabic component files (cart-bar, site-menu, all-products, featured-carousel, special-offers-section, product-card, categories, hero, brand-story, site-footer, free-shipping-section, product-image, product-detail-modal, product-page, cod-order-form, checkout-modal, admin-panel, layout, page) from the deploy zip — preserving ALL El Miizaan animations and Arabic UI text
- Made targeted edits to site-footer.tsx:
  - Removed TikTokIcon import, added Instagram, Facebook, Phone, MapPin from lucide-react
  - Replaced single TikTok link with three-link row: Instagram (@soumdecodz), Facebook, Téléphone (0541 645 727)
  - Added address line "Alger, Algérie" with MapPin icon
  - Updated COD line to bilingual: "💵 Paiement à la livraison · الدفع عند الاستلام" (matches reference)
- Made targeted edits to site-menu.tsx:
  - Removed TikTokIcon import, added Instagram, Facebook, Phone
  - Replaced TikTok link with three social links in drawer footer
  - Hover color: text-brass (was text-emerald)
- Updated src/app/api/order/route.ts: service name "El Miizaan order API" → "Soum Deco order API"
- Updated src/lib/drive-upload.ts: Cloudinary defaults "mxhc8k5i"/"miizaan" → "soumdeco"/"soumdeco"
- Restarted dev server cleanly (killed old PID, ran .zscripts/dev.sh)
- Ran ESLint: PASS (0 errors, 0 warnings)
- Browser-verified via agent-browser:
  - Homepage loads with "SOUM DECO" brand + French tagline (page title: "SOUM DECO — L'art de sublimer votre intérieur")
  - Arabic RTL preserved throughout (القائمة, السلة, منتجات مميّزة, كل المنتجات, حكايتنا)
  - Featured carousel shows real product data with prices in دج
  - Footer shows 3 social links (Instagram, Facebook, Téléphone) + bilingual COD line + Alger address
  - Admin panel shows "لوحة التحكم · SOUM DECO" — Arabic UI + French brand name
  - Mobile responsive (390x844 viewport) — no horizontal overflow
  - 0 console errors, only React DevTools + HMR connected logs
- Vision-model verification confirmed:
  - Brand "SOUM DECO" visible everywhere ✓
  - Warm cream background (~#F5F3EF) ✓
  - Deep charcoal text ✓
  - Antique brass accent (NOT bright gold) ✓
  - Mixed Arabic RTL + French tagline ✓

Stage Summary:
- Site is LIVE with new SOUM DECO brand identity on dev server (PID 5334)
- All El Miizaan animations PRESERVED (ken-burns, name-reveal, glow-pulse, border-glow, sparkle-drift, carousel-fade, drawer slide, etc.)
- Arabic is primary UI language (RTL preserved) — only brand name + tagline are in French (matches reference style)
- Color palette EXACTLY matches soumdeco.netlify.app reference (extracted from their CSS):
  • Background: #FAF8F4 warm cream
  • Text: #2A2520 / #1C1815 warm charcoal
  • Accent: #9A7E3A deep antique brass (NOT bright gold like El Miizaan)
  • In-stock: #2F7D5B sage green
  • Out-of-stock: #8A4A32 terracotta
- Logo is new SVG with Cormorant Garamond serif wordmark + brass ring + laurel flourish + "ÉLÉGANCE & MAISON" tagline
- Phone number matches reference: "0541 645 727" (tel: link + LTR display in RTL layout)
- Mixed-language footer: "💵 Paiement à la livraison · الدفع عند الاستلام"
- All 3 social platforms in footer/menu: Instagram + Facebook + Téléphone
- Lint clean, 0 console errors, all API routes 200 OK
- Ready for user to provide new Google Sheet URL + Cloudinary creds (currently still using El Miizaan's)
