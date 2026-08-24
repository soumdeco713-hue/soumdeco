# SOUM DECO — EXHAUSTIVE 300+ POINT PRE-PRODUCTION AUDIT
# ============================================================
# This is the master audit checklist. Every file, every function, every
# code path must be verified. NO SKIPPING. NO ASSUMPTIONS.
#
# METHODOLOGY:
# 1. Read every source file end-to-end (NO skimming).
# 2. Cross-verify imports resolve, exports match, types align.
# 3. For each function: trace call paths forward + backward.
# 4. For each API route: test happy path + every error path.
# 5. For each React component: verify hydration, props, state, effects cleanup.
# 6. For each hook: verify mount, unmount, deps, race conditions.
# 7. For each lib module: verify pure functions, no side effects unless intended.
# 8. For each env var: verify it's actually used + has a fallback.
# 9. For each external integration: verify timeout, retry, fallback.
# 10. For each piece of state: verify persistence, hydration, corruption recovery.
#
# SEVERITY LEVELS:
# - P0 SHOWSTOPPER — blocks production, must fix immediately
# - P1 HIGH — causes wrong behavior, must fix before next deploy
# - P2 MEDIUM — causes degraded UX or future risk
# - P3 LOW — cosmetic, code smell, or potential future issue
# ============================================================

# ============================================================
# SECTION 1: NEXT.JS APP ROUTES (src/app/**)
# ============================================================
# 1.1 — src/app/layout.tsx
#   - [ ] html lang attribute matches primary language (Arabic = "ar")
#   - [ ] html dir attribute matches RTL requirement (Arabic = "rtl")
#   - [ ] metadata.title is correct brand name
#   - [ ] metadata.description is in user's language
#   - [ ] metadata.keywords includes all SEO keywords
#   - [ ] viewport metadata includes themeColor
#   - [ ] All client-side providers wrap children correctly
#   - [ ] Toaster component is rendered with correct position
#   - [ ] Fonts are loaded with correct weights + display swap
#   - [ ] No console.log statements in production code
#   - [ ] SSR/hydration: no window/document access at module level
#   - [ ] ErrorBoundary wraps children (or there's app/error.tsx)
#
# 1.2 — src/app/page.tsx
#   - [ ] All imported components exist + are correctly exported
#   - [ ] Component order matches visual hierarchy
#   - [ ] Each section has correct aria-label for accessibility
#   - [ ] Loading state is rendered while catalog loads
#   - [ ] useEffect deps are correct (no missing deps, no over-firing)
#   - [ ] Hash routing (#admin, #product/{id}) works correctly
#   - [ ] Scroll-to-top behavior on hash change
#   - [ ] Mobile-first responsive (test at 390x844 viewport)
#   - [ ] No horizontal overflow at any viewport width
#   - [ ] All buttons/links have hover/focus states
#
# 1.3 — src/app/error.tsx
#   - [ ] Renders a friendly fallback UI (not a stack trace)
#   - [ ] Has a "Reload page" button
#   - [ ] Resets application state on reload
#   - [ ] Logs error to console for debugging
#   - [ ] Does NOT throw during render itself
#
# 1.4 — src/app/not-found.tsx
#   - [ ] Renders a 404 page in user's language
#   - [ ] Has a link back to home
#   - [ ] Status code is 404
#
# 1.5 — src/app/api/route.ts
#   - [ ] Returns a valid health-check response
#   - [ ] Doesn't expose any secrets
#
# 1.6 — src/app/api/catalog/route.ts (NEW)
#   - [ ] runtime = "edge" (Cloudflare compatible)
#   - [ ] dynamic = "force-dynamic"
#   - [ ] revalidate = 0
#   - [ ] Fetches Worker ?action=catalog with timeout
#   - [ ] Returns Worker response verbatim on success
#   - [ ] Returns {products:"[]", stock:"", error:...} on failure (HTTP 200)
#   - [ ] Sets Cache-Control: no-store (prevent edge cache)
#   - [ ] Sets CDN-Cache-Control: no-store
#   - [ ] Sets Cloudflare-CDN-Cache-Control: no-store
#   - [ ] Never throws (try/catch around everything)
#
# 1.7 — src/app/api/version/route.ts (NEW)
#   - [ ] runtime = "edge"
#   - [ ] Fetches Worker ?action=version with 3s timeout
#   - [ ] Returns {v: <timestamp>} on success
#   - [ ] Returns {v: 0} on failure (signals client to fetch full catalog)
#   - [ ] Sets all no-store headers
#   - [ ] Never throws
#
# 1.8 — src/app/api/refresh/route.ts (NEW)
#   - [ ] runtime = "edge"
#   - [ ] Only POST method triggers refresh (GET returns help message)
#   - [ ] Reads WORKER_ADMIN_SECRET server-side (NEVER exposed to client)
#   - [ ] Returns friendly error if secret not configured
#   - [ ] POSTs to Worker /refresh with X-Admin-Secret header
#   - [ ] Surfaces actual Worker errors (unauthorized, rate_limited, etc.)
#   - [ ] Rate-limited is treated as success (KV was recently updated)
#   - [ ] Never throws
#
# 1.9 — src/app/api/order/route.ts
#   - [ ] runtime = "edge"
#   - [ ] Validates phone with regex
#   - [ ] Validates required fields (fullName, wilaya, delivery)
#   - [ ] Forwards to Google Apps Script
#   - [ ] Returns ok:true even on Apps Script failure (user-friendly)
#   - [ ] Catches all exceptions
#   - [ ] Does NOT log secrets or PII to console
#
# 1.10 — src/app/api/products/route.ts
#   - [ ] runtime = "edge"
#   - [ ] Tries sheet first, falls back to seed
#   - [ ] Returns {ok, products, seed} flag
#   - [ ] Never throws
#   - [ ] NOTE: This is dead code if client bypasses it (verify usage)
#
# 1.11 — src/app/api/stock/route.ts
#   - [ ] runtime = "edge"
#   - [ ] Returns stock CSV
#   - [ ] Falls back gracefully
#   - [ ] NOTE: This is dead code if client bypasses it (verify usage)
#
# 1.12 — src/app/api/r2-upload/route.ts
#   - [ ] runtime = "edge"
#   - [ ] Validates auth (if needed)
#   - [ ] Handles multipart upload correctly
#   - [ ] Falls back gracefully if R2 not configured
#
# 1.13 — src/app/api/r2-image/[key]/route.ts
#   - [ ] runtime = "edge"
#   - [ ] Returns image from R2 with correct Content-Type
#   - [ ] Falls back to placeholder if not found
#   - [ ] Handles missing bucket gracefully

