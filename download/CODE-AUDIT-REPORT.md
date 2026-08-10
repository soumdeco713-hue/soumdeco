# SOUM DECO — Comprehensive Code Audit Report

**Task ID:** `full-audit`
**Agent:** `audit-subagent`
**Date:** 2025-01-15
**Scope:** Full source audit of Next.js 16 + Cloudflare Pages e-commerce site
**Files Audited:** 32 source files

---

## Executive Summary — Top 10 Critical Issues

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **P0** | Entire app | **No Error Boundary** — any render throw → white screen |
| 2 | **P0** | `featured-carousel.tsx:53` | **Crash when `products` shrinks** — `products[index]` is `undefined` for one render before effect resets index |
| 3 | **P0** | `cod-order-form.tsx:280-284` | **Orders silently lost** — `no-cors` fetch returns opaque response; success shown even if order never reached sheet |
| 4 | **P0** | `client-sheet.ts:159` / `drive-upload.ts:41` | **Image upload failure saves base64 to sheet** — bloats cells beyond 50K limit, Apps Script throws, product save fails silently |
| 5 | **P0** | `admin-panel.tsx:952-956` | **Admin Save not awaited** — `handleSave` closes form immediately, no feedback on failure; double-clicks fire parallel uploads |
| 6 | **P0** | `use-catalog.ts:238-242` | **Optimistic update never rolled back** — failed sheet POST leaves product in localStorage; on refresh it vanishes |
| 7 | **P1** | `cart-bar.tsx:99` | **React key collision** — `key={item.productId}` collides if variantKey is ever used (latent) |
| 8 | **P1** | `layout.tsx:80-81` | **Dead preloads hit broken API** — `/api/products` and `/api/stock` return 500 on Cloudflare edge; wasted bandwidth |
| 9 | **P1** | `next.config.ts:6` | `ignoreBuildErrors: true` — TypeScript errors ship to production |
| 10 | **P1** | `admin-panel.tsx:48-114` | **No max file size check** — 50MB image freezes browser tab during canvas resize |

---

## Per-File Find

---

### 1. `src/lib/client-sheet.ts`

**Critical:**
- **L159-167 — Image upload failure returns base64 (silent data corruption):**
  ```ts
  if (!res.ok) return dataUrl;  // returns base64
  ```
  If Cloudinary rejects (quota, invalid preset, oversized), the base64 data URL is returned and then saved to the Google Sheet by `use-catalog.ts:218`. A single 850px WebP is ~70KB → ~93K base64 chars. The Sheet's cell limit is 50,000 chars. **Apps Script will throw**, the product row is never written, and the admin sees a success toast (because `clientUpsertProduct` returns the POST result, not the upload result). The product appears in the UI (localStorage) but not in the sheet.

- **L149 — `public_id` on unsigned upload may be rejected:**
  ```ts
  formData.append("public_id", filename);
  ```
  Cloudinary unsigned uploads only allow `public_id` if the upload preset explicitly permits it. If the preset doesn't, Cloudinary returns 400 → falls back to base64 → triggers the issue above.

**Medium:**
- **L174-189 — Sequential uploads (slow):** 5 images = 5 sequential network round-trips. Should use `Promise.all`. Adds 4-20s to admin save.
- **L32-36, L76-81, L95-99, L111-116, L151-157 — No fetch timeout:** If Apps Script / Cloudinary is slow (cold start), fetch hangs indefinitely. No `AbortController`. User sees infinite spinner.
- **No retry logic** on any operation. A single transient network error = silent failure.

**Minor:**
- L193-233 — `normalizeSheetProduct` is duplicated from `sheet.ts:213-253`. DRY violation; they can diverge.

---

### 2. `src/lib/sheet.ts`

**Critical:**
- **L8-9 — Hardcoded Apps Script URL in source:**
  ```ts
  export const SHEET_BASE_URL = "https://script.google.com/macros/s/AKfycbx.../exec";
  ```
  This is committed to the repo. If the Apps Script is redeployed (new URL), the code must be updated. Not a security issue (the URL is public anyway), but a maintenance hazard.

- **L200-205 — Order success detection is unreliable:**
  ```ts
  if (res.ok) return true;
  const text = await res.text().catch(() => "");
  return text.includes('"ok"') || text.includes("true");
  ```
  With `redirect: "follow"`, Apps Script's 302 → 200 should make `res.ok` true. But the text fallback is fragile — any response containing "true" anywhere would be treated as success.

**Medium:**
- **L171-191 — GET for order submission risks duplication:** GET requests can be cached/retried by browsers or intermediaries. A network retry could submit the same order twice. POST would be safer but Apps Script doPost has CORS limitations.
- **L175-191 — URL length risk:** All fields are truncated, but URL-encoded Arabic/Turkish chars expand 1→3. Combined URL could approach browser limits (~2048-8192 chars). No total length check.

**Minor:**
- L73-90 — `sheetListProducts` (server-side) is now dead code since `use-catalog.ts` uses `clientListProducts` directly. Same for `sheetUpsertProduct`, `sheetDeleteProduct`, `sheetResetProducts`.

---

### 3. `src/lib/products.ts` (1031 lines)

**Critical:**
- None directly, but the `normalizeProduct` function (L900-994) is the single point of failure for data parsing. If the sheet returns a product with an unexpected shape (e.g., `price` as an object `{fr: 100, ar: 200}`), it's handled (L905-907). But if `price` is a string like "abc", `Number("abc")` = `NaN`, which is stored as the price. `formatPrice(NaN)` = "NaN دج". **No NaN guard.**

**Medium:**
- **L632-635 — `formatPrice` doesn't guard against NaN:**
  ```ts
  export function formatPrice(price: number | null): string {
    if (price === null || price === undefined) return "السعر عند الطلب";
    return `${price.toLocaleString("fr-FR")} دج`;
  }
  ```
  If `price` is `NaN`, `NaN.toLocaleString()` = `"NaN"`, so the output is `"NaN دج"`. Should add `isNaN(price)` check.

- **L881-898 — `loadCatalog` doesn't validate item schema:** Parsed array items are passed to `normalizeProduct` which handles most cases, but if `parsed` is `[null, null, ...]`, `normalizeProduct(null)` returns `null` and is filtered. OK. But if `parsed` is `[{quantity: "abc"}]`, the malformed item is loaded with default values. No explicit schema validation.

