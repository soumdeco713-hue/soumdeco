# FINAL PRE-CLIENT HANDOVER SCAN — SOUM DECO

**Task ID:** `final-pre-client-scan`
**Date:** Pre-client handover audit
**Scope:** 37 source files (app routes, hooks, lib, components, API routes)
**Mode:** READ-ONLY — no code modified
**Engineer:** Senior QA Engineer

---

## 🚨 EXECUTIVE SUMMARY

| Metric | Value |
|---|---|
| Total files scanned | **37** |
| Files CLEAN | **22** |
| Files with ⚠️ CONCERNS only | **13** |
| Files with ❌ ISSUES | **2** |
| **P0 (showstopper) issues** | **1** |
| P1 (high) issues | **2** |
| P2 (medium) concerns | **6** |
| P3 (low/cosmetic) concerns | **7** |

### 🛑 VERDICT: **NEEDS FIXES — DO NOT HAND TO CLIENT YET**

A single **P0 critical bug in `cod-order-form.tsx` completely blocks all order submissions**. The client will receive **zero orders** through the website until this is fixed. The filter at line 271 checks `it.productId` which is never present on `OrderItem` objects, so the validation always fails with *"السلة فارغة أو تحتوي على منتجات لم تعد متاحة."*

Everything else (catalog, cart, admin panel, image pipeline, fallbacks, health monitor) is functional and well-defended.

---

## 📋 PER-FILE CHECKLIST

### App routes
| # | File | Status | Notes |
|---|---|---|---|
| 1 | `src/app/page.tsx` | ✅ CLEAN | Hash routing, scroll restoration, orphan pruning — all correct |
| 2 | `src/app/layout.tsx` | ⚠️ CONCERN | `dir="ltr"` on `<html lang="ar">` (intentional, but unusual); Toaster has stray blank line |
| 3 | `src/app/error.tsx` | ✅ CLEAN | Route-level error boundary, friendly Arabic message |
| 4 | `src/app/not-found.tsx` | ✅ CLEAN | 404 page with link home |

### Hooks
| # | File | Status | Notes |
|---|---|---|---|
| 5 | `src/hooks/use-catalog.ts` | ⚠️ CONCERN | Polling race during admin save (100ms window); untracked `setTimeout(refresh, 300)` |
| 6 | `src/hooks/use-cart.ts` | ✅ CLEAN | Self-healing, sanitization, variant-aware, all guarded |
| 7 | `src/hooks/use-stock.ts` | ⚠️ CONCERN | Unused import `CART_STORAGE_KEY` (line 4) — dead code, no runtime impact |

### Lib
| # | File | Status | Notes |
|---|---|---|---|
| 8 | `src/lib/products.ts` | ⚠️ CONCERN | Seed data has `category: "Meubes"` typo (auto-fixed by `fixCategoryTypos` in use-catalog) |
| 9 | `src/lib/client-sheet.ts` | ✅ CLEAN | Retry, timeout, dedupe, all error paths return safe defaults |
| 10 | `src/lib/sheet.ts` | ✅ CLEAN | Server-side wrappers, hard-coded fallback URL |
| 11 | `src/lib/image-manifest.ts` | ✅ CLEAN | Manifest caching, 5s timeout, retry on failure |
| 12 | `src/lib/adaptive-storage.ts` | ✅ CLEAN | localStorage→IndexedDB fallback, all paths guarded |
| 13 | `src/lib/failed-orders.ts` | ✅ CLEAN | Retry queue with MAX_RETRIES cap, silent operation |
| 14 | `src/lib/health-monitor.ts` | ⚠️ CONCERN | `visibilitychange`, `online`, `offline` listeners never removed in `stopHealthMonitor()` — minor leak (monitor starts once per session) |
| 15 | `src/lib/brand-config.ts` | ⚠️ CONCERN | Admin password `"dimou2411@dz"` hardcoded in plain text (line 17) — **security risk if repo is public** |