# ============================================================
# SECTION 2: HOOKS (src/hooks/**)
# ============================================================
# 2.1 — src/hooks/use-catalog.ts (CRITICAL)
#   - [ ] POLL_MS = 300_000 (5 min visible) — not 2 hours
#   - [ ] HIDDEN_POLL_MS = 1_800_000 (30 min hidden)
#   - [ ] Initial state: products=[], hydrated=false, loading=true
#   - [ ] Hydration-safe: useState matches on server + client
#   - [ ] useEffect for productsRef sync (latest products for callbacks)
#   - [ ] lastVersionRef tracks Worker version (smart polling)
#   - [ ] ADMIN_OP_TS_KEY persisted to localStorage
#   - [ ] lastAdminOpTsRef restored from localStorage on mount
#   - [ ] updateLastAdminOpTs persists to localStorage
#   - [ ] triggerWorkerRefresh is silent on failure (cron will sync)
#   - [ ] refresh() skips if URL hash = #admin (admin mode protection)
#   - [ ] refresh() skips if within 10-min admin grace period
#   - [ ] refresh() instantly shows cached data (instantCached)
#   - [ ] Smart polling: checks version before fetching full catalog
#   - [ ] If version=0, falls through to full fetch (Worker blocked)
#   - [ ] If version matches lastVersionRef, skips full fetch
#   - [ ] upsertProduct calls reverseOptimizeUrl BEFORE saving
#   - [ ] moveProduct calls reverseOptimizeUrl BEFORE saving
#   - [ ] deleteProduct removes from state + persists
#   - [ ] resetProducts wipes state + persists
#   - [ ] addBlankProduct generates unique ID (generateId)
#   - [ ] All setState calls are safe (no race conditions)
#   - [ ] useEffect cleanup: clearInterval on unmount
#   - [ ] Polling stops when tab hidden (visibilitychange)
#   - [ ] Polling resumes when tab visible again
#   - [ ] No memory leaks (intervals cleared, listeners removed)
#   - [ ] No setState after unmount (React 18 silently ignores but still bad)
#
# 2.2 — src/hooks/use-stock.ts
#   - [ ] Same polling strategy as use-catalog (5 min visible, 30 min hidden)
#   - [ ] Falls back to static CSV, then seed, then empty
#   - [ ] Parses CSV correctly (handles quoted fields, commas in names)
#   - [ ] Persists stock to localStorage
#   - [ ] Hydrates from localStorage on mount
#   - [ ] All fetches have timeouts
#   - [ ] Never throws
#
# 2.3 — src/hooks/use-cart.ts
#   - [ ] Cart persists to localStorage (key matches brand-config)
#   - [ ] addToCart reads + writes localStorage with try/catch
#   - [ ] JSON.parse on localStorage has try/catch (corrupted cart)
#   - [ ] updateQuantity handles multiple variants (variantKey)
#   - [ ] removeItem handles multiple variants (variantKey)
#   - [ ] clearCart wipes state + localStorage
#   - [ ] Cart count is reactive (updates when cart changes)
#   - [ ] Cart total is computed correctly (sum of price * qty)
#   - [ ] Hydration-safe (no SSR/localStorage mismatch)
#   - [ ] No setState after unmount
#
# 2.4 — src/hooks/use-toast.ts
#   - [ ] Toast queue is managed correctly (FIFO)
#   - [ ] Toasts auto-dismiss after timeout
#   - [ ] Toast can be dismissed manually
#   - [ ] Multiple toasts don't overlap visually
#   - [ ] No memory leak (interval cleared)
#
# 2.5 — src/hooks/use-mobile.ts
#   - [ ] media query listener set up correctly
#   - [ ] Listener removed on unmount
#   - [ ] Returns boolean (true = mobile)
#   - [ ] Hydration-safe (defaults to false on server)
#
# 2.6 — src/hooks/use-algeria-data.ts
#   - [ ] Fetches wilayas.json + communes.json
#   - [ ] Persists to localStorage (don't refetch every mount)
#   - [ ] Falls back to bundled data if fetch fails
#   - [ ] No duplicate fetches (deduplication)
#   - [ ] Hydration-safe
#
# 2.7 — src/hooks/use-free-shipping.ts
#   - [ ] Calculates free shipping threshold correctly
#   - [ ] Updates when cart changes
#   - [ ] Returns remaining amount + percentage