- **L996-1005 — `saveCatalog` doesn't handle quota exceeded:**
  ```ts
  catch (e) {
    console.error("[saveCatalog] localStorage write failed:", e);
    return false;
  }
  ```
  If localStorage is full (5-10MB typical), the write fails silently. The catalog won't persist. On next page load, the user gets seed products. No user-visible warning.

- **L1021-1031 — `generateId` collision risk:** 5 random base36 chars = 36^5 = ~60M possibilities. With 100 products, birthday paradox says collision is unlikely but not impossible. If a collision occurs, `upsertProduct` overwrites the existing product.

**Minor:**
- L85-86 — `CATALOG_STORAGE_KEY` and `CART_STORAGE_KEY` are exported but `use-catalog.ts` imports `CATALOG_STORAGE_KEY` while `use-cart.ts` imports `CART_STORAGE_KEY`. Consistent.
- L653-674 — `splitImageStrings` handles 5 different separators. Could be simplified.
- L107-630 — `SEED_PRODUCTS` (29 products) is hardcoded with full Cloudinary URLs. If Cloudinary account is deleted, all seed images break.

---

### 4. `src/lib/drive-upload.ts`

**Critical:**
- **L11-12 — Module-level `process.env` access:** 
  ```ts
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "anhvhy4j";
  ```
  On Cloudflare edge runtime, `process.env` may not be populated for `NEXT_PUBLIC_` vars at module load time (they're inlined at build time). If the build doesn't inline them, this falls back to the hardcoded `"anhvhy4j"`. OK in practice but fragile.

- **L41-51 — Same base64 fallback issue as `client-sheet.ts`:**
  ```ts
  if (!res.ok) return dataUrl;
  ```
  Returns base64 on failure → sheet cell overflow → silent product save failure.

**Medium:**
- L58-73 — Sequential uploads (same as `client-sheet.ts`).
- This file is now dead code (the client uses `client-sheet.ts` directly), except via the API route which is also dead code.

---

### 5. `src/lib/brand-config.ts`

**Critical:**
- **L17 — Admin password in client bundle:**
  ```ts
  adminPassword: "dimou2411@dz",
  ```
  This is shipped to every browser. Anyone can read it from the JS bundle (`View Source` → search `.js` files). This is the fundamental limitation of client-side auth. For a real e-commerce site, auth must be server-side.

**Minor:**
- L48-54 — Storage keys are versioned (`_v2`), good for cache busting.
- L57 — `cloudinaryUploadPreset: "soumdeco"` is hardcoded and must match the Cloudinary dashboard. Not configurable per-environment.

---

### 6. `src/hooks/use-catalog.ts`

**Critical:**
- **L238-242 — Failed upsert not rolled back:**
  ```ts
  const ok = await clientUpsertProduct(sheetProduct);
  if (!ok) {
    console.error("[upsertProduct] Apps Script POST failed");
  }
  if (ok) await refresh();
  ```
  The optimistic `setProducts` + `saveCatalog` at L187-200 already wrote to localStorage. If the POST fails, the product stays in localStorage but not in the sheet. The error is only `console.error`'d. The admin sees the product in the list (from localStorage) and thinks it's saved. On next page load, `refresh` fetches from the sheet (which doesn't have it) and the product vanishes. **No toast, no rollback, no retry.**

- **L253-269 — Failed delete not rolled back:** Same issue. `setProducts` removes from state + localStorage, then `clientDeleteProduct` fails silently. Product reappears on next refresh. Confusing.

- **L305-364 — `moveProduct` side effects in state updater:**
  ```ts
  setProducts((prev) => {
    // ... mutate toSync variable outside
    toSync = [newA, newB];
    return sorted;
  });
  ```
  State updater functions should be pure. Mutating `toSync` (an outer variable) inside the updater is a code smell. In React 18 StrictMode this could run twice (but StrictMode is disabled). If React ever defers the update, `toSync` could be stale when the sync runs.

- **L333-360 — Parallel POSTs to Apps Script for reorder:** Two `clientUpsertProduct` calls fire in parallel. Apps Script may not handle concurrent writes well (last-write-wins could lose one update). Errors are silently swallowed with `.catch(() => {})`.

**Medium:**
- **L61-86 — Empty sheet falls back to seed:** If admin deletes ALL products in the sheet, `clientListProducts` returns `[]`, then localStorage is checked (also empty), then SEED_PRODUCTS (29 products) is loaded. **Admin can NEVER have an empty catalog.** This may be intentional but is surprising.
- **L82 — `saveCatalog(next)` on every poll:** Every 5.5 minutes, 83 products are serialized to JSON and written to localStorage. Could cause jank on slow devices. Should only write if changed (e.g., compare JSON hash).
- **L110-131 — Catch-all error handler with no user feedback:** Network errors, parse errors, and Apps Script outages all silently fall back to cache/seed. No toast, no retry, no error state.
- **L142-179 — No guard against setState after unmount:** If the component unmounts while `refresh` is in-flight, `setProducts` fires on an unmounted component. React 18 just warns, but it's still a code smell.
- **L272-299 — `addBlankProduct` uses `productsRef.current`:** This is correct (avoids stale closure), but `productsRef` is updated in a separate `useEffect` (L47-49) which runs AFTER render. So on the first render after `products` changes, `productsRef.current` is stale. If `addBlankProduct` is called in that window, the `maxSort` calculation uses old data. Edge case.

**Minor:**
- L33-34 — Polling intervals are hardcoded. Could be configurable.

---

### 7. `src/hooks/use-stock.ts`

**Medium:**
- **L86-99 — `fetchStock` swallows all errors:** No retry, no user feedback. If stock fetch fails, `stockMap` stays `{}` and `isRupture`/`isLowStock` always return `false`/`null`. Products appear in-stock even if they're not.
- **L9-62 — `parseCsv` is fragile:** Doesn't handle quoted CSV with embedded commas/newlines. Header detection is heuristic. If the sheet's Stock tab format changes, parsing silently fails.
- **L132-159 — O(n×m) linear scan per product:** For each `isRupture(name)` call, it iterates ALL `stockMap` keys and normalizes each. With 83 products × 83 stock entries = ~6,889 normalizations per render. `page.tsx` calls `isRupture` and `isLowStock` for every product card. Should pre-normalize the map once.
- **L77-78 — Polling interval comment says "dev — will bump to 30min on push":** Still at 5.5 min. Either the comment is stale or the bump was never done.

**Minor:**
- L89 — Dynamic import of `clientGetStockCsv` inside `useCallback`. Why not a static import? The dynamic import adds a tiny delay on first call.

---

### 8. `src/hooks/use-cart.ts`

**Critical:**
- **L99 (cart-bar.tsx) — React key collision (latent):** `key={item.productId}` in the cart drawer. The cart supports multiple items with the same `productId` but different `variantKey` (L50-53). If two variants of the same product are in the cart, React keys collide → one item may not render, or updates may target the wrong item. Currently latent because no caller passes `variantKey`, but the mechanism exists and could be wired up later.

- **L69-88 — `updateQuantity` only updates FIRST matching item:**
  ```ts
  persist(
    items.map((i) => {
      if (i.productId === productId && !updated) { ... }
      return i;
    }),
  );
  ```
  If multiple variants exist (same productId, different variantKey), only the first is updated. The comment says "variantKey is embedded in productId for UI" but that's not true — `variantKey` is a separate field.

- **L90-105 — `removeItem` only removes FIRST matching item:** Same issue.

**Medium:**
- **L43-67 — `addToCart` reads from localStorage, bypassing React state:**
  ```ts
  const current: CartItem[] = JSON.parse(
    window.localStorage.getItem(CART_STORAGE_KEY) || "[]",
  );
  ```
  This is done to get the latest state (in case another tab modified the cart). But it bypasses the React `items` state, which could be stale. If `items` state and localStorage diverge (e.g., due to a failed `setItem`), `addToCart` operates on localStorage while the UI shows `items` state. Inconsistency.
- **L34-41 — `persist` catches localStorage errors silently:** If quota exceeded, the cart isn't saved. No user warning.
- **L22-31 — No schema validation on loaded cart items:** If localStorage contains malformed items (missing fields, wrong types), they're loaded as-is. `addToCart` then operates on malformed data.
- **No `storage` event listener for cross-tab sync:** If user has 2 tabs and adds to cart in one, the other tab's cart is stale.

**Minor:**
- L111 — `count` is computed every render. Could be `useMemo`'d but it's cheap.

---

### 9. `src/app/page.tsx`

**Critical:**
- **L158-166 — `validProducts` filter runs every render (no `useMemo`):** For 83+ products, this O(n) filter + regex test runs on every render. With multiple child components re-rendering, this compounds. Should be `useMemo([catalog.products])`.
- **L167-169 — `featured` and `allProductsList` also re-computed every render.**

**Medium:**
- **L91 — `useEffect` dependency uses inline expression:**
  ```ts
  }, [view.kind, view.kind === "product" ? view.id : ""]);
  ```
  This works but is unusual. Could destructure `view` first.
- **L93-107 — `exitToHome` has redundant hash clearing:**
  ```ts
  try {
    history.pushState("", document.title, window.location.pathname + window.location.search);
  } catch {
    window.location.hash = "";
  }
  if (window.location.hash) {
    window.location.hash = "";
  }
  ```
  `pushState` already clears the hash. The subsequent `if` is dead code if pushState succeeds.
- **L136-145 — `handleCartItemOpen` silently fails if product deleted:** If the product was removed from the catalog, `find` returns undefined and nothing happens. No toast, no feedback.
- **L322-326 — `Categories` receives `allProductsList` (excludes special offers):** If a category has ONLY special-offer products, it won't appear in the category filter. Edge case.
- **No error boundary wrapping the page.** See P0 issue #1.

**Minor:**
- L52-57 — Scroll listener uses `{ passive: true }`, good.
- L65 — `savedScrollRef` is used to restore scroll position. Good UX.

---

### 10. `src/app/layout.tsx`

**Critical:**
- **L80-81 — Dead preloads hit broken API:**
  ```tsx
  <link rel="preload" as="fetch" href="/api/products" crossOrigin="anonymous" />
  <link rel="preload" as="fetch" href="/api/stock" crossOrigin="anonymous" />
  ```
  The site now fetches directly from Apps Script (per worklog Task `products-fix-29-to-96`). The `/api/products` and `/api/stock` routes return 500 on Cloudflare edge. These preloads waste bandwidth on guaranteed-500 responses and add latency.

**Medium:**
- **L77 — `lang="fr" dir="ltr"` but content is primarily Arabic:**
  ```tsx
  <html lang="fr" dir="ltr" suppressHydrationWarning>
  ```
  Screen readers will pronounce Arabic text with French pronunciation rules. Accessibility issue. Should be `lang="ar" dir="rtl"` (or use per-section `lang`/`dir` attributes, which some components already do).

**Minor:**
- L90-110 — Toaster config is verbose but correct.
- L78 — `suppressHydrationWarning` on `<head>` is needed because Toaster injects styles. OK.

---

### 11. `src/app/api/products/route.ts`

**Critical:**
- **L17 — Imports `SEED_PRODUCTS` from `@/lib/seed-products` (SheetProduct[]):**
  ```ts
  import { SEED_PRODUCTS } from "@/lib/seed-products";
  ```
  But `use-catalog.ts:16` imports `SEED_PRODUCTS` from `@/lib/products` (Product[]). These are TWO DIFFERENT arrays with different shapes (SheetProduct has `images: string`, Product has `images: string[]`). They can diverge over time. Maintenance hazard.
- **L159-168 — POST handler doesn't validate image size:** If client sends huge base64, `uploadImagesToDrive` uploads to Cloudinary. If Cloudinary rejects, the catch swallows the error and the original base64 is saved to the sheet → cell overflow → Apps Script throws.
- **This entire route is now dead code** — `use-catalog.ts` calls Apps Script directly. Only kept as a fallback that's never used.

**Medium:**
- L70 — `(req as any).env || (globalThis as any).env` — fragile env access. Cloudflare Pages may not expose env this way.
- L116-128 — Outer catch returns seed products with `ok: true`. This masks real errors. The client can't distinguish "sheet is empty" from "API crashed".

---

### 12. `src/app/api/stock/route.ts`

**Medium:**
- **L41 — Returns 502 on sheet failure:** But `clientGetStockCsv` (used by `use-stock.ts`) never calls this route — it calls Apps Script directly. So this route is dead code.
- **L9 — `const env = (req as any).env || (globalThis as any).env;`** — Same fragile env access.

**Minor:**
- L28-30 — Fallback CSV is minimal. OK.

---

### 13. `src/app/api/order/route.ts`

**Critical:**
- **L53-58 — Returns `ok: true` even when order fails:**
  ```ts
  if (!ok) {
    return NextResponse.json({ ok: true, warning: "order_queued" });
  }
  ```
  The comment says "order data is in the request body — it's not lost" but there's NO logging, NO queue, NO retry. The order is silently dropped. The customer sees a thank-you screen.
- **L63-67 — Outer catch also returns `ok: true`:** Same issue. Even unhandled exceptions are masked as success.

**Medium:**
- L7 — `PHONE_REGEX = /^0[567]\d{8}$/` — validates exactly 10 digits. But `cod-order-form.tsx:195` strips non-digits before validating: `PHONE_REGEX.test(form.phone.replace(/\D/g, ""))`. The API route doesn't strip non-digits from the body's phone. Inconsistent validation.
- This route is only used as a fallback in `cod-order-form.tsx:288`. The primary path is direct-to-Apps-Script with `no-cors`.

---

### 14. `src/components/site/admin-panel.tsx` (1172 lines)

**Critical:**
- **L952-956 — `handleSave` doesn't await `onUpsert`:**
  ```ts
  const handleSave = (p: Product) => {
    onUpsert(p);        // async, not awaited
    setEditing(null);   // closes form immediately
    toast.success("تم حفظ المنتج");
  };
  ```
  `onUpsert` is async (uploads to Cloudinary + POSTs to Apps Script, can take 5-30s). The form closes immediately and the success toast shows. If the upload or POST fails, the user has already navigated away and sees no error. The product may not be saved to the sheet.

- **L48-114 — `resizeImage` has no max file size check:**
  A 50MB JPEG (8000×8000px) will be loaded into an `Image` object, drawn to a canvas, and exported. For very large images, this can freeze the browser tab or crash with `OOM`. No `file.size` guard before processing.

- **L82-85 — WebP may not be supported on very old browsers:** `canvas.toDataURL("image/webp", quality)` returns `"data:image/png;base64,..."` on browsers without WebP support. The code doesn't detect this — it just uses whatever is returned. The PNG could be much larger than expected, potentially exceeding the 200K budget loop.

**Medium:**
- **L201-203 — `useEffect(() => setDraft(product), [product])` resets on reference change:** If the parent re-renders and passes a new `product` object (even with same content), the draft resets, losing unsaved edits. The parent passes `editing` state which only changes via `setEditing`, so this is fine in practice but fragile.
- **L218-255 — `handleFiles` doesn't validate file type beyond `image/*`:** SVGs pass the filter but can't be reliably rendered to canvas (CORS, no intrinsic size). GIFs lose animation. WebP with alpha may not preserve transparency when re-encoded.
- **L356-363 — `save()` only validates name:** No validation for:
  - Price being a valid number (could be NaN if `Number("")` is called)
  - Images being present (a product with no image is filtered out by `page.tsx` and won't appear)
  - Quantity tiers having valid qty > 0
  - Category being non-empty
- **L963-970 — `handleDelete` uses `window.confirm`:** Blocks the main thread. Ugly UX. No undo.
- **L292-297 — `removeVariant` uses global index:** The UI renders colors and sizes separately (filtered by type), but the index passed is global. `key={i}` for React is the global index. Removing a color shifts all indices. React may reuse wrong DOM elements. Should use stable keys.
- **L319-354 — Same index issue for quantity tiers.**
- **No sync status indicator:** The `syncing` state from `useCatalog` is not displayed. The user has no idea if a save/delete/reorder is in progress or failed.
- **L116-183 — `PasswordGate` password is compared in plain text:** Vulnerable to timing attacks (theoretical). Not a real concern for client-side auth.
- **L936-942 — `sessionStorage` check on mount:** If `sessionStorage` is disabled (private browsing, cookies blocked), the check throws and is caught. The admin has to re-enter the password on every navigation. OK.

**Minor:**
- L207 — `MAX_PHOTOS = 8` but comment says "Allow up to 5 high-quality photos". Inconsistent.
- L249-251 — Toast message has redundant " بنجاح" for both singular and plural.
- L1041-1052 — Category grouping in admin is alphabetical. Could match the storefront's "by count" ordering.

---

### 15. `src/components/site/checkout-modal.tsx`

**Medium:**
- **L23-35 — Body overflow cleanup race:** If two modals open in quick succession, the `prev` value saved by the first may be `"hidden"` (set by the second), not the original `""`. On cleanup, body overflow is set to `"hidden"` permanently. Edge case.
- **L43-46 — `handleSuccess` calls `onOrderSuccess` then `setCleared(true)`:** `onOrderSuccess` clears the cart (page.tsx:153). This causes `items` to become `[]`, which causes `orderItems` to recompute as `[]`, which is passed to `CodOrderForm`. The form's `useEffect` fires and resets internal `items` to `[]`. But the form is showing the thank-you screen, so no visual bug. However, if the user closes and reopens the modal, the form is remounted fresh. OK.

**Minor:**
- L21 — `cleared` state controls the heading text. Could be derived from the form's `done` state instead. Minor.

---

### 16. `src/components/site/cart-bar.tsx`

**Critical:**
- **L99 — React key collision (latent):**
  ```tsx
  {items.map((item) => (
    <div key={item.productId} ...>
  ```
  If two items have the same `productId` but different `variantKey` (supported by `use-cart.ts:50-53`), keys collide. Currently no caller passes `variantKey`, so this is latent. **Fix:** `key={`${item.productId}-${item.variantKey || ""}`}`.

**Medium:**
- **L55-58 — Cart total counts null-price items as 0:**
  ```ts
  const total = items.reduce(
    (sum, i) => sum + (i.price ?? 0) * i.quantity,
    0,
  );
  ```
  If a product's price is `null` (price-on-request), it contributes 0 to the total. The cart shows "0 دج" which is misleading. Should show "السعر عند الطلب" or exclude null-price items from the total.
- **L56 — `i.price ?? 0` masks NaN:** If `i.price` is `NaN` (from a malformed localStorage entry), `NaN ?? 0` = `NaN` (because `NaN` is not null/undefined). `sum + NaN * quantity` = `NaN`. The total shows "NaN دج".

**Minor:**
- L60 — `if (!open) return null;` — the drawer unmounts when closed. No exit animation. Minor UX.

---

### 17. `src/components/site/product-page.tsx`

**Critical:**
- **L53-60 — `useEffect` on `[product?.id]` runs `window.scrollTo`:** If `product` is undefined (product not found), this effect runs with `product?.id` = undefined. The effect body calls `window.scrollTo({ top: 0, behavior: "smooth" })`. This is harmless but runs unnecessarily.

**Medium:**
- **L98-101 — `activeTier` useMemo has correct deps:** `[tiers, selectedQty]`. OK.
- **L128-134 — `orderItems` recomputed every render:** Passed to `CodOrderForm` as `initialItems`. Since it's a new array reference each render, the form's `useEffect([initialItems])` fires every render. But the parent only re-renders when its own state changes (`activeIdx, added, selectedColor, selectedSize, selectedQty`). The form's internal `setSingleQty` doesn't trigger parent re-render. So in practice, the effect doesn't fire during form interaction. **Latent fragility** — if any parent state changes during form use, the form's quantity selection resets.
- **L136-145 — `handleAdd` doesn't pass `variantKey`:** The cart supports `variantKey` but it's never sent. If the user selects a color/size, the cart item doesn't record which variant. The order notes DO include `variantSummary` (L149-154), but the cart item itself has no variant info. If the user adds the same product in different colors, they merge into one line item with incremented quantity, losing the variant distinction.
- **L46 — `getProductImages(product)` could return empty array:** If the product has no images, `images = []`. Then `currentImage = images[activeIdx] || images[0] || ""` = `""`. The gallery shows "لا توجد صورة". OK, handled.
- **L73-76 — `go(dir)` with `hasMultiple` guard:** OK, won't crash on single-image products.
- **L59 — `window.scrollTo({ top: 0, behavior: "smooth" })` on product change:** This fires when navigating between related products. But `onProductClick` (passed from page.tsx) also navigates. The smooth scroll + navigation could conflict. Minor UX.

**Minor:**
- L318-322 — `variantAdjustment !== 0` check is correct but doesn't handle NaN.
- L467-491 — Related products `slice(0, 4)` is correct.

---

### 18. `src/components/site/product-card.tsx`

**Minor:**
- L64 — `h-10 overflow-hidden` for 2-line title. If title is 1 line, there's empty space. Intentional for uniform card height.
- L73-78 — `oldPrice` struck-through shown before `priceLabel`. If `oldPrice` is null, no strikethrough. OK.
- No `onError` on the `ProductImage` — if the image URL 404s, a broken image icon shows. No fallback.

---

### 19. `src/components/site/all-products.tsx`

**Medium:**
- **L49-74 — `useMemo` deps are `[products]`:** The memoization recomputes when the `products` array reference changes. Since `page.tsx` passes `allProductsList` (a new array from `.filter()` every render), this memo re-computes every render. Defeats the purpose.
- **L54 — Sort by `sortOrder` DESCENDING:** `sorted = [...products].sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))`. But `use-catalog.ts` sorts by `sortOrder` ASCENDING (L79). So the storefront shows products in REVERSE order within each category section. **Inconsistency** — the admin's "move up" actually moves the product later in the storefront display. This may be intentional ("newest first") but contradicts the admin's expectation.
- **L205-218 — `checkScroll` effect deps `[products]`:** Re-runs on every products reference change. Adds/removes resize listener. No leak but churn.

**Minor:**
- L221-230 — `scrollBy` uses `querySelector(".product-card-h")` to get card width. If no cards exist, falls back to 150. OK.
- L232 — `if (products.length === 0) return null;` after the component is already rendered. The parent checks this too. Redundant but safe.

---

### 20. `src/components/site/categories.tsx`

**Minor:**
- L17-32 — `useMemo` deps `[products]`. Same issue as AllProducts — re-computes every render because `products` is a new reference.
- L34 — `if (categories.length === 0) return null;` — hides the entire section if no categories. OK.

---

### 21. `src/components/site/featured-carousel.tsx`

**Critical:**
- **L47-53 — Race condition: index out of bounds after `products` shrinks:**
  ```ts
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  const current = products[index];  // ← could be undefined
  const rupture = isRupture?.(current);  // ← throws if current is undefined
  ```
  If `products` changes from 5 items to 2 items while `index` is 4, the effect runs AFTER render. During render, `products[4]` is `undefined`. Then `current.image` (L106), `current.name` (L142), `current.price` (L145) all throw `TypeError: Cannot read properties of undefined`. **White screen crash.**

  **Fix:**
  ```ts
  const current = products[index] ?? products[0];
  if (!current) return null;
  ```

**Medium:**
- **L35-45 — Timer effect deps `[count]`:** Timer is recreated when `count` changes. OK. But if `count` changes rapidly (e.g., during catalog refresh), multiple timers could overlap. The cleanup clears the previous. OK.
- **L82-83 — `pausedRef` on mouse enter/leave:** If the carousel unmounts while paused (e.g., navigation), no leak (cleanup clears interval). OK.

**Minor:**
- L14 — `ROTATE_MS = 4500` — 4.5s rotation. OK.
- L177-190 — Dots are buttons with `type="button"`. OK.

---

### 22. `src/components/site/special-offers-section.tsx`

**Minor:**
- L26 — `products.filter((p) => p.isSpecialOffer === true)` — strict equality. OK.
- L29 — `if (offerProducts.length === 0) return null;` — hides section. OK.
- No rupture/low-stock display for special offers (unlike product-card). The `isRupture` prop is accepted but only used for the overlay. OK.

---

### 23. `src/components/site/hero.tsx`

**No issues.** Static component, no state, no effects, no event listeners. Clean.

---

### 24. `src/components/site/site-menu.tsx`

**Medium:**
- **L36-42 — `handleNav` doesn't validate `href` is a valid selector:**
  ```ts
  const el = document.querySelector(href);
  ```
  If `href` is `#tous` and there's no element with `id="tous"` (e.g., on a product page), `querySelector` returns null. The optional chaining `el?.scrollIntoView(...)` handles it. But the user sees the menu close with no scroll. No feedback. UX issue.
- **L38 — `setTimeout(() => {...}, 250)`:** Fixed delay for menu close animation. If the animation is slower, the scroll fires before the menu closes. Minor.

**Minor:**
- L44 — `if (!open) return null;` — no exit animation.

---

### 25. `src/components/site/site-footer.tsx`

**Medium:**
- **L9-10 — `year` state starts as `null`:**
  ```ts
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  ```
  SSR renders `year = null` → "©  SOUM DECO". Client hydrates `year = 2025` → "© 2025 SOUM DECO". With `suppressHydrationWarning` on L111, the mismatch is suppressed. OK, handled.

**Minor:**
- L111 — `suppressHydrationWarning` on the year `<p>`. Correct usage.

---

### 26. `src/components/site/cod-order-form.tsx` (940 lines)

**Critical:**
- **L280-284 — `no-cors` fetch returns opaque response, success assumed:**
  ```ts
  try {
    await fetch(orderUrl, {
      method: "GET",
      mode: "no-cors",
      redirect: "follow",
    });
  } catch {
    // fallback to /api/order
  }
  ```
  With `mode: "no-cors"`, the response is opaque — you can NEVER check if it succeeded. The code immediately proceeds to show the thank-you screen (L316-330). If the Apps Script was down, the URL was malformed, or the network dropped, the order is **silently lost**. The customer sees "شكراً لك من كلّ قلبنا!" but the order never reached the sheet.

- **L286-310 — Fallback to `/api/order` also masks failures:** The API route returns `ok: true` even on failure (see issue #13). And the catch at L307 swallows all errors. So even the fallback path can't detect failure.

- **L258 — Hardcoded sheet URL in component:**
  ```ts
  const sheetUrl = process.env.NEXT_PUBLIC_SHEET_URL || "https://script.google.com/macros/s/AKfycbx.../exec";
  ```
  Duplicates the URL from `sheet.ts`. If one is updated and the other isn't, orders go to the wrong script.

- **L260-273 — URL length risk:** All fields are truncated, but URL-encoded Arabic chars expand 1→3. The base Apps Script URL is ~100 chars. With 12 params, some containing Arabic (wilaya, deliveryLabel, notes), the total URL could approach 2000+ chars. Browsers may truncate or reject. No total length check.

**Medium:**
- **L90-92 — `useEffect` resets items on `initialItems` change:**
  ```ts
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);
  ```
  `initialItems` is a new array reference on every parent render. If the parent re-renders during form interaction (e.g., from `cleared` state change in checkout-modal), the form's internal `items` state resets, losing the user's quantity selection. **Latent bug** — currently doesn't manifest because the parent doesn't re-render during form use, but fragile.
- **L195 — Phone validation strips non-digits:** `PHONE_REGEX.test(form.phone.replace(/\D/g, ""))`. But the API route doesn't strip non-digits. Inconsistent.
- **L213-354 — `handleSubmit` catch block shows thank-you screen:** Even on unhandled exception, the customer sees success. Order is lost.
- **L46-49 — `generateOrderRef` is client-side random:** The reference `SD-123456` is shown to the customer but NOT sent to the sheet. The sheet generates its own row number. The customer's reference doesn't match anything the admin can look up.
- **L328 — `new Date().toLocaleString("fr-FR")`:** Locale-dependent. On SSR, this could produce a different format than client. Since this is in the thank-you screen (client-only), OK.
- **No double-submit guard beyond `disabled={submitting}`:** The button is disabled during submit. But if the user double-clicks before `setSubmitting(true)` takes effect, two submits fire. React batches state updates, so the second click might see `submitting = false` still. Minor race.

**Minor:**
- L60 — `useState<OrderItem[]>(initialItems)` — initial state from props. OK.
- L66 — Default company is `"zr_express"`. OK.

---

### 27. `src/components/site/product-image.tsx`

**Medium:**
- **L36-44 — `optimizeImageUrl` skips transformation if ANY of c_limit/q_auto/f_auto present:**
  ```ts
  if (!src.includes("c_limit") && !src.includes("q_auto") && !src.includes("f_auto")) {
    return src.replace("/image/upload/", "/image/upload/c_limit,w_800,q_auto,f_auto/");
  }
  ```
  If a URL has `q_auto` but not `c_limit`, it skips the `c_limit` addition. The image could be served at full resolution. Edge case — most Cloudinary URLs either have all or none.
- **No `onError` fallback:** If a Cloudinary URL 404s (image deleted), Next.js Image shows a broken image. No fallback placeholder.

**Minor:**
- L59 — `unoptimized = isDataUrl || isExternalUrl` — skips Next.js optimizer for external URLs. Correct for Cloudinary (which does its own optimization).
- L80 — `sizes` attribute is set. Good for LCP.

---

### 28. `src/components/site/category-icon.tsx`

**Minor:**
- L10-20 — Arabic normalization is duplicated from `use-stock.ts:64-75` and `category-anim.ts`. DRY violation.
- L188 — `key.includes("اكسسوارات")` is duplicated (also on L187). Copy-paste error.
- L302-320 — `key === "lit"` plus `key.includes("lit ")` plus `key.includes("lit-")` — fragile matching. Could miss "lit," or "lit:".

---

### 29. `src/components/site/free-shipping-section.tsx`

**This file is dead code.** It exports `SpecialOffersSection` and `FreeShippingSection`, but `page.tsx` imports `SpecialOffersSection` from `special-offers-section.tsx` (a different file). No file imports from `free-shipping-section.tsx`.

**Medium:**
- Confusing duplicate exports. Should be deleted to avoid maintenance confusion.

---

### 30. `next.config.ts`

**Critical:**
- **L6 — `ignoreBuildErrors: true`:**
  ```ts
  typescript: {
    ignoreBuildErrors: true,
  },
  ```
  TypeScript errors don't block the build. Broken code can ship to production. For a "bulletproof" e-commerce site, this should be `false`.

**Medium:**
- **L8 — `reactStrictMode: false`:**
  StrictMode helps catch bugs in development (double-rendering, missing cleanups, stale state). Disabling it means these bugs won't be caught.

**Minor:**
- L10-12 — `images.unoptimized: true` — correct for Cloudflare Pages (no image optimizer).

---

### 31. `wrangler.toml`

**Medium:**
- **L6 — `pages_build_output_dir = ".vercel/output/static"`:** This is the old Vercel output directory. Cloudflare Pages with `@cloudflare/next-on-pages` typically uses `.vercel/output/static`. But if the build process changes (e.g., Next.js 16's new output), this could break. Verify the build actually produces this directory.

**Minor:**
- L3 — `compatibility_flags = ["nodejs_compat"]` — needed for some Node.js APIs on edge. OK.

---

### 32. `src/app/globals.css`

**No critical issues found.** The CSS is a standard Tailwind v4 setup with custom theme variables. The color palette is well-organized. The `dark` class duplicates `:root` values (L167-200), which is intentional ("Site is light by default — kept identical for compat").

**Minor:**
- The file is 1161 lines. Could be split into `theme.css`, `components.css`, `animations.css` for maintainability. Not a bug.

---

## Cross-Cutting Concerns

### A. No Error Boundary (P0)

There is **no React Error Boundary** anywhere in the app. If ANY component throws during render (e.g., `featured-carousel.tsx:53` when `current` is undefined, or a malformed product triggers a crash in `product-card.tsx`), the entire app white-screens.

**Fix:** Add a top-level Error Boundary in `layout.tsx` or `page.tsx`:
```tsx
// src/components/site/error-boundary.tsx
"use client";
import React from "react";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <div>
            <h1 className="font-arabic text-2xl font-bold text-charcoal">حدث خطأ غير متوقع</h1>
            <p className="mt-2 font-arabic text-sm text-gray">يرجى تحديث الصفحة</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-full bg-emerald px-6 py-2 font-arabic text-sm font-semibold text-night"
            >
              تحديث
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### B. No `app/error.tsx` or `app/not-found.tsx`

Next.js 16 App Router supports `error.tsx` and `not-found.tsx` files for route-level error handling. None exist. Adding them would catch server-side errors and 404s.

### C. localStorage Fragility

Multiple components read/write localStorage with try/catch that swallows errors:
- `use-cart.ts:22-31` — cart load
- `use-cart.ts:34-41` — cart persist
- `products.ts:996-1005` — catalog save
- `products.ts:881-898` — catalog load
- `admin-panel.tsx:122-126` — sessionStorage

If localStorage is full, disabled, or corrupted, the app silently falls back to seed/empty state. No user feedback. For a "bulletproof" site, consider:
1. A `useLocalStorage` hook with error reporting
2. Quota monitoring (e.g., `navigator.storage.estimate()`)
3. Graceful degradation toasts

### D. Network Error Handling

All network calls (`clientListProducts`, `clientGetStockCsv`, `clientUpsertProduct`, `clientDeleteProduct`, `clientUploadImage`, `sheetSubmitOrder`) catch errors and return empty/false/base64. No retry, no user feedback, no error state. The app appears to work but data is stale or missing.

**Recommendation:** Add a centralized fetch wrapper with:
1. Configurable timeout (`AbortController`)
2. Exponential backoff retry (3 attempts)
3. Error toast on final failure
4. Loading/error state surfaced to UI

### E. Hydration Safety

- `site-footer.tsx:9-10` — `year` starts as `null`, set in `useEffect`. `suppressHydrationWarning` on the `<p>`. OK.
- `layout.tsx:77` — `suppressHydrationWarning` on `<html>` and `<head>`. OK.
- `use-catalog.ts:38` — `products` starts as `[]` on both server and client. OK.
- `use-cart.ts:18` — `items` starts as `[]` on both server and client. OK.
- `use-stock.ts:81` — `stockMap` starts as `{}` on both server and client. OK.

**No hydration mismatches found.** Good.

### F. Memory Leaks

- `use-catalog.ts:142-179` — interval cleared on unmount. OK.
- `use-stock.ts:109-129` — interval cleared on unmount. OK.
- `featured-carousel.tsx:35-45` — interval cleared on unmount. OK.
- `all-products.tsx:212-218` — resize listener removed on unmount. OK.
- `page.tsx:52-57` — scroll listener removed on unmount. OK.
- `checkout-modal.tsx:23-35` — keydown listener removed on unmount. OK.
- `product-page.tsx:62-68` — keydown listener removed on unmount. OK.

**No memory leaks found.** Good.

### G. Race Conditions

- `use-catalog.ts:305-364` — `moveProduct` fires 2 parallel POSTs. Apps Script may not handle concurrent writes. Last-write-wins could lose one update.
- `use-catalog.ts:184-250` — `upsertProduct` optimistic update + async POST. If user clicks Save twice rapidly, two POSTs fire. The second could overwrite the first.
- `cod-order-form.tsx:213-354` — `handleSubmit` has `disabled={submitting}` guard, but React batched state updates mean the second click might see `submitting = false`. Minor race.
- `featured-carousel.tsx:47-49` — index reset effect runs AFTER render. One render with out-of-bounds index → crash. (See P0 issue #2.)

---

## Priority Ranking

### P0 — Critical (will break functionality or lose data)

1. **No Error Boundary** — any render throw → white screen
2. **`featured-carousel.tsx:53`** — crash when `products` shrinks (undefined access)
3. **`cod-order-form.tsx:280-284`** — orders silently lost (`no-cors` opaque response)
4. **`client-sheet.ts:159` / `drive-upload.ts:41`** — image upload failure → base64 → sheet overflow → silent product save failure
5. **`admin-panel.tsx:952-956`** — Save not awaited, no failure feedback, double-click parallel uploads
6. **`use-catalog.ts:238-242`** — optimistic update not rolled back on failure (localStorage diverges from sheet)
7. **`api/order/route.ts:53-58, 63-67`** — returns `ok: true` on failure, orders silently dropped
8. **`next.config.ts:6`** — `ignoreBuildErrors: true` ships broken code to production

### P1 — High (edge case failures, data inconsistency)

9. **`cart-bar.tsx:99`** — React key collision (latent, activates if variantKey is wired)
10. **`use-cart.ts:69-105`** — `updateQuantity`/`removeItem` only affect first matching item
11. **`layout.tsx:80-81`** — dead preloads hit broken API (500 responses wasted)
12. **`admin-panel.tsx:48-114`** — no max file size check, browser can freeze
13. **`use-catalog.ts:253-269`** — failed delete not rolled back
14. **`use-catalog.ts:333-360`** — parallel POSTs for reorder, errors swallowed
15. **`cod-order-form.tsx:90-92`** — `useEffect` resets items on parent re-render (latent)
16. **`all-products.tsx:54`** — sort order DESCENDING contradicts admin's ASCENDING
17. **`cart-bar.tsx:55-58`** — null-price items show "0 دج" total, NaN not guarded
18. **`use-algeria-data.ts:26-49`** — no error handling, empty wilayas blocks checkout

### P2 — Medium (UX issues, perf, code quality)

19. **`use-stock.ts:132-159`** — O(n×m) linear scan per product, should pre-normalize map
20. **`page.tsx:158-169`** — `validProducts`, `featured`, `allProductsList` not memoized
21. **`admin-panel.tsx:292-297, 319-354`** — variant/tier editors use global index as React key
22. **`admin-panel.tsx`** — no sync status indicator (user doesn't know if save is in flight)
23. **`product-page.tsx:136-145`** — `handleAdd` doesn't pass variantKey to cart
24. **`cod-order-form.tsx:258`** — hardcoded sheet URL duplicates `sheet.ts`
25. **`cod-order-form.tss:46-49`** — order ref is client-side random, not in sheet
26. **`client-sheet.ts:174-189`** — sequential image uploads (slow)
27. **All fetch calls** — no timeout, no retry
28. **`layout.tsx:77`** — `lang="fr" dir="ltr"` but content is Arabic (accessibility)
29. **`free-shipping-section.tsx`** — dead code, confusing duplicate exports
30. **`api/products/route.ts:17`** — imports SEED_PRODUCTS from different module than `use-catalog.ts`
31. **`formatPrice`** — doesn't guard against NaN → "NaN دج"
32. **`site-menu.tsx:36-42`** — handleNav fails silently on product page (no target sections)

### P3 — Minor (nice-to-have improvements)

33. **`category-icon.tsx:10-20`** — duplicated Arabic normalization
34. **`use-catalog.ts:82`** — `saveCatalog` on every poll (jank on slow devices)
35. **`admin-panel.tsx:965`** — `window.confirm` is ugly, no undo
36. **`use-stock.ts:77-78`** — stale comment about polling interval
37. **`admin-panel.tsx:207`** — MAX_PHOTOS = 8 but comment says 5
38. **`product-image.tsx`** — no onError fallback for broken images
39. **No cross-tab cart sync** (storage event listener)
40. **`sheet.ts:8-9`** — hardcoded URL in source (maintenance hazard)

---

## Recommended Immediate Fixes (P0)

### Fix 1: Add Error Boundary

Create `src/components/site/error-boundary.tsx` and wrap `page.tsx`'s return:
```tsx
<ErrorBoundary>
  {/* existing content */}
</ErrorBoundary>
```

### Fix 2: Guard featured-carousel against undefined

```tsx
// featured-carousel.tsx line 53
const current = products[index] ?? products[0];
if (!current) return null;
```

### Fix 3: Don't use no-cors for orders

Switch to the API route as primary (with proper error reporting) or use a different Apps Script pattern that returns CORS headers. At minimum, add a fallback that stores the order in localStorage if both fetches fail, and retries on next visit.

### Fix 4: Validate image upload success

```ts
// client-sheet.ts
if (!res.ok) {
  console.error("[clientUploadImage] Cloudinary rejected:", res.status);
  return ""; // empty string instead of base64
}
```
Then in `use-catalog.ts:218`, check if any URL is empty before saving.

### Fix 5: Await admin Save and show feedback

```tsx
// admin-panel.tsx
const handleSave = async (p: Product) => {
  setSaving(true);
  try {
    await onUpsert(p);  // now async
    setEditing(null);
    toast.success("تم حفظ المنتج");
  } catch {
    toast.error("فشل الحفظ. تحقق من الاتصال.");
  } finally {
    setSaving(false);
  }
};
```

### Fix 6: Rollback on failure

```ts
// use-catalog.ts upsertProduct
const previousProducts = productsRef.current;
setProducts(/* optimistic */);
const ok = await clientUpsertProduct(sheetProduct);
if (!ok) {
  setProducts(previousProducts);  // rollback
  saveCatalog(previousProducts);
  throw new Error("Sheet sync failed");
}
```

### Fix 7: Remove dead preloads

```tsx
// layout.tsx — remove these lines
<link rel="preload" as="fetch" href="/api/products" crossOrigin="anonymous" />
<link rel="preload" as="fetch" href="/api/stock" crossOrigin="anonymous" />
```

### Fix 8: Enable TypeScript build checks

```ts
// next.config.ts
typescript: {
  ignoreBuildErrors: false,
},
```

---

## Conclusion

The site is functionally working but has several **P0 issues that can cause white screens, silent data loss, and confused admin workflows**. The most urgent fixes are:

1. **Error Boundary** (prevents white screens)
2. **Featured carousel undefined guard** (prevents crash on catalog refresh)
3. **Order submission reliability** (no-cors masks failures)
4. **Image upload validation** (base64 fallback corrupts the sheet)
5. **Admin Save feedback** (no error visibility, double-click races)

The architecture's shift to direct-to-Apps-Script (bypassing Cloudflare edge) is sound, but the dead API routes and preloads should be cleaned up. The localStorage-based cart and catalog are fragile but acceptable for a client-only architecture.

With the P0 fixes applied, the site would be significantly more robust. The P1 and P2 issues should be addressed in a follow-up pass.