### Components (site)
| # | File | Status | Notes |
|---|---|---|---|
| 16 | `src/components/site/product-image.tsx` | ✅ CLEAN | Cloudinary→local fallback, fade-in, src-change reset |
| 17 | `src/components/site/product-card.tsx` | ✅ CLEAN | Fixed-height layout, badges, rupture overlay |
| 18 | `src/components/site/product-page.tsx` | ⚠️ CONCERN | Dead code: `activeTier` (line 131) + `tierBenefitText` (line 136) computed but never used in JSX; only `tiers` is passed to CodOrderForm which has correct logic |
| 19 | `src/components/site/admin-panel.tsx` | ⚠️ CONCERN | `onReset` prop declared in type (line 38) but never destructured/used; tier `discountAmount` input can't be cleared to empty (always shows 0); Arabic pluralization is rough |
| 20 | `src/components/site/admin-image-preview.tsx` | ✅ CLEAN | Local→Cloudinary fallback with src reset |
| 21 | `src/components/site/featured-carousel.tsx` | ✅ CLEAN | Bulletproof index guard, interval cleanup, pause-on-hover |
| 22 | `src/components/site/cart-bar.tsx` | ✅ CLEAN | NaN-safe totals, priced/unpriced item handling |
| 23 | `src/components/site/checkout-modal.tsx` | ✅ CLEAN | Body scroll lock, Escape key, cleanup |
| 24 | `src/components/site/cod-order-form.tsx` | ❌ **ISSUE P0** | **Line 271: `it.productId` always undefined → ALL orders rejected** |
| 25 | `src/components/site/all-products.tsx` | ✅ CLEAN | Category grouping, scroll arrows, resize listener cleanup |
| 26 | `src/components/site/categories.tsx` | ✅ CLEAN | Other-category handling, RTL section |
| 27 | `src/components/site/special-offers-section.tsx` | ✅ CLEAN | Conditional render, magenta accent |
| 28 | `src/components/site/error-boundary.tsx` | ✅ CLEAN | Class boundary, reload button, dev details |
| 29 | `src/components/site/loading-fallback.tsx` | ⚠️ CONCERN | Runs `setInterval` every 3s for entire session (minor CPU); auto-reload logic OK |
| 30 | `src/components/site/manifest-preloader.tsx` | ✅ CLEAN | Side-effect only, no render |
| 31 | `src/components/site/health-monitor-starter.tsx` | ✅ CLEAN | Side-effect only |
| 32 | `src/components/site/hero.tsx` | ✅ CLEAN | Static halos, logo, no JS state |
| 33 | `src/components/site/site-menu.tsx` | ✅ CLEAN | Drawer, nav links, contact links |
| 34 | `src/components/site/site-footer.tsx` | ✅ CLEAN | Hydration-safe year, social links |

### API routes
| # | File | Status | Notes |
|---|---|---|---|
| 35 | `src/app/api/products/route.ts` | ⚠️ CONCERN | **Dead code** — UI uses `clientListProducts` directly, never calls this route; `quantityTiers` serialization at line 202 drops the `mode` field (would break "min" mode tiers if anyone called this route) |
| 36 | `src/app/api/stock/route.ts` | ⚠️ CONCERN | **Dead code** — UI uses `clientGetStockCsv` directly |
| 37 | `src/app/api/order/route.ts` | ❌ **ISSUE P1** | **Dead code AND missing validation** — UI never calls this route (uses `clientSubmitOrder`); `required` array at line 22 is missing `commune`, `phone`, `product`, `quantity` |

---

## ❌ ALL ISSUES (sorted by severity)

### 🔴 P0 — CRITICAL (blocks client operations)

#### **P0-1: Checkout completely broken — orders NEVER submit**
- **File:** `src/components/site/cod-order-form.tsx`
- **Line:** 271
- **Code:**
  ```ts
  const validItems = sanitizedItems.filter((it) => it.productId && it.name);
  if (validItems.length === 0) {
    toast.error("السلة فارغة أو تحتوي على منتجات لم تعد متاحة.");
    return;
  }
  ```
- **Root cause:** The `OrderItem` type (lines 17–21) only has `{ name, price, quantity }` — there is NO `productId` field. Both callers (`checkout-modal.tsx` line 37–41 and `product-page.tsx` line 161–167) explicitly construct `OrderItem` objects with only those 3 fields. So at runtime `it.productId` is always `undefined`, the filter always returns `[]`, and the validation always rejects the order.
- **User impact:** Every single checkout attempt — from the cart drawer AND from the product page's "اطلب مباشرة" form — fails with *"السلة فارغة أو تحتوي على منتجات لم تعد متاحة."* **The client will receive ZERO orders.**
- **Why previous scans missed it:** the previous PRE-HANDOVER-SCAN flagged "C4: cart variantKey plumbing" as a concern but did not catch that `OrderItem.productId` is structurally absent.
- **Fix:** Either remove the orphan filter (it was meant for `CartItem`, not `OrderItem`), or change it to `sanitizedItems.filter((it) => it.name)`. Recommended:
  ```ts
  const validItems = sanitizedItems.filter((it) => it.name);
  ```