# ============================================================
# SECTION 3: LIB MODULES (src/lib/**)
# ============================================================
# 3.1 — src/lib/sheet.ts (CRITICAL — Sheet integration)
#   - [ ] SHEET_BASE_URL is hardcoded live URL (bulletproof fallback)
#   - [ ] getSheetBaseUrl() priority: env > env > hardcoded
#   - [ ] getClientSheetBaseUrl() is browser-safe (try/catch around process.env)
#   - [ ] sheetListProducts: GET ?action=products, returns SheetProduct[]
#   - [ ] sheetListProducts: never throws (try/catch returns [])
#   - [ ] sheetUpsertProduct: POST ?action=product_create
#   - [ ] sheetUpsertProduct: uses text/plain content-type (Apps Script quirk)
#   - [ ] sheetDeleteProduct: GET ?action=product_delete&id=...
#   - [ ] sheetResetProducts: GET ?action=product_reset
#   - [ ] sheetSubmitOrder: GET with URL params (NOT POST — verify with Apps Script)
#   - [ ] sheetSubmitOrder: truncates long fields (URL length safety)
#   - [ ] sheetSubmitOrder: handles redirect (Google returns 302 → 200)
#   - [ ] normalizeSheetProduct: handles null/undefined/""/object for all fields
#   - [ ] normalizeSheetProduct: featured/isSpecialOffer accept bool/1/"1"/"true"
#   - [ ] normalizeSheetProduct: stock/price parse correctly
#   - [ ] normalizeSheetProduct: sortOrder defaults to 999
#
# 3.2 — src/lib/client-sheet.ts (CRITICAL — Client-side sheet ops)
#   - [ ] clientListProducts uses fetchProducts() from worker-client
#   - [ ] clientUpsertProduct calls sheetUpsertProduct + persists to localStorage
#   - [ ] clientUpsertProduct calls reverseOptimizeUrl BEFORE saving
#   - [ ] clientUpsertProduct calls triggerWorkerRefresh AFTER saving
#   - [ ] clientDeleteProduct calls sheetDeleteProduct + removes from localStorage
#   - [ ] clientDeleteProduct calls triggerWorkerRefresh AFTER deleting
#   - [ ] clientUploadImages: handles multipart upload to Cloudinary
#   - [ ] clientUploadImages: handles 400 retry correctly (NO comma operator)
#   - [ ] clientUploadImages: AbortController is properly cleared
#   - [ ] clientUploadImages: setTimeout handle is properly cleared
#   - [ ] clientUploadImages: returns array of URLs on success
#   - [ ] clientUploadImages: throws on total failure (caller catches)
#
# 3.3 — src/lib/worker-client.ts (CRITICAL — Frontend Worker calls)
#   - [ ] WORKER_URL read from process.env.NEXT_PUBLIC_WORKER_URL
#   - [ ] WORKER_ADMIN_SECRET read from process.env.NEXT_PUBLIC_WORKER_ADMIN_SECRET
#   - [ ] getWorkerUrl() trims trailing slash
#   - [ ] fetchWithTimeout: AbortController, timeout, clear on success
#   - [ ] fetchWithTimeout: never throws (returns null on failure)
#   - [ ] fetchCatalog: catalogCache with 30s TTL (prevents duplicate fetches)
#   - [ ] fetchCatalog: cache cleared on failure (next call retries)
#   - [ ] fetchCatalog: tries /api/catalog (same domain, NOT Worker URL)
#   - [ ] fetchCatalog: URL is /api/catalog?_t=... (NOT &_t=)
#   - [ ] fetchCatalog: falls back to /data/products.json + /data/stock.csv
#   - [ ] fetchCatalog: normalizes products via normalizeSheetProduct
#   - [ ] fetchWorkerVersion: URL is /api/version?_t=... (NOT &_t=)
#   - [ ] fetchWorkerVersion: returns 0 on failure (signals full fetch)
#   - [ ] triggerWorkerRefresh: POSTs to /api/refresh (same domain)
#   - [ ] triggerWorkerRefresh: never throws
#   - [ ] triggerWorkerRefresh: returns {ok, message, synced?}
#   - [ ] triggerWorkerRefresh: handles rate_limited as success
#   - [ ] fetchWorkerHealth: uses Worker URL directly (NOT /api/health)
#   - [ ] fetchWorkerHealth: NOTE this is BLOCKED on Algerian WiFi (verify)
#   - [ ] isWorkerConfigured: returns boolean
#   - [ ] normalizeSheetProduct: matches lib/sheet.ts normalizeSheetProduct
#
# 3.4 — src/lib/worker-server.ts (NEW — Server-side Worker config)
#   - [ ] FALLBACK_WORKER_URL is hardcoded (bulletproof)
#   - [ ] getServerWorkerUrl: env priority > fallback
#   - [ ] getServerWorkerUrl: trims trailing slash
#   - [ ] getServerAdminSecret: env priority > "" (empty)
#   - [ ] fetchWithTimeout: AbortController, timeout, clear on success + failure
#   - [ ] noStoreHeaders: returns all 5 anti-cache headers
#
# 3.5 — src/lib/products.ts (CRITICAL — Product normalization)
#   - [ ] CATALOG_STORAGE_KEY matches brand-config
#   - [ ] saveCatalog + saveCatalogAsync: persist to localStorage + IndexedDB
#   - [ ] loadCatalog + loadCatalogAsync: read from localStorage, fall back to IndexedDB
#   - [ ] generateId: returns unique ID (UUID or timestamp-based)
#   - [ ] parseVariations: handles empty/null/malformed
#   - [ ] parseHighlights: handles empty/null/malformed
#   - [ ] normalizeTiers: handles empty/null/malformed
#   - [ ] normalizeVariants: handles empty/null/malformed
#   - [ ] SEED_PRODUCTS: array of Product objects (fallback)
#   - [ ] SEED_PRODUCTS: at least 1 product (never empty)
#   - [ ] normalizeProduct (if exists): handles {fr,ar} object keys
#   - [ ] optimizeCloudinaryUrls: rewrites Cloudinary → /images/products/
#   - [ ] optimizeCloudinaryUrls: idempotent (doesn't double-rewrite)
#   - [ ] joinImageStrings, joinVariations, joinVariants, joinHighlights: encode correctly
#   - [ ] All pure functions have no side effects
#
# 3.6 — src/lib/image-manifest.ts
#   - [ ] getLocalPathSync: returns local path if image in manifest, else original
#   - [ ] loadImageManifest: fetches /image-manifest.json with timeout
#   - [ ] loadImageManifest: never throws (try/catch)
#   - [ ] loadImageManifest: caches result (don't refetch)
#   - [ ] Manifest is correctly typed
#
# 3.7 — src/lib/adaptive-storage.ts
#   - [ ] Uses IndexedDB when available (better than localStorage for large data)
#   - [ ] Falls back to localStorage when IndexedDB unavailable
#   - [ ] Handles onversionchange (deletes old DB)
#   - [ ] Handles blocked upgrade (browser tab has old version open)
#   - [ ] Never throws (try/catch everywhere)
#
# 3.8 — src/lib/health-monitor.ts
#   - [ ] checkWorkerHealth: 3s timeout, silent failure
#   - [ ] All event listeners removed in stopHealthMonitor
#   - [ ] visibilitychange listener cleaned up
#   - [ ] online/offline listeners cleaned up
#   - [ ] Interval cleared on stop
#   - [ ] No memory leaks
#
# 3.9 — src/lib/failed-orders.ts
#   - [ ] Queues failed orders in localStorage
#   - [ ] Retries with sanitized phone (NOT raw)
#   - [ ] Limited queue size (don't grow forever)
#   - [ ] Triggers retry on next mount
#   - [ ] Never throws
#
# 3.10 — src/lib/telegram-notify.ts
#   - [ ] Sends message to Telegram bot API
#   - [ ] 10s timeout
#   - [ ] Non-blocking (caller doesn't wait)
#   - [ ] Silent on failure (never crashes order flow)
#   - [ ] Optional (env vars not set = no-op)
#
# 3.11 — src/lib/drive-upload.ts
#   - [ ] Cloudinary cloud name + preset from env
#   - [ ] Falls back to hardcoded defaults
#   - [ ] Handles 400 errors (invalid preset)
#   - [ ] Returns URL on success
#
# 3.12 — src/lib/r2-upload.ts
#   - [ ] Handles missing R2 bucket gracefully
#   - [ ] Returns URL on success
#   - [ ] Never throws
#
# 3.13 — src/lib/brand-config.ts
#   - [ ] name, nameLatin, tagline in correct language
#   - [ ] Instagram, Facebook, phone, email all set
#   - [ ] logoPath points to existing file in /public
#   - [ ] CATALOG_STORAGE_KEY uses brand prefix (no collision)
#   - [ ] ADMIN_PASSWORD NOT in client bundle (verify build output)
#   - [ ] Cloudinary defaults set
#
# 3.14 — src/lib/shipping.ts
#   - [ ] Wilaya → stop desk price mapping
#   - [ ] Wilaya → home delivery price mapping
#   - [ ] Free shipping threshold logic
#   - [ ] All 58 wilayas covered
#
# 3.15 — src/lib/db.ts
#   - [ ] Prisma client singleton (no multiple instances in dev)
#   - [ ] Connection error handling
#
# 3.16 — src/lib/category-anim.ts
#   - [ ] Animation timing constants
#   - [ ] No side effects
#
# 3.17 — src/lib/utils.ts
#   - [ ] cn() helper for classnames
#   - [ ] Other helpers are pure
#
# 3.18 — src/lib/seed-products.ts
#   - [ ] At least 1 product
#   - [ ] All products have valid id, name, image
#   - [ ] Images are Cloudinary URLs (NOT local paths)