- **Severity:** 🔴 **P0 — Showstopper. Client cannot operate the business.**

---

### 🟠 P1 — HIGH

#### **P1-1: `/api/order` route has incomplete required-field validation**
- **File:** `src/app/api/order/route.ts`
- **Line:** 22
- **Code:** `const required = ["fullName", "wilaya", "delivery"];`
- **Issue:** Missing `phone`, `commune`, `product`, `quantity`. If this route were ever called (currently dead code — UI uses `clientSubmitOrder` directly), orders with missing commune/product/quantity would still be forwarded to Apps Script and produce malformed sheet rows.
- **User impact:** None today (dead code). Becomes a risk if anyone re-wires the UI to use this route.
- **Fix:** `const required = ["fullName", "phone", "wilaya", "commune", "delivery", "product", "quantity"];`
- **Severity:** 🟠 P1 — Latent. Currently unreachable.

#### **P1-2: Hardcoded admin password in source**
- **File:** `src/lib/brand-config.ts`
- **Line:** 17
- **Code:** `adminPassword: "dimou2411@dz",`
- **Issue:** Real admin password is committed to source in plain text. Anyone with repo access (or who views the bundled JS in the browser) sees the password. `sessionStorage`-based auth is also client-side only — trivially bypassable.
- **User impact:** If the GitHub repo is public (or ever becomes public), anyone can log into the admin panel and edit/delete all products.
- **Fix:** Move to server-side auth (a real /api/admin/login route that sets an httpOnly cookie), or at minimum an env var. Also: rotate the password before going live (it's been in the repo history forever).
- **Severity:** 🟠 P1 — Security. Must fix before client handover if repo is shared.

---

### 🟡 P2 — MEDIUM (concerns)

| # | File:Line | Concern | Impact |
|---|---|---|---|
| P2-1 | `use-catalog.ts:190` | Untracked `setTimeout(() => refresh(), 300)` — not cleared on unmount | Stale closure can fire `setProducts` after unmount; React 18 silently ignores. Brief flash possible. |
| P2-2 | `use-catalog.ts:330,372` | Background `setTimeout(refresh, 100)` after admin save races with the just-finished optimistic update | 100ms window where a slower sheet response could overwrite the optimistic state. Rare. |
| P2-3 | `health-monitor.ts:111,120,124` | `visibilitychange`, `online`, `offline` listeners are added but never removed in `stopHealthMonitor()` | Minor listener leak; only matters if `startHealthMonitor()` were called multiple times (it's gated by `healthCheckInterval` guard, so safe in practice). |
| P2-4 | `api/products/route.ts:202` | `quantityTiers` serializer drops the `mode` field: `\`${t.qty}:${t.freeShipping||"none"}:${t.discountAmount||0}\`` | If this server route were called, all "min" mode tiers would silently downgrade to "exact" mode on save. UI uses `clientUpsertProduct` (correct), so no current impact. |
| P2-5 | `admin-panel.tsx:1183-1191` | `AdminPanel` destructures every prop EXCEPT `onReset` (declared in `AdminPanelProps` line 38, passed by `page.tsx` line 224) | Dead prop. Reset button is missing from the UI entirely — admin has no way to reset the catalog to seed via the UI. The `catalog.resetCatalog` function exists but is never invoked. |
| P2-6 | `product-page.tsx:131,136` | `activeTier` (useMemo) and `tierBenefitText` (function) are declared but never referenced in JSX | Dead code. The correct tier logic lives in `CodOrderForm`. No runtime impact but adds confusion + bundle size. |

### 🟢 P3 — LOW / COSMETIC

| # | File:Line | Concern |
|---|---|---|
| P3-1 | `use-stock.ts:4` | `CART_STORAGE_KEY` imported but never used (dead import) |
| P3-2 | `products.ts` seed (lines 594, 612, etc.) | `category: "Meubes"` typo in seed data — auto-fixed by `fixCategoryTypos` at runtime |
| P3-3 | `admin-panel.tsx:1048` | Tier `discountAmount` input can't be cleared (empty parses to 0, always shows 0). Cosmetic UX issue. |
| P3-4 | `admin-panel.tsx:1305` | Arabic pluralization `{products.length > 1 ? "ات" : ""}` is grammatically wrong (should be "منتجان" for 2, "منتجات" for 3+, "منتج واحد" for 1). Cosmetic. |
| P3-5 | `layout.tsx:80` | `<html lang="ar" dir="ltr">` — unusual combination. Intentional (page is LTR with RTL sections), but may confuse screen readers. |
| P3-6 | `layout.tsx:156` | Stray blank line inside `<Toaster>` props (between `richColors` and `toastOptions`). Cosmetic. |
| P3-7 | `loading-fallback.tsx:24-53` | `setInterval` runs every 3s for entire session even after page loads successfully. Minor CPU. Acceptable for safety net. |

---

## ✅ WHAT'S WORKING WELL (defended paths)

The codebase has strong defense-in-depth on these critical paths — **no action needed**:

1. **Catalog loading** — 4-tier fallback: sheet (10s timeout, 2 retries) → IndexedDB → localStorage → SEED_PRODUCTS. Skeleton gate ensures any data paints instantly.
2. **Cart persistence** — Self-healing on hydration (removes corrupted items, clamps qty 1-99), variant-aware merging, orphan pruning when catalog changes.
3. **Image pipeline** — Local Cloudflare Pages path (unlimited bandwidth) with Cloudinary fallback; src-change resets error state; 5s timeout on manifest fetch.
4. **Adaptive storage** — localStorage→IndexedDB automatic fallback with verification (no silent truncation).
5. **Failed orders** — Silent retry queue with MAX_RETRIES=5 cap, processed on every page visit.
6. **Error boundaries** — Top-level ErrorBoundary + route-level error.tsx + 404 not-found.tsx + `<noscript>` fallback in layout.
7. **Loading safety net** — `LoadingFallback` detects stuck skeletons + blank screens, shows refresh button after 6s, auto-reloads once after 15s (sessionStorage guarded).
8. **Health monitor** — Silent background checks, never throws, never shows errors to user.
9. **Admin save** — Optimistic update + rollback on failure; images uploaded on SELECT (not on Save) for instant-feeling UX.
10. **Cart totals** — NaN-safe, handles mixed priced + price-on-request items with "السعر عند الطلب" label.

---

## 🎯 RECOMMENDED FIX ORDER (before client handover)

### Must fix (blocks business operations):
1. **P0-1** — `cod-order-form.tsx:271` — Change `it.productId && it.name` to `it.name`. **5 minutes.** Without this, the client gets ZERO orders.

### Should fix (security + latent bugs):
2. **P1-2** — `brand-config.ts:17` — Rotate admin password + move to env var. **15 minutes.**
3. **P1-1** — `api/order/route.ts:22` — Add missing required fields. **5 minutes** (only if the route will be re-enabled).
4. **P2-5** — `admin-panel.tsx` — Wire up `onReset` prop OR remove it from the type. **10 minutes** (admin has no reset button currently).

### Nice to fix (cleanup):
5. **P2-1, P2-2** — Track/clear `setTimeout` in use-catalog. **10 minutes.**
6. **P2-3** — Remove listeners in `stopHealthMonitor`. **5 minutes.**
7. **P2-4** — Add `mode` to `quantityTiers` serializer in api/products route. **5 minutes** (dead code).
8. **P2-6** — Remove dead `activeTier` + `tierBenefitText` from product-page.tsx. **2 minutes.**
9. **P3-1** — Remove unused `CART_STORAGE_KEY` import in use-stock.ts. **1 minute.**

### Estimated time to "READY FOR CLIENT":
- **30 minutes** for P0 + P1 fixes (must)
- **+ 30 minutes** for P2 cleanup (recommended)
- **Total: ~1 hour** of focused work

---

## 🏁 FINAL VERDICT

> ### ❌ **NEEDS FIXES — DO NOT HAND TO CLIENT YET**
>
> The site is **functionally complete and visually polished**, with strong defense-in-depth on catalog, cart, image, and error paths. **However, a single P0 bug in `cod-order-form.tsx:271` completely blocks all order submissions** — the client would receive zero orders from the website.
>
> After fixing the P0 (5-minute change) and ideally the P1 security issue (admin password), the site is **safe to hand to the client**.
>
> **Re-scan required after P0 fix** to confirm orders flow end-to-end (form submit → Apps Script → sheet row appears).

---

*End of report. Generated by final-pre-client-scan task. No code was modified — read & report only.*