# ============================================================
# SECTION 4: COMPONENTS (src/components/**)
# ============================================================
# 4.1 — src/components/site/hero.tsx
#   - [ ] Renders logo image (not SVG if brand uses JPG)
#   - [ ] Tagline animation is RTL-friendly
#   - [ ] No layout shift on initial render
#   - [ ] Mobile responsive
#
# 4.2 — src/components/site/categories.tsx
#   - [ ] Reads categories from products (no hardcoding)
#   - [ ] Scrolls horizontally on mobile
#   - [ ] RTL arrows work correctly (left/right semantics reversed)
#   - [ ] Click scrolls to category section
#
# 4.3 — src/components/site/featured-carousel.tsx
#   - [ ] Auto-advances (with pause on hover)
#   - [ ] Manual prev/next buttons work
#   - [ ] Touch swipe on mobile
#   - [ ] Effect doesn't over-fire on index change
#   - [ ] Stops auto-advance when tab hidden
#
# 4.4 — src/components/site/all-products.tsx
#   - [ ] Filters by category
#   - [ ] Sorts by sortOrder (lower = first)
#   - [ ] Grid is responsive (1 col mobile, 2-3 col tablet, 3-4 col desktop)
#   - [ ] Empty state when no products match filter
#   - [ ] Loading skeleton while products load
#
# 4.5 — src/components/site/product-card.tsx
#   - [ ] Image lazy-loaded
#   - [ ] Image fallback on error
#   - [ ] Price formatted correctly (currency, RTL)
#   - [ ] Old price strikethrough
#   - [ ] Badge rendering (top-right corner)
#   - [ ] Out-of-stock overlay
#   - [ ] Click opens product page/modal
#   - [ ] Hover effect (subtle elevation)
#
# 4.6 — src/components/site/product-image.tsx
#   - [ ] Cloudinary URL → local path optimization
#   - [ ] Fallback on 404 (local)
#   - [ ] Fallback on 404 (Cloudinary)
#   - [ ] Loading placeholder
#   - [ ] No layout shift (aspect ratio container)
#
# 4.7 — src/components/site/product-page.tsx
#   - [ ] Reads product ID from hash (#product/{id})
#   - [ ] Finds product in catalog
#   - [ ] Image gallery with thumbnails
#   - [ ] Description renders with line breaks
#   - [ ] COD order form with 58 wilayas
#   - [ ] Communes dropdown updates based on wilaya
#   - [ ] handleAdd passes variantKey to onAddToCart
#   - [ ] variantSummary declared before use (no TDZ)
#   - [ ] Active tier benefit text rendered correctly
#
# 4.8 — src/components/site/cod-order-form.tsx
#   - [ ] Validates all required fields
#   - [ ] Phone regex matches Algerian format (0[567]XXXXXXXX)
#   - [ ] Submit disables button while pending
#   - [ ] Shows success message
#   - [ ] Shows error message
#   - [ ] Sanitized items filter does NOT always return [] (CRITICAL FIX)
#   - [ ] OrderItem type includes productId field (or filter doesn't need it)
#   - [ ] Failed order queue: stores SANITIZED phone (not raw)
#   - [ ] Catch block queues failed order on exception
#   - [ ] Triggers Telegram notification on success
#
# 4.9 — src/components/site/checkout-modal.tsx
#   - [ ] Passes quantityTiers to CodOrderForm
#   - [ ] Modal closes on ESC
#   - [ ] Modal closes on backdrop click
#   - [ ] Body scroll locked when modal open
#   - [ ] Focus trapped inside modal
#
# 4.10 — src/components/site/cart-bar.tsx
#   - [ ] Shows cart count badge
#   - [ ] Opens cart drawer on click
#   - [ ] Hidden when cart empty
#   - [ ] onUpdateQuantity passes variantKey (not just productId)
#   - [ ] onRemove passes variantKey
#
# 4.11 — src/components/site/site-menu.tsx
#   - [ ] Opens drawer with menu items
#   - [ ] Social links render correctly
#   - [ ] Email link (mailto:)
#   - [ ] Phone link (tel:)
#   - [ ] RTL drawer slides from right
#
# 4.12 — src/components/site/site-footer.tsx
#   - [ ] Instagram, Facebook, Email, Phone links
#   - [ ] Address line
#   - [ ] COD bilingual notice
#   - [ ] Copyright year is dynamic (new Date().getFullYear())
#
# 4.13 — src/components/site/admin-panel.tsx
#   - [ ] Password gate (hashed, not plaintext in client)
#   - [ ] Form inputs have unique id + name + autoComplete="off"
#   - [ ] Labels have htmlFor matching input id
#   - [ ] Save calls reverseOptimizeUrl BEFORE persisting
#   - [ ] Save calls triggerWorkerRefresh AFTER persisting
#   - [ ] Delete confirms with user
#   - [ ] Reset confirms with user (destructive!)
#   - [ ] Move up/down works (calls moveProduct)
#   - [ ] DataSyncBadge is non-clickable (informational only)
#   - [ ] Image upload handles multi-file
#   - [ ] Image upload shows progress
#   - [ ] Image upload handles failure (per-file)
#   - [ ] No <div> inside <ul> (invalid HTML)
#   - [ ] No dead variables (globalIdx etc.)
#   - [ ] Form values reset to product values on cancel
#
# 4.14 — src/components/ui/* (shadcn/ui components)
#   - [ ] All components are present (button, input, dialog, etc.)
#   - [ ] Theme matches brand (CSS variables)
#   - [ ] No conflicts with custom CSS
#
# 4.15 — src/components/site/loading-fallback.tsx
#   - [ ] Detects .animate-pulse and .shimmer-line (skeletons)
#   - [ ] Detects BLANK screen (no skeletons, no products)
#   - [ ] Shows refresh button after 15s (NOT 30s)
#   - [ ] Refresh button reloads page
#   - [ ] No 30s cutoff (would leave users stuck forever)
#
# 4.16 — src/components/site/manifest-preloader.tsx
#   - [ ] Preloads image manifest on mount
#   - [ ] No visible UI (returns null)
#   - [ ] Silent failure
#
# 4.17 — src/components/site/health-monitor-starter.tsx
#   - [ ] Starts health monitor on mount
#   - [ ] Stops on unmount
#   - [ ] No visible UI

# ============================================================
# SECTION 5: WORKER (worker/**)
# ============================================================
# 5.1 — worker/data-sync.js
#   - [ ] CORS locked to soumdeco.pages.dev + localhost (no wildcards)
#   - [ ] KV_TTL_SECONDS = 3600 (1 hour, survives 12 missed crons)
#   - [ ] scheduled() wraps syncData() in try/catch (never throws)
#   - [ ] syncData: 3 retries with exponential backoff
#   - [ ] syncData: distinguishes 4xx (no retry) from 5xx (retry)
#   - [ ] syncData: hash-skip (only writes if data changed)
#   - [ ] syncData: productsMissing check (re-write if KV expired)
#   - [ ] syncData: needsTtlRefresh after 30 min
#   - [ ] syncData: ALWAYS writes __meta (tiny, needed for health)
#   - [ ] syncData: never throws (try/catch wraps everything)
#   - [ ] updateMetaOnFailure: tracks consecutiveFailures
#   - [ ] fetchFromAppsScript: 10s timeout per attempt
#   - [ ] catalog endpoint: reads from KV, falls back to syncData
#   - [ ] catalog endpoint: returns empty on total failure (HTTP 200)
#   - [ ] version endpoint: returns lastChange timestamp
#   - [ ] health endpoint: returns lastSync, lastSyncAttempt, productCount
#   - [ ] refresh endpoint: validates X-Admin-Secret header
#   - [ ] refresh endpoint: rate-limited (3s cooldown)
#   - [ ] refresh endpoint: rate_limited returns HTTP 200 (treated as success)
#   - [ ] All paths return JSON (never HTML error page)
#   - [ ] All paths set Cache-Control: no-store
#   - [ ] bumpHitCounter: SAMPLING (1-in-50, prevents quota exhaustion)
#   - [ ] No console.log in production (use console.error for errors only)
#
# 5.2 — worker/wrangler.toml
#   - [ ] name = "soumdeco-data-sync"
#   - [ ] main = "data-sync.js"
#   - [ ] compatibility_date = "2024-09-01"
#   - [ ] KV namespace binding = "CATALOG_KV"
#   - [ ] KV id matches production namespace
#   - [ ] cron = "*/5 * * * *" (every 5 min)
#   - [ ] No secrets in this file (use wrangler secret put)
#
# 5.3 — worker/package.json
#   - [ ] Has wrangler as dev dependency
#   - [ ] Has deploy script
#
# 5.4 — worker/README.md
#   - [ ] Deployment instructions accurate
#   - [ ] Environment variables documented

# ============================================================
# SECTION 6: CONFIGURATION
# ============================================================
# 6.1 — next.config.ts
#   - [ ] typescript.ignoreBuildErrors: should be FALSE (currently TRUE — bad)
#   - [ ] reactStrictMode: should be TRUE (currently FALSE)
#   - [ ] images.unoptimized = true (Cloudflare requirement)
#   - [ ] No 'output: standalone' (Cloudflare uses its own build)
#
# 6.2 — wrangler.toml (Pages)
#   - [ ] name = "soumdeco"
#   - [ ] compatibility_date = "2024-09-01"
#   - [ ] compatibility_flags = ["nodejs_compat"]
#   - [ ] pages_build_output_dir = ".vercel/output/static"
#   - [ ] KV namespace id matches production
#
# 6.3 — tsconfig.json
#   - [ ] paths configured correctly (@/* → src/*)
#   - [ ] strict mode enabled
#   - [ ] noUnusedLocals enabled (catches dead code)
#
# 6.4 — tailwind.config.ts
#   - [ ] content globs cover all source files
#   - [ ] theme extends with brand colors
#   - [ ] plugins include typography, forms, etc.
#
# 6.5 — postcss.config.mjs
#   - [ ] tailwindcss plugin
#   - [ ] autoprefixer plugin
#
# 6.6 — .env / .env.example / .env.production
#   - [ ] .env has all required vars
#   - [ ] .env.example documents all vars
#   - [ ] .env NOT committed (in .gitignore)
#   - [ ] .env.production has production values
#
# 6.7 — .gitignore
#   - [ ] .env ignored
#   - [ ] node_modules ignored
#   - [ ] .next ignored
#   - [ ] .vercel ignored
#   - [ ] .wrangler ignored
#
# 6.8 — .cloudflare/config.toml
#   - [ ] build command = "npx @cloudflare/next-on-pages"
#   - [ ] upload_format = "service-worker"
#   - [ ] All NEXT_PUBLIC_ env vars documented
#
# 6.9 — .github/workflows/auto-sync-images.yml
#   - [ ] Cron schedule (daily)
#   - [ ] Manual dispatch trigger
#   - [ ] Commits only if changes
#   - [ ] [skip ci] in commit message (prevents loop)

# ============================================================
# SECTION 7: SCRIPTS (scripts/**)
# ============================================================
# 7.1 — scripts/auto-sync.py
#   - [ ] Downloads new images from Cloudinary URLs in sheet
#   - [ ] Updates image-manifest.json
#   - [ ] Deletes orphaned local images
#   - [ ] Idempotent (safe to run multiple times)
#   - [ ] Error handling (doesn't crash on single image failure)
#
# 7.2 — scripts/build-image-manifest.py
#   - [ ] Uses SCRIPT_DIR/REPO_ROOT (NOT hardcoded paths)
#   - [ ] Fail-loud if manifest is empty
#   - [ ] Includes all images in public/images/products/
#
# 7.3 — scripts/build-sheet-template.py
#   - [ ] Generates xlsx with Products, Orders, Stock tabs
#   - [ ] All required columns present
#   - [ ] Conditional formatting for stock levels
#   - [ ] Frozen panes for headers
#
# 7.4 — scripts/verify-worker.sh
#   - [ ] 8 tests covering all Worker endpoints
#   - [ ] Exits non-zero on failure
#   - [ ] Clear output messages
#
# 7.5 — scripts/patch-worker.js
#   - [ ] Updates Worker code via wrangler
#   - [ ] Sets all required secrets
#   - [ ] Verifies deployment

# ============================================================
# SECTION 8: STATIC DATA (public/**)
# ============================================================
# 8.1 — public/data/products.json
#   - [ ] Valid JSON array
#   - [ ] All products have id, name, image
#   - [ ] Images are Cloudinary URLs (not local paths)
#   - [ ] At least 1 product (fallback)
#
# 8.2 — public/data/stock.csv
#   - [ ] Valid CSV
#   - [ ] Format: productName,stockCount
#   - [ ] Empty stockCount = unlimited
#
# 8.3 — public/data/wilayas.json
#   - [ ] All 58 Algerian wilayas
#   - [ ] Each wilaya has code + name (Arabic + French)
#   - [ ] Stop desk price
#   - [ ] Home delivery price
#
# 8.4 — public/data/communes.json
#   - [ ] Communes per wilaya
#   - [ ] At least major communes for each wilaya
#
# 8.5 — public/image-manifest.json
#   - [ ] Valid JSON object
#   - [ ] Keys are Cloudinary filenames
#   - [ ] Values are local paths
#   - [ ] Not empty
#
# 8.6 — public/images/products/
#   - [ ] All images referenced in manifest exist
#   - [ ] No orphaned images (in folder but not in manifest)
#   - [ ] Images optimized (not raw 5MB files)
#
# 8.7 — public/logo.jpg (or .svg)
#   - [ ] File exists
#   - [ ] Path matches brand-config.logoPath
#   - [ ] Reasonable file size (< 100KB)
#
# 8.8 — public/_headers (if exists)
#   - [ ] No conflicting Cache-Control rules
#   - [ ] CORS headers configured correctly
#   - [ ] Security headers (X-Frame-Options, etc.)
#
# 8.9 — public/_redirects (if exists)
#   - [ ] No conflicting redirect rules
#   - [ ] 404 fallback configured
#
# 8.10 — public/robots.txt (if exists)
#   - [ ] Allows or disallows correctly
#   - [ ] Sitemap reference

# ============================================================
# SECTION 9: TYPESCRIPT TYPES
# ============================================================
# 9.1 — All types in src/lib/sheet.ts (SheetProduct)
#   - [ ] All fields have correct types
#   - [ ] Optional fields marked with ?
#   - [ ] Number | null for nullable numbers
#
# 9.2 — All types in src/lib/products.ts (Product, Variation, ProductVariant)
#   - [ ] Product extends SheetProduct (or compatible)
#   - [ ] Variation type matches parseVariations output
#   - [ ] ProductVariant type matches normalizeVariants output
#
# 9.3 — All types in src/hooks/use-catalog.ts
#   - [ ] CatalogState type matches useState shape
#   - [ ] Return type matches what consumers expect
#
# 9.4 — All types in src/hooks/use-cart.ts
#   - [ ] CartItem type matches storage shape
#   - [ ] variantKey included (CRITICAL for multi-variant)
#
# 9.5 — All types in src/components/site/cod-order-form.tsx
#   - [ ] OrderItem type includes productId (CRITICAL FIX)
#   - [ ] OR filter doesn't require productId
#
# 9.6 — All types in src/lib/worker-client.ts
#   - [ ] CatalogResponse type matches Worker response
#   - [ ] WorkerHealth type matches Worker /health response

# ============================================================
# SECTION 10: SECURITY
# ============================================================
# 10.1 — Admin password
#   - [ ] NOT hardcoded in client bundle (verify in build output)
#   - [ ] Should be hashed server-side (long-term fix)
#
# 10.2 — Worker admin secret
#   - [ ] Set via wrangler secret put (NOT in wrangler.toml)
#   - [ ] Used server-side only (in /api/refresh route)
#   - [ ] NOT exposed to client bundle
#
# 10.3 — Cloudinary preset
#   - [ ] Unsigned preset (no API secret needed)
#   - [ ] Folder organized by brand
#
# 10.4 — Telegram bot token
#   - [ ] In NEXT_PUBLIC_ env (acceptable — bot can only send to chat ID)
#   - [ ] Chat ID locked to specific user
#
# 10.5 — CORS
#   - [ ] Worker CORS locked to soumdeco.pages.dev + localhost
#   - [ ] No wildcard origins
#   - [ ] /api/* routes don't need CORS (same-origin)
#
# 10.6 — XSS protection
#   - [ ] No dangerouslySetInnerHTML without sanitization
#   - [ ] User input is escaped by React (default)
#   - [ ] Admin panel doesn't execute sheet data as HTML
#
# 10.7 — CSRF protection
#   - [ ] POST endpoints validate Origin header (if needed)
#   - [ ] OR use SameSite cookies for auth (long-term)

# ============================================================
# SECTION 11: PERFORMANCE
# ============================================================
# 11.1 — Bundle size
#   - [ ] First Load JS < 200KB (verify in build output)
#   - [ ] No unused dependencies
#   - [ ] Tree-shaking works (no full library imports)
#
# 11.2 — Image optimization
#   - [ ] All images lazy-loaded
#   - [ ] Cloudinary transformations (w_800 limit)
#   - [ ] Local images optimized
#   - [ ] WebP format where possible
#
# 11.3 — Network requests
#   - [ ] Smart polling (version check before full fetch)
#   - [ ] Catalog cache (30s TTL in worker-client)
#   - [ ] Static JSON fallback (24h stale acceptable)
#   - [ ] No per-visitor Apps Script calls (Worker cron only)
#
# 11.4 — React rendering
#   - [ ] useMemo for expensive computations
#   - [ ] useCallback for stable function references
#   - [ ] React.memo for pure components (if needed)
#   - [ ] No unnecessary re-renders
#
# 11.5 — Worker quota
#   - [ ] KV reads: < 100K/day (50K visitors × 2 reads)
#   - [ ] KV writes: < 1K/day (hash-skip + sampling)
#   - [ ] Worker requests: < 100K/day (smart polling saves 80%)
#   - [ ] Apps Script calls: < 300/day (cron every 5 min = 288)

# ============================================================
# SECTION 12: ACCESSIBILITY
# ============================================================
# 12.1 — Semantic HTML
#   - [ ] No <div> inside <ul> (invalid)
#   - [ ] No <div> inside <table> (invalid)
#   - [ ] Buttons are <button>, not <div onClick>
#   - [ ] Links are <a>, not <div onClick>
#
# 12.2 — ARIA
#   - [ ] All interactive elements have aria-label
#   - [ ] Modal has role="dialog" + aria-modal
#   - [ ] Drawer has role="dialog"
#   - [ ] Toast has role="alert"
#   - [ ] Status badges have role="status"
#
# 12.3 — Keyboard navigation
#   - [ ] All buttons reachable by Tab
#   - [ ] Focus visible (focus ring)
#   - [ ] Modal focus trap
#   - [ ] ESC closes modal
#
# 12.4 — Screen readers
#   - [ ] Images have alt text
#   - [ ] Form inputs have labels (htmlFor)
#   - [ ] Error messages have aria-live

# ============================================================
# SECTION 13: BROWSER COMPATIBILITY
# ============================================================
# 13.1 — Modern browsers (last 2 versions)
#   - [ ] Chrome, Firefox, Safari, Edge
#   - [ ] No deprecated APIs
#
# 13.2 — Older browsers (Algeria has many old devices)
#   - [ ] AbortController (or polyfill)
#   - [ ] fetch (or polyfill)
#   - [ ] Promise (or polyfill)
#   - [ ] localStorage (or cookie fallback)
#   - [ ] IndexedDB (or localStorage fallback)
#
# 13.3 — Mobile browsers
#   - [ ] Touch events work
#   - [ ] No 300ms tap delay
#   - [ ] Viewport meta tag
#   - [ ] No horizontal scroll

# ============================================================
# SECTION 14: SEO
# ============================================================
# 14.1 — Meta tags
#   - [ ] title in user's language
#   - [ ] description in user's language
#   - [ ] keywords include brand + products
#   - [ ] og:title, og:description, og:image
#   - [ ] twitter:card
#
# 14.2 — Structured data
#   - [ ] Product schema (JSON-LD)
#   - [ ] Organization schema
#   - [ ] WebSite schema
#
# 14.3 — Sitemap
#   - [ ] sitemap.xml generated
#   - [ ] robots.txt references sitemap

# ============================================================
# SECTION 15: ERROR HANDLING
# ============================================================
# 15.1 — Top-level
#   - [ ] app/error.tsx catches route errors
#   - [ ] app/global-error.tsx catches layout errors
#   - [ ] window.onerror reports to console
#
# 15.2 — Async errors
#   - [ ] All fetches have try/catch
#   - [ ] All Promise chains have .catch()
#   - [ ] No unhandled promise rejections
#
# 15.3 — State corruption
#   - [ ] Cart corruption: try/catch + reset
#   - [ ] Catalog corruption: try/catch + fallback
#   - [ ] localStorage quota: catch + clear old data

# ============================================================
# SECTION 16: DEPLOYMENT
# ============================================================
# 16.1 — Build
#   - [ ] npx next build succeeds (0 errors)
#   - [ ] npx @cloudflare/next-on-pages succeeds
#   - [ ] All routes registered (verify in build output)
#
# 16.2 — Environment variables (Cloudflare Pages)
#   - [ ] NEXT_PUBLIC_SHEET_URL
#   - [ ] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
#   - [ ] NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
#   - [ ] NEXT_PUBLIC_WORKER_URL
#   - [ ] NEXT_PUBLIC_WORKER_ADMIN_SECRET
#   - [ ] NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
#   - [ ] NEXT_PUBLIC_TELEGRAM_CHAT_ID
#
# 16.3 — Worker secrets (wrangler secret)
#   - [ ] APPS_SCRIPT_URL
#   - [ ] ADMIN_SECRET
#
# 16.4 — Post-deploy verification
#   - [ ] Visit https://soumdeco.pages.dev/ → loads
#   - [ ] Visit https://soumdeco.pages.dev/api/version → returns JSON
#   - [ ] Visit https://soumdeco.pages.dev/api/catalog → returns products
#   - [ ] Admin panel works (save product → appears in 5 min)
#   - [ ] Order submission works (Telegram notification received)

# ============================================================
# END OF AUDIT
# Total points: 300+
# Expected time to complete: 4-6 hours of focused work
# After completing: re-run npx next build + deploy + verify
# ============================================================
