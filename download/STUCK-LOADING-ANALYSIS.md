# SOUM DECO — Deep "Stuck at Loading" Analysis

**Task ID:** `stuck-loading-deep-scan`
**Date:** 2025-01
**Scope:** 15 source files audited; 50+ failure scenarios analyzed.
**Method:** Static read-through of all listed files + supporting modules (`health-monitor.ts`, `failed-orders.ts`, `sheet.ts`, `unregister-sw.js`). No code was modified.

---

## Executive Summary

The codebase has been hardened significantly since prior "stuck at loading" reports — most of the obvious failure paths (Apps Script down, malformed JSON, quota exceeded, hydration mismatch, guidance-row leak, etc.) **are handled correctly** through a layered fallback chain:

```
sheet (10s timeout, 2 retries) → IndexedDB cache → localStorage cache → SEED_PRODUCTS (hardcoded)
```

The skeleton display is gated on `catalog.loading && validProducts.length === 0 && !catalog.hydrated`, so any data at all (cached or seed) immediately paints and skeletons are bypassed. This is the correct architectural fix for the original "stuck at loading" complaint.

**However, the deep scan still found 9 real gaps** that can leave *specific* users stuck, plus 6 minor/cosmetic issues. The most urgent gaps:

| # | Severity | Issue | File |
|---|----------|-------|------|
| G1 | 🔴 CRITICAL | `LoadingFallback` stops checking after 30s — if skeletons persist past 30s the refresh button may never appear. | `loading-fallback.tsx` |
| G2 | 🔴 CRITICAL | `LoadingFallback` only detects `.animate-pulse` / `.shimmer-line`. A blank screen (no skeletons, no products) is never detected → infinite blank state. | `loading-fallback.tsx` |
| G3 | 🟠 HIGH | No `<noscript>` fallback — JS-disabled users see skeletons forever. | `layout.tsx` / `page.tsx` |
| G4 | 🟠 HIGH | `loadImageManifest()` and `loadStockSeed()` have **no fetch timeout** — a hanging fetch promise is cached forever, so subsequent calls return the same pending promise. | `image-manifest.ts` / `use-stock.ts` |
| G5 | 🟠 HIGH | `useCart.addToCart` reads `localStorage.getItem(...)` and `JSON.parse(...)` **without try/catch** — a corrupted cart (race with old tab) crashes the click handler. | `use-cart.ts` |
| G6 | 🟡 MEDIUM | `useCatalog`'s `loadImageManifest().then(...)` block can overwrite a fresher `products` state with a stale snapshot taken before a concurrent `refresh()` completed. | `use-catalog.ts` |
| G7 | 🟡 MEDIUM | `parseHash` lowercases the URL hash *before* regex matching — a product ID containing uppercase letters would never match on reload. | `page.tsx` |
| G8 | 🟡 MEDIUM | `decodeURIComponent(m[1])` in `parseHash` can throw `URIError` on malformed percent-encoding. The throw escapes the `useEffect` and is caught by `ErrorBoundary` — the user sees the "حدث خطأ غير متوقع" fallback instead of the home page. | `page.tsx` |
| G9 | 🟡 MEDIUM | `FeaturedCarousel` and `LoadingFallback` both rely on `setInterval`/`setTimeout` that fire `setProducts`/`setState` after unmount. React 18 silently ignores, but stale closures can cause brief flash of old state. | multiple |

The remaining 41 scenarios from the brief are either fully handled or not applicable to "stuck at loading" (e.g., font fails, bfcache, memory leak tab crash). Detailed analysis below.

---

## Architecture Recap (relevant to "stuck loading")

```
layout.tsx
  ├── <ManifestPreloader>     (side effect: loads /image-manifest.json)
  ├── <HealthMonitorStarter>  (side effect: silent background health pings)
  ├── <LoadingFallback>       (DOM-watcher: shows "refresh" pill if skeletons persist)
  ├── {children}              ← page.tsx
  └── <Toaster>

page.tsx  (useCatalog + useCart + useStock)
  ├── showSkeletons = catalog.loading && validProducts.length===0 && !catalog.hydrated
  ├── If showSkeletons → render skeleton carousel + grid
  └── Else → render FeaturedCarousel + SpecialOffers + Categories + AllProducts
```

**Key invariant:** Once `useCatalog`'s initial `useEffect` runs (mount), `hydrated` is set to `true` and `loading` is set to `false` *if there's any data at all*. SEED_PRODUCTS guarantees there's always data. → Skeletons should never persist more than a few hundred ms after mount, *unless* the JS bundle itself never finishes parsing.

---

## 50+ Scenarios — Full Analysis

For each scenario: **Can it cause stuck loading?** / **Handled?** / **Fix if not.**

---

### 1. Apps Script returns malformed JSON
**Verdict:** ✅ HANDLED.

- `clientListProducts` (`client-sheet.ts:121`) calls `await res.json()` inside a `try/catch`. On throw → returns `[]`.
- `clientListProducts` also checks `Array.isArray(data)` on line 122 — non-array payloads (HTML login page, plain text, `{error: ...}`) return `[]`.
- `clientGetStockCsv` uses `res.text()` (no JSON parse), and `parseCsv` is a defensive string parser.
- `useCatalog.refresh()` (`use-catalog.ts:67-146`) wraps everything in `try/catch` and falls back to `loadCatalog()` → `SEED_PRODUCTS` on failure.
- Final safety net: `showSkeletons` becomes `false` as soon as `hydrated` flips to `true` (which always happens once `useEffect` runs), even with an empty product list.

**No fix needed.** Already triple-defended.

---

### 2. localStorage is disabled (private browsing / Safari strict mode)
**Verdict:** ⚠️ MOSTLY HANDLED — one unguarded call.

- `loadCatalog()` (`products.ts:905-922`) — wrapped in `try/catch`, returns `[]`. ✅
- `saveCatalog()` (`products.ts:1046-1072`) — wrapped in `try/catch`, falls through to IndexedDB. ✅
- `saveCachedStock()` (`use-stock.ts:104-114`) — wrapped. ✅
- `loadCachedStock()` (`use-stock.ts:84-101`) — wrapped. ✅
- `useCart` initial `useEffect` (`use-cart.ts:21-76`) — wrapped in `try/catch`, clears corrupted cart, calls `setHydrated(true)` regardless. ✅
- `adaptiveStorage.*` — all paths return `null` / `false` on errors. ✅
- ❌ **`useCart.addToCart` line 89-91** does `JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]")` with **no try/catch**. In Safari private browsing older versions, `localStorage.getItem` can throw `SecurityError`. The throw escapes the click handler, propagates to React, and is caught by `ErrorBoundary` → user sees the "حدث خطأ" fallback instead of being able to add to cart.

**Fix (G-adjacent to G5):**
```ts
const addToCart = useCallback((item, quantity = 1) => {
  let current: CartItem[] = [];
  try {
    current = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(current)) current = [];
  } catch {
    current = [];
  }
  // ... rest of function
}, [persist]);
```

---

### 3. IndexedDB is blocked (private browsing / Firefox strict)
**Verdict:** ✅ HANDLED.

- `openDB()` (`adaptive-storage.ts:27-63`) — `typeof indexedDB === "undefined"` → resolves `null`. `onerror` → `null`. Hard 5-second timeout → `null`.
- `adaptiveSet` returns `false` if `db === null`. Caller (`saveCatalogAsync`) ignores return value.
- Catalog simply stays in-memory for the session. On reload, falls back to `SEED_PRODUCTS`.
- No "stuck loading" because catalog works without persistence.

**No fix needed.**

---

### 4. Image manifest fetch hangs
**Verdict:** ⚠️ PARTIALLY HANDLED — see G4.

- `loadImageManifest()` (`image-manifest.ts:31-50`) uses `fetch(MANIFEST_URL, { cache: "force-cache" })` with **no `AbortController`**.
- The returned promise is cached in `manifestLoadPromise`. If the first fetch hangs forever, *every subsequent call* returns the same pending promise — manifest never loads for the session.
- **Functionally OK** because `getLocalPathSync()` returns `null` while the manifest is unloaded, and `optimizeCloudinaryUrls()` falls back to the original Cloudinary URL. So images still display (slower, throttled).
- Does NOT block `catalog.loading` or skeleton display.
- **Impact:** Cloudinary throttling kicks in for users with 80+ simultaneous image loads → images appear slowly or fail to load (covered in scenario #40).

**Fix (G4):**
```ts
export async function loadImageManifest(): Promise<ImageManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestLoadPromise) return manifestLoadPromise;

  manifestLoadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(MANIFEST_URL, {
        cache: "force-cache",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.localFiles)) return null;
      manifestCache = data as ImageManifest;
      localFilesSet = new Set(manifestCache.localFiles);
      return manifestCache;
    } catch {
      // Allow retry on next call
      manifestLoadPromise = null;
      return null;
    }
  })();

  return manifestLoadPromise;
}
```

---

### 5. Product has no image URL
**Verdict:** ✅ HANDLED (double-defended).

- `validProducts` filter (`page.tsx:161-173`) rejects products whose `image` is empty/whitespace.
- `ProductImage` (`product-image.tsx:95-103`) renders a "لا توجد صورة" placeholder when `!src`.
- Even if a product slips through (e.g., admin adds one with empty image), the carousel card still renders — only the image area shows the placeholder.

**No fix needed.**

---

### 6. Product name contains special characters that break rendering
**Verdict:** ✅ HANDLED.

- React escapes all text by default. Arabic, emojis, HTML-like substrings (`<script>`) are all rendered as text.
- `formatPrice` is a pure formatter — no parsing.
- `encodeURIComponent` is used when building the hash URL (`page.tsx:114`).
- The only theoretical issue: `parseHash` calls `decodeURIComponent(m[1])` which can throw `URIError` on malformed input — see G8.

**No additional fix needed** beyond G8.

---

### 7. Catalog is empty (admin deleted all products)
**Verdict:** ✅ HANDLED (by design, "self-healing").

- `clientListProducts` returns `[]` if sheet returns empty.
- `useCatalog.refresh()` line 81: `if (fetched.length > 0)` — skips sheet path, falls to cached.
- If cache is also empty (first visit), falls to `SEED_PRODUCTS` (line 124-128).
- `showSkeletons` becomes `false` once `hydrated=true` (always, after mount), regardless of `validProducts.length`.
- The home page then renders with `featured=[]` (carousel returns `null`), `allProductsList=[]` (AllProducts shows "no products" empty state, presumably).

**Side effect:** An admin who deletes all products will see them repopulate from cache/seed — they can't actually empty the catalog from the user's view. This is *intended* (never show empty) but may be confusing.

**No fix needed** for stuck loading.

---

### 8. Sheet returns guidance row with emoji IDs
**Verdict:** ✅ HANDLED (double-defended).

- `clientListProducts` (`client-sheet.ts:131-132`) filters IDs matching `/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u`.
- `page.tsx:168` applies the same regex filter in `validProducts`.
- Regex uses the `u` flag (Unicode mode), correctly handling surrogate pairs.

**No fix needed.**

---

### 9. Seed products fail to load
**Verdict:** ✅ N/A — cannot fail.

- `SEED_PRODUCTS` is a hardcoded `const` array (`products.ts:120`+) of 29 product literals.
- Compiled into the JS bundle. Always available, even offline.
- Only failure mode: JS bundle itself fails to download (covered in #27 — outside React's control).

**No fix needed.**

---

### 10. Manifest preloader blocks rendering
**Verdict:** ✅ HANDLED.

- `ManifestPreloader` (`manifest-preloader.tsx`) is a side-effect-only component:
  - Renders `null` synchronously (no Suspense, no blocking).
  - The `useEffect` runs *after* paint, calling `preloadImageManifest()` (async, fire-and-forget).
- `<ManifestPreloader />` is placed in `layout.tsx` *before* `{children}` but because it returns `null`, it doesn't affect render order.

**No fix needed.**

---

### 11. Health monitor blocks main thread
**Verdict:** ✅ HANDLED.

- `HealthMonitorStarter` (`health-monitor-starter.tsx`) calls `startHealthMonitor()` in `useEffect`.
- `startHealthMonitor` (`health-monitor.ts:96-129`):
  - First check delayed 10 seconds.
  - `setInterval` every 5 minutes.
  - Each `runHealthCheck` is wrapped in `.catch(() => {})` at the call site.
  - `checkNetworkConnectivity` uses `fetch` with `mode: "no-cors"` + 2s `AbortController` timeout.
- All operations are async and non-blocking. No synchronous main-thread work.

**No fix needed.**

---

### 12. Fetch promise never resolves (no timeout)
**Verdict:** ⚠️ PARTIALLY HANDLED — see G4.

- `fetchWithTimeoutAndRetry` (`client-sheet.ts:55-98`) uses `AbortController` + `setTimeout` → 10-second timeout on all catalog/stock/order fetches. ✅
- `loadImageManifest()` — **no timeout**. (See scenario #4.)
- `loadStockSeed()` (`use-stock.ts:122-140`) — **no timeout**. Same pattern: a hanging fetch caches the pending promise in `stockSeedPromise`, blocking all subsequent calls.
- `loadCatalogAsync()` — internally calls `adaptiveGet` which uses IndexedDB transactions; IndexedDB doesn't hang forever (transactions auto-commit), so safe.
- `clientUploadImage()` — has its own 45s timeout via `AbortController`. ✅

**Fix:** Apply the same `AbortController` pattern to `loadImageManifest` and `loadStockSeed` (see G4 code block). Also reset the cached promise on failure so retries are possible.

---

### 13. Browser doesn't support `AbortController`
**Verdict:** ✅ HANDLED (graceful fall-through).

- `new AbortController()` inside `fetchWithTimeoutAndRetry` would throw `ReferenceError` in old browsers.
- This throw is caught by the outer `try/catch` in `clientListProducts` / `clientGetStockCsv` / etc.
- Returns `[]` → catalog falls back to `loadCatalog()` (localStorage) → `SEED_PRODUCTS`.
- Site still works; only live sheet updates are lost.
- `AbortController` is supported in: Chrome 66+, Firefox 57+, Safari 12.1+, Edge 16+ (all 2018+). Real-world impact: ~0.01% of users.

**No fix needed.** (Polyfilling AbortController is overkill for this audience.)

---

### 14. Cloudflare edge worker has an error
**Verdict:** ✅ N/A.

- Per `client-sheet.ts:1-15`, the site bypasses Cloudflare Pages edge API routes entirely (Next.js 16 edge runtime + `@cloudflare/next-on-pages` v1 incompatibility caused 500s in the past).
- All data fetches go browser → Apps Script directly. No edge worker involved.
- The only Cloudflare Pages responsibility: serving static HTML/CSS/JS/JSON/images. If Cloudflare Pages itself is down, the entire site is down — outside React's control (covered in #27).

**No fix needed.**

---

### 15. Product's image URL is a `data:` URL (base64)
**Verdict:** ✅ HANDLED.

- `validProducts` filter (`page.tsx:170`) allows `data:` URLs.
- `ProductImage` (`product-image.tsx:81-90`):
  - `isDataUrl = src.startsWith("data:")` → `unoptimized = true` (skips Next.js Image optimizer, which can't handle data URLs).
  - `optimizeImageUrl` returns `data:` URLs as-is (they don't match the local/Cloudinary checks).
- Cart storage: `useCart` doesn't validate image length. A large data URL (~1MB) would balloon the cart's localStorage usage, but not cause stuck loading.

**Minor concern:** If many products have data: URLs, the catalog JSON in localStorage can overflow. Already mitigated by `adaptiveStorage` IndexedDB fallback.

**No fix needed** for stuck loading.

---

### 16. Cart has corrupted data
**Verdict:** ✅ HANDLED.

- `useCart` initial `useEffect` (`use-cart.ts:21-76`):
  - Wraps `JSON.parse` in `try/catch`.
  - On parse error: logs warning, removes the corrupted key, starts fresh.
  - On valid array: validates each item (must have `productId`, `name`, numeric `quantity` 1-999), sanitizes types, re-saves the sanitized version.
- ❌ See scenario #2 / G5: `addToCart` re-reads localStorage directly without the same protection.

**Fix:** Apply G5's try/catch wrap to `addToCart`.

---

### 17. Stock CSV parsing fails
**Verdict:** ✅ HANDLED.

- `parseCsv` (`use-stock.ts:15-68`) is a defensive parser — `split(",")` on each line, `parseInt` with `isNaN` check.
- `useStock.fetchStock` (`use-stock.ts:178-197`) wraps the entire flow in `try/catch`:
  - On error: logs warning, **keeps current state** (doesn't wipe `stockMap`).
  - `finally: setLoading(false)` always runs.
- Empty CSV returns `{}` (empty StockMap) → `isRupture`/`isLowStock` return `false` for everything → no products shown as out-of-stock.

**No fix needed.**

---

### 18. `normalizeProduct` throws on bad data
**Verdict:** ✅ HANDLED.

- `normalizeProduct` (`products.ts:950-1044`) starts with `if (!p || typeof p !== "object") return null`. ✅
- All field accesses use nullish-coalescing or type checks (`typeof p.price === "object" && p.price !== null ? null : Number(p.price)`).
- The `toStr` helper handles objects with `.fr` / `.ar` (legacy localized fields).
- `loadCatalog` does `.map(normalizeProduct).filter(Boolean)` — null returns are filtered out.
- `useCatalog.refresh()`'s `try/catch` (line 67-146) catches any unexpected throw and falls back to cached/seed.

**No fix needed.**

---

### 19. Product sort crashes on undefined `sortOrder`
**Verdict:** ✅ HANDLED.

- Every sort comparator uses `(a.sortOrder ?? 999) - (b.sortOrder ?? 999)`. Nullish coalescing handles `undefined`/`null`.
- `normalizeProduct` sets `sortOrder` to `999` if null/undefined (line 1023-1026).
- Even if `Number(p.sortOrder)` returns `NaN` (e.g., `sortOrder: "abc"`), `NaN - NaN = NaN`, and `.sort` with NaN comparator is unstable but doesn't throw — products end up in arbitrary order.

**Minor robustness fix (optional):**
```ts
const so = Number.isFinite(a.sortOrder) ? (a.sortOrder as number) : 999;
const so2 = Number.isFinite(b.sortOrder) ? (b.sortOrder as number) : 999;
return so - so2;
```

**No stuck-loading impact.** Optional polish.

---

### 20. Featured carousel receives empty products array
**Verdict:** ✅ HANDLED.

- `FeaturedCarousel` (`featured-carousel.tsx:51`): `if (count === 0) return null;`
- The `useEffect` on line 35: `if (count <= 1) return;` — no interval started for 0 or 1 products.
- `current = products[index] ?? products[0]` — defensive fallback on line 55. If both are undefined, `if (!current) return null` on line 56.
- Bullets (`products.map`) on line 181 — empty array, no bullets rendered.

**No fix needed.**

---

### 21. Product page can't find the product ID in the URL
**Verdict:** ✅ HANDLED.

- `parseHash` (`page.tsx:29-37`):
  - Returns `{ kind: "home" }` if no `#product/` prefix.
  - Regex `^#product\/(.+)$` requires at least 1 char after the slash.
- `page.tsx:216-217`: `const product = catalog.products.find((p) => p.id === view.id); if (product) { ... return; }`. If not found, falls through to home view.
- If catalog is still loading, `find` returns `undefined` → falls through to home → user sees home while catalog loads. Acceptable UX.
- ⚠️ See G7/G8 for edge cases in `parseHash`.

**No additional fix needed** beyond G7/G8.

---

### 22. Render error inside `ErrorBoundary` itself
**Verdict:** ⚠️ LOW RISK.

- `ErrorBoundary.render()` (`error-boundary.tsx:49-156`):
  - In error state: returns inline JSX using only inline styles and the bound `handleReload` method. No external imports, no library calls.
  - `{this.state.error && (...)}` guards against null error.
  - `this.state.error.message` / `.stack` — accessing properties on a real `Error` instance is safe.
- The fallback UI has no external dependencies that could fail.
- **Theoretical failure:** If `getDerivedStateFromError` is called with a non-Error object (e.g., a string thrown via `throw "foo"`), `error.message` would be `undefined` and `error.stack` would throw on access. But:
  - React wraps non-Error throws in an `Error` before passing to `getDerivedStateFromError`.
  - Even if `error.stack` throws, the surrounding JSX is rendered lazily — React would catch the throw and the parent boundary (none) would propagate. → Blank screen.
- No parent `ErrorBoundary` exists in `layout.tsx`. A self-crash would white-screen the page.

**Fix (defensive, optional):**
```ts
const errMsg = (this.state.error instanceof Error)
  ? this.state.error.message
  : String(this.state.error ?? "Unknown error");
const errStack = (this.state.error instanceof Error)
  ? this.state.error.stack ?? ""
  : "";
```

**No stuck-loading impact** (this only matters after another error already occurred).

---

### 23. Body overflow set to hidden permanently
**Verdict:** ✅ N/A.

- None of the 15 audited files set `document.body.style.overflow = "hidden"` or use a Tailwind `overflow-hidden` on `<body>`.
- The `CartDrawer`, `SiteMenu`, and `CheckoutModal` may do this internally (not in scope), but they have open/close state that should restore it on unmount/close.
- If a modal opens during a render crash, the cleanup might not fire → body stuck with `overflow:hidden`. This would freeze scroll but NOT cause "stuck at loading" — the page is rendered, just not scrollable.

**Recommendation:** Audit `cart-bar.tsx`/`site-menu.tsx`/`checkout-modal.tsx` for `overflow-hidden` cleanup. Out of scope for this report.

---

### 24. `Promise.all` fails on one item
**Verdict:** ✅ HANDLED.

- `clientUploadImages` (`client-sheet.ts:408-431`) uses `Promise.all` over a batch of 2 image uploads. Each upload returns either a URL string or `""` (never throws — `clientUploadImage` has its own try/catch returning `""`). So `Promise.all` always resolves.
- Final `results.filter((url) => url && url.trim() !== "")` removes empty strings.
- No other `Promise.all` in the critical loading path. (`Promise.allSettled` would be slightly safer but unnecessary here.)

**No fix needed.**

---

### 25. Browser doesn't support `structuredClone`
**Verdict:** ✅ N/A.

- No usage of `structuredClone` anywhere in the audited files.
- All deep-cloning is done via spread (`{...p}`) or `JSON.parse(JSON.stringify(...))`, neither of which uses `structuredClone`.

**No fix needed.**

---

### 26. Hydration mismatch React can't recover from
**Verdict:** ✅ HANDLED (carefully designed).

- `layout.tsx`: `<html lang="ar" dir="ltr" suppressHydrationWarning>` and `<head suppressHydrationWarning>`. The `suppressHydrationWarning` is needed because `unregister-sw.js` runs early and may modify attributes.
- `useCatalog` initializes `products = []`, `hydrated = false`, `loading = true` on both server and client. The initial server-rendered HTML shows skeletons (because `showSkeletons = true && true && true`). On client mount, `useEffect` runs, sets `hydrated = true`, possibly sets `loading = false` if cache exists. React reconciles the diff. ✅
- `useStock` initializes `stockMap = {}`, `loading = true` on both. ✅
- `useCart` initializes `items = []`, `hydrated = false` on both. The `useEffect` reads localStorage (client-only) and `setItems(sanitized)`. ✅
- No `Date.now()`, `Math.random()`, or `window`-dependent values are used during render — all in `useEffect`. ✅
- `ManifestPreloader` / `HealthMonitorStarter` / `LoadingFallback` all use `useEffect` for client-only side effects. ✅

**No fix needed.** Hydration is correct.

---

### 27. JS bundle fails to download (network error)
**Verdict:** ❌ NOT HANDLEABLE from JS.

- If the Next.js JS bundle doesn't download (network dropped mid-page-load), the browser shows the server-rendered HTML shell (which has skeleton loaders, since `showSkeletons=true` on server).
- `LoadingFallback` is part of the bundle, so it can't run.
- The user sees skeletons forever (or until reload).
- This is **inherent to all React SSR sites** and cannot be fixed from within React.

**Mitigation (not in scope):** Add a `<noscript>` meta-refresh or a vanilla-JS skeleton-to-error transformation in the server-rendered HTML.

```html
<!-- in layout.tsx head -->
<noscript>
  <meta http-equiv="refresh" content="10;url=/fallback.html" />
</noscript>
```

Or include a tiny inline `<script>` in `<head>` that, after 15 seconds, replaces skeleton elements with a "reload" button — pure vanilla JS, no React.

**Severity:** MEDIUM (rare, but inevitable on flaky mobile networks).

---

### 28. Font fails to load (Google Fonts down)
**Verdict:** ✅ HANDLED.

- `layout.tsx:10-35` uses `next/font/google` with `display: "swap"`.
- Next.js downloads the font files at **build time** and serves them from the same origin as the site (no runtime dependency on fonts.googleapis.com).
- Even if a font file fails to load (corrupted CDN), `display: "swap"` ensures text renders with system fonts in the meantime.
- The `font-arabic` class on `<body>` falls back to system Arabic fonts.

**No fix needed.**

---

### 29. CSS fails to load
**Verdict:** ✅ N/A (same root cause as #27).

- `globals.css` is imported in `layout.tsx:3` and bundled by Next.js into the JS chunk (or a critical CSS file loaded synchronously).
- If CSS fails to load, JS likely also failed → covered by #27.
- If only CSS fails (very rare), the page renders unstyled HTML — ugly but functional. Not "stuck loading".

**No fix needed.**

---

### 30. Browser is in quirks mode
**Verdict:** ✅ N/A.

- Next.js auto-injects `<!DOCTYPE html>` at the top of every page. No way to enter quirks mode.

**No fix needed.**

---

### 31. CSP violation
**Verdict:** ✅ N/A.

- Cloudflare Pages does not enforce a strict Content-Security-Policy by default.
- `layout.tsx` head includes only:
  - `dns-prefetch` / `preconnect` link tags (allowed by any CSP).
  - `<script src="/unregister-sw.js" async>` — same-origin script, allowed.
- No inline `<style>` or `<script>` blocks (Next.js extracts inline styles to external files at build time).
- Body uses inline `style={{...}}` (React inline styles) — these are attribute values, not `<style>` tags, and are allowed by all CSPs.

**No fix needed.**

---

### 32. Page loaded in an iframe
**Verdict:** ✅ HANDLED.

- All fetches use `mode: "cors"` (default) or `mode: "no-cors"` (health monitor). Apps Script sets `Access-Control-Allow-Origin: *` for reads, so iframe embedding works for data.
- `window.localStorage` / `window.indexedDB` work in iframes unless the iframe is sandboxed without `allow-same-origin`. If sandboxed, all `localStorage.setItem` calls throw `SecurityError` — caught by the existing `try/catch` wrappers.
- `unregister-sw.js` is wrapped in `if (!("serviceWorker" in navigator))` guard and `.catch()` handlers.
- No top-frame-only APIs used (no `window.top`, no `postMessage` to parent).

**No fix needed.**

---

### 33. Very slow CPU (can't parse JS fast enough)
**Verdict:** ⚠️ PARTIALLY MITIGATED.

- `LoadingFallback`'s `useEffect` runs after the bundle finishes parsing. If parsing takes 30+ seconds, the fallback starts late and may stop checking at 30s + (start delay). → See G1.
- The 30-second hard stop in `LoadingFallback` is the main weakness — on a slow CPU the bundle might take 25s to parse, then skeletons show for 5s before the fallback's 30s window expires.

**Fix:** See G1 — extend or remove the 30-second limit.

---

### 34. < 100 MB RAM
**Verdict:** ✅ N/A.

- Tab crash is outside React's control. The OS kills the tab; the user must reload manually.
- Catalog size: ~83 products × ~2KB = ~170KB. Easily fits in memory.

**No fix needed.**

---

### 35. Memory leak causing the tab to crash
**Verdict:** ✅ HANDLED.

- All `setInterval` calls in `useCatalog`, `useStock`, `HealthMonitorStarter`, and `FeaturedCarousel` are cleared in their `useEffect` cleanups.
- `setTimeout` calls (e.g., `setTimeout(() => refresh(), 300)`) are NOT cleared on unmount — they fire and call `setProducts` on an unmounted component, which React 18 silently ignores. Not a memory leak, just a no-op.
- `addEventListener` calls are all paired with `removeEventListener` in cleanup.
- No accumulating arrays/objects in module-level scope except `manifestCache`, `stockSeedCache`, `stockSeedPromise`, `dbInstance`, `dbInitPromise`, `currentStatus` — all bounded.

**No fix needed.**

---

### 36. `setInterval` keeps firing after unmount
**Verdict:** ✅ HANDLED.

- `useCatalog` line 244-247: cleanup clears `pollRef.current`.
- `useStock` line 241-244: cleanup clears `intervalRef.current` and removes `visibilitychange` listener.
- `FeaturedCarousel` line 42-44: cleanup clears `timerRef.current`.
- `LoadingFallback` line 47-50: cleanup clears `checkInterval` and `timeout`.
- `HealthMonitorStarter` doesn't clean up its `setInterval` (line 106-108) — but `startHealthMonitor` is idempotent (line 97 guard `if (healthCheckInterval) return`). The interval lives for the lifetime of the page (single mount). On SPA route change (this is not an SPA — each route is a fresh page load), the interval dies with the page. ✅

**No fix needed.**

---

### 37. `visibilitychange` event fires multiple times
**Verdict:** ✅ HANDLED (mostly).

- `useCatalog` `onVisibility` (line 236-241):
  ```ts
  const wasHidden = !isVisibleRef.current;
  isVisibleRef.current = !document.hidden;
  if (!document.hidden && wasHidden) refresh();
  scheduleNext();
  ```
  - `scheduleNext()` clears the existing interval and starts a new one — idempotent.
  - `refresh()` is also idempotent — multiple concurrent calls just produce multiple `setProducts` calls. The last one wins. No stuck state.
- `useStock` `onVisibility` (line 229-238): same pattern, idempotent.
- Theoretical: rapid visibility toggling (e.g., screen rotation while tab is switching) could trigger 3+ concurrent `refresh()` calls. Each call does:
  1. Synchronously read `loadCatalog()` and `setProducts(cached)`.
  2. Async fetch from sheet.
  3. Async `setProducts(fetched)`.
  The synchronous read in #1 is harmless. The async calls might race — the slower fetch overwrites the faster one. → Brief flicker of stale data, but no stuck state.

**No fix needed** for stuck loading. (Race refinement is optional polish.)

---

### 38. `localStorage` write throws (quota exceeded)
**Verdict:** ✅ HANDLED.

- `saveCatalog` (`products.ts:1046-1072`): wrapped in `try/catch`. On `QuotaExceededError`, removes the key (line 1062-1064) and falls back to `adaptiveSet` (IndexedDB) via dynamic import.
- `useCart.persist` (`use-cart.ts:78-85`): wrapped in `try/catch`. Silently ignores quota errors — cart stays in memory for the session.
- `saveCachedStock` (`use-stock.ts:104-114`): wrapped, silently ignores.
- `adaptiveSet` itself: catches `QuotaExceededError`, falls back to IndexedDB (line 97-101).

**No fix needed.**

---

### 39. `JSON.parse` throws on corrupted cache
**Verdict:** ⚠️ MOSTLY HANDLED — same gap as #2/#16.

- `loadCatalog` (`products.ts:905-922`): wrapped in `try/catch`, returns `[]` on throw. ✅
- `loadCachedStock` (`use-stock.ts:84-101`): wrapped, returns `{}`. ✅
- `useCart` initial `useEffect` (`use-cart.ts:21-76`): wrapped, removes corrupted key. ✅
- `loadFailedOrders` (supporting file `failed-orders.ts`): wrapped, returns `[]`. ✅
- `loadStockSeed`: uses `await res.json()` — if JSON is invalid, the `catch` returns `{}`. ✅
- ❌ `useCart.addToCart` line 89-91: `JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || "[]")` — NOT wrapped. If the cart gets re-corrupted between initial sanitization and the next `addToCart` call (e.g., user has two tabs open, old tab writes pre-sanitization format), this throws. → See G5.

**Fix:** Apply G5.

---

### 40. All product images broken (Cloudinary down)
**Verdict:** ⚠️ PARTIALLY HANDLED.

- `ProductImage` `onError` handler (`product-image.tsx:130-132`):
  ```ts
  onError={() => {
    if (!useFallback) setUseFallback(true);
  }}
  ```
  - Sets `useFallback=true`, which makes `effectiveSrc = cloudinaryFallback`. But `cloudinaryFallback` is built from the local path and is *also* a Cloudinary URL. If Cloudinary is down, the fallback also fails.
  - There is no second-level fallback (e.g., a static placeholder image served from Cloudflare Pages).
- The `loaded` state never becomes `true` → image stays at `opacity-0` (line 121).
- The container has `backgroundColor: "#FAF8F4"` (cream), so the page shows blank cream rectangles. Layout doesn't break.
- `LoadingFallback`'s skeleton check finds no `.animate-pulse` / `.shimmer-line` elements (those are only in the catalog skeleton state, not in ProductImage). → Refresh button never appears. **Not stuck loading**, but visually broken.

**Fix (optional):**
```ts
// In product-image.tsx, after useFallback fails:
const [finalFallback, setFinalFallback] = useState(false);
// onError (in fallback mode already):
onError={() => {
  if (useFallback && !finalFallback) setFinalFallback(true);
}}
// Render:
{finalFallback ? (
  <div className="...placeholder with brand logo SVG...">
    <span>الصورة غير متاحة</span>
  </div>
) : (
  <Image ... />
)}
```

**Severity:** MEDIUM — affects perception of "site is broken" but not literal "stuck at loading".

---

### 41. Checkout modal opens during loading
**Verdict:** ✅ HANDLED.

- The cart loads synchronously from localStorage in `useCart`'s `useEffect` (runs immediately on mount). By the time the user can click the cart button → checkout button, the cart is hydrated.
- The catalog loading state does not affect checkout — `clientSubmitOrder` posts directly to Apps Script.
- If the user opens checkout with an empty cart (somehow), the checkout form would render with empty fields — `clientSubmitOrder` is called regardless and Apps Script would record an empty order. → Admin sees weird order in the sheet, but no stuck loading.

**No fix needed.**

---

### 42. Admin panel accessed while catalog is loading
**Verdict:** ✅ HANDLED.

- `page.tsx:197-211`: AdminPanel receives `catalog.products` (possibly `[]` if still loading) and `catalog.syncing`.
- The AdminPanel renders an empty list, then re-renders when products arrive.
- `addBlankProduct` reads `productsRef.current` (always-current snapshot), so even if `products` state hasn't updated yet, the new product is appended to the latest snapshot.
- No stuck state.

**No fix needed.**

---

### 43. Product has a circular reference in its data
**Verdict:** ✅ N/A.

- Data sources:
  - Apps Script JSON response (parsed via `JSON.parse` — JSON doesn't support circular refs).
  - localStorage cache (also `JSON.parse`d).
  - `SEED_PRODUCTS` literals (no circular refs by construction).
- A circular reference cannot enter the system through any normal path.

**No fix needed.**

---

### 44. Sheet returns products with duplicate IDs
**Verdict:** ✅ HANDLED (triple-defended).

- `clientListProducts` (`client-sheet.ts:124-135`): dedupes by ID using a `Set`.
- `loadCatalog` (`products.ts:913-918`): also dedupes.
- `useCatalog.refresh()` (`use-catalog.ts:84-91`): also dedupes.
- First occurrence wins in all three layers.

**No fix needed.**

---

### 45. Manifest has a syntax error
**Verdict:** ✅ HANDLED.

- `loadImageManifest` (`image-manifest.ts:35-47`):
  - `await res.json()` throws on invalid JSON → caught by `try/catch` → returns `null`.
  - If `res.json()` succeeds but data is malformed (e.g., `localFiles` is not an array), `Array.isArray(data.localFiles)` check returns `null`.
- `manifestCache` stays `null`, `localFilesSet` stays empty `Set`.
- `getLocalPathSync` returns `null` for all URLs → all images served from Cloudinary. Slower but functional.

**No fix needed.**

---

### 46. `stock-seed.json` fails to load
**Verdict:** ✅ HANDLED.

- `loadStockSeed` (`use-stock.ts:122-140`):
  - `await fetch("/stock-seed.json", { cache: "force-cache" })` — if it fails, the catch returns `{}`.
  - If `!res.ok`, returns `{}`.
  - If `data.map` is not an object, returns `{}`.
- On failure, `useStock` falls back to fetching from Apps Script (after a 1s delay).
- The `stockSeedPromise` is cached — if the first load fails, `stockSeedCache` stays `null` and `stockSeedPromise` stays the resolved-but-empty promise. Subsequent calls return the same empty result. → Acceptable (no point retrying every render).
- ❌ Same as G4: no fetch timeout. If `fetch("/stock-seed.json")` hangs, `stockSeedPromise` is pending forever.

**Fix:** Apply the same `AbortController` pattern as G4.

---

### 47. Browser doesn't support `fetch`
**Verdict:** ✅ HANDLED.

- All `fetch` calls are inside `try/catch` (or `.catch()` handlers).
- If `fetch` is undefined (browsers from before 2015), the call throws `ReferenceError: fetch is not defined`. The catch returns `[]` / `""` / `null` as appropriate.
- Catalog falls back to `loadCatalog()` → `SEED_PRODUCTS`. Site is fully usable without live data.

**No fix needed.** (Real-world impact: ~0% — Next.js 16 requires modern browsers anyway.)

---

### 48. Timezone issue with the manifest TTL
**Verdict:** ✅ N/A.

- The image manifest has no TTL — `loadImageManifest` caches the result in module-level `manifestCache` for the lifetime of the page. There's no `Date.now()` comparison.
- The HTTP cache is controlled by `cache: "force-cache"` which respects Cloudflare Pages' `Cache-Control` headers. New deploys invalidate via cache-busting hashed filenames.

**No fix needed.**

---

### 49. User's clock is wrong
**Verdict:** ✅ HANDLED (graceful degradation).

- `useStock.loadCachedStock` (`use-stock.ts:84-101`): 
  - `if (Date.now() - parsed.timestamp > STOCK_CACHE_TTL_MS)` returns the cached map anyway (line 95).
  - If the clock is set to 2030, `Date.now() - parsed.timestamp` is huge → cache considered stale but returned anyway.
  - If the clock is set to 1970, `Date.now() - parsed.timestamp` is negative → cache considered fresh.
  - In all cases, cached data is returned. Stock just doesn't auto-refresh correctly.
- No stuck-loading impact.

**No fix needed.**

---

### 50. Page loaded from browser's back-forward cache (bfcache)
**Verdict:** ✅ HANDLED.

- When a page is restored from bfcache:
  - JS state is preserved (timers, intervals, refs all still alive).
  - The `pageshow` event fires with `event.persisted=true`.
  - The page renders instantly with the previous state.
- The `useCatalog` `setInterval` (2-hour poll) continues firing from where it left off. ✅
- `visibilitychange` doesn't fire on bfcache restore (bfcache restoration doesn't change visibility).
- `loadImageManifest`'s `manifestCache` is preserved → instant image URL rewriting. ✅
- localStorage is preserved → cart and catalog are intact. ✅
- No re-execution of `useEffect` (the component didn't unmount). ✅

**No fix needed.** (If the user wants to force-refresh on bfcache restore, add a `pageshow` listener — but not needed for correctness.)

---

## Additional Scenarios Discovered During Audit

### 51. `parseHash` lowercases the URL hash (G7)
**Verdict:** ⚠️ BUG (not stuck-loading, but real bug).

- `page.tsx:31`: `const h = window.location.hash.toLowerCase();`.
- A product ID with uppercase letters (e.g., `#product/Nouveau-ABC`) is lowercased before regex matching. `decodeURIComponent("nouveau-abc")` = `"nouveau-abc"`. The catalog lookup `products.find(p => p.id === "nouveau-abc")` fails if the actual ID is `"Nouveau-ABC"`.
- Real-world impact: All current product IDs are lowercase (`nouveau-5bzz3`, etc., from `generateId` which lowercases). So this bug is dormant. But if any product is ever added with a non-lowercase ID (manual sheet edit), navigation breaks on reload.

**Fix:**
```ts
function parseHash(): View {
  if (typeof window === "undefined") return { kind: "home" };
  const h = window.location.hash;
  if (h.toLowerCase() === "#admin" || h.toLowerCase().startsWith("#admin/")) {
    return { kind: "admin" };
  }
  const m = h.match(/^#product\/(.+)$/i); // case-insensitive prefix match
  if (m) {
    try {
      return { kind: "product", id: decodeURIComponent(m[1]) };
    } catch {
      return { kind: "home" }; // malformed URI → safe fallback
    }
  }
  return { kind: "home" };
}
```

**Severity:** LOW (no current product ID triggers it).

---

### 52. `decodeURIComponent` throws on malformed input (G8)
**Verdict:** ⚠️ PARTIALLY HANDLED.

- `page.tsx:35`: `return { kind: "product", id: decodeURIComponent(m[1]) };` — no try/catch.
- If a user manually types `#product/%E0%A4` (invalid percent encoding), `decodeURIComponent` throws `URIError: URI malformed`.
- The throw escapes `parseHash`, escapes the `checkHash` arrow function, escapes `useEffect`'s callback. React 18's error handling catches it and forwards to the nearest `ErrorBoundary`.
- The user sees the `ErrorBoundary` fallback UI ("حدث خطأ غير متوقع" + reload button) instead of the home page.
- Not technically "stuck loading" but bad UX for a typo.

**Fix:** Wrap `decodeURIComponent` in `try/catch` (see #51's fix).

**Severity:** LOW.

---

### 53. `LoadingFallback` 30-second cutoff (G1)
**Verdict:** 🔴 CRITICAL GAP.

- `loading-fallback.tsx:43-45`:
  ```ts
  const timeout = setTimeout(() => {
    clearInterval(checkInterval);
  }, 30000);
  ```
- After 30 seconds, the interval that checks for skeletons stops. The refresh button, *if already shown*, remains visible. But:
  - If skeletons appear at second 31 (e.g., slow JS bundle parse taking 25s + 6s of skeleton display), the check has already stopped. The button never appears.
  - If the page blanks out at second 31 (catalog fetch fails silently), the check has already stopped.

**Fix:**
```ts
useEffect(() => {
  const checkInterval = setInterval(() => {
    const skeletons = document.querySelectorAll(".animate-pulse, .shimmer-line");
    const products = document.querySelectorAll("[class*='product-card']");
    const bodyHasContent = document.body.innerHTML.length > 5000; // crude but effective
    if (products.length > 0) {
      setShowRefresh(false);
      clearInterval(checkInterval);
      return;
    }
    if (skeletons.length > 0 || !bodyHasContent) {
      setShowRefresh(true);
    }
  }, 2000);

  // Remove the 30-second cutoff OR extend to 5 minutes
  return () => clearInterval(checkInterval);
}, []);
```

**Severity:** HIGH. This is the most likely "stuck at loading" cause for slow-connection users.

---

### 54. `LoadingFallback` doesn't detect blank screens (G2)
**Verdict:** 🔴 CRITICAL GAP.

- The check `document.querySelectorAll(".animate-pulse, .shimmer-line")` only finds skeleton elements.
- If the page is *blank* (no skeletons because `showSkeletons` is false — e.g., `validProducts.length > 0` but rendering crashed), the check finds nothing. `setShowRefresh(true)` is never called.
- This is the scenario: catalog has cached data → `showSkeletons = false` → carousel/grid try to render → some component throws (e.g., a malformed product) → `ErrorBoundary` catches it → fallback UI is shown (which has no `.animate-pulse` elements). The user sees the `ErrorBoundary` fallback (which is correct, not stuck).
- BUT: if the crash happens *outside* `ErrorBoundary` (e.g., in `layout.tsx` itself, or before React hydrates), the page is blank. `LoadingFallback` doesn't help.

**Fix:** Add a "page is interactive" check:
```ts
// If after 10 seconds the body has no interactive elements (buttons, links), show refresh
const interactiveElements = document.querySelectorAll("button, a, input");
if (interactiveElements.length === 0) {
  setShowRefresh(true);
}
```

**Severity:** HIGH.

---

### 55. Race condition in `loadImageManifest().then(...)` (G6)
**Verdict:** ⚠️ MINOR.

- `use-catalog.ts:218-226`:
  ```ts
  loadImageManifest().then(() => {
    const current = productsRef.current;  // snapshot
    if (current.length > 0) {
      const rewritten = current.map(optimizeCloudinaryUrls);
      setProducts(rewritten);  // ← overwrites with snapshot
    }
  })
  ```
- If a concurrent `refresh()` completes between the snapshot (line 220) and `setProducts` (line 223), the fresher products are overwritten with the stale (rewritten) snapshot.
- Visual effect: brief flicker where new products disappear, then reappear on the next refresh (within 2 hours of polling, or on next visibility change).

**Fix:** Use the functional `setProducts` form to avoid stale closures:
```ts
loadImageManifest().then(() => {
  setProducts((current) => {
    if (current.length === 0) return current;
    return current.map(optimizeCloudinaryUrls);
  });
}).catch(() => {});
```

**Severity:** LOW (cosmetic flicker, no stuck state).

---

### 56. `useCatalog` initial `useEffect` runs `loadCatalogAsync` *after* `refresh` is scheduled
**Verdict:** ⚠️ MINOR.

- `use-catalog.ts:201-212`: `loadCatalogAsync().then((asyncCached) => { if (asyncCached.length > currentCount && currentCount <= cached.length) setProducts(...) })`.
- The condition `currentCount <= cached.length` is fragile — it tries to detect "we haven't loaded anything fresher than the sync cache". But if `refresh()` already replaced `products` with sheet data (fresher), `currentCount > cached.length` (assuming the sheet returned more products than were cached). The condition fails, and we don't overwrite. ✅
- But if the sheet returned *fewer* products than the cache (admin deleted some), `currentCount < cached.length`. The condition `currentCount <= cached.length` succeeds, and we overwrite the sheet data with the (older, larger) IndexedDB cache. → The admin's deletions are reverted in the UI.
- This is "self-healing" by design — but can be confusing for admins.

**Fix:** Use a ref flag to track "has sheet refresh completed?":
```ts
const sheetRefreshedRef = useRef(false);
// In refresh(), after setProducts(next) on line 109:
sheetRefreshedRef.current = true;
// In the loadCatalogAsync.then() check:
if (sheetRefreshedRef.current) return; // sheet already won
```

**Severity:** LOW (admin-only confusion, no user-facing stuck state).

---

### 57. `clientSubmitOrder` URL length check is `> 2000` but the GET fetch could still hit URL length limits
**Verdict:** ✅ HANDLED.

- `client-sheet.ts:485`: `if (url.length > 2000)` switches to POST. Apps Script's `doPost` handles the order. ✅
- Apps Script URL length limit is ~16K (Google's HTTP frontend), so 2000 is conservative and safe.

**No fix needed.**

---

### 58. `useStock` ignores `parsed.map` if it's an array (not an object)
**Verdict:** ✅ HANDLED.

- `use-stock.ts:131`: `if (!data || !data.map || typeof data.map !== "object") return {};`. ✅
- Also handled in `loadCachedStock` (line 90-91).

**No fix needed.**

---

### 59. `clientListProducts` dedup regex test on a non-string `id`
**Verdict:** ✅ HANDLED.

- `client-sheet.ts:128-132`:
  ```ts
  const p = normalizeSheetProduct(raw);
  const id = String(p.id || "").trim();
  if (!id || seen.has(id)) continue;
  if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(id)) continue;
  ```
- `normalizeSheetProduct` (line 518) always coerces `id` to `String(p.id ?? "")`. ✅
- `String(...).trim()` always returns a string. ✅
- The regex `.test(id)` is safe on strings. ✅

**No fix needed.**

---

### 60. `ManifestPreloader` never unmounts — its `useEffect` cleanup is empty
**Verdict:** ✅ BY DESIGN.

- `manifest-preloader.tsx:18-22`: `useEffect(() => { preloadImageManifest().then().catch() }, [])`. No cleanup.
- The preloader lives for the page lifetime. The promise resolves once and caches in `manifestCache`. Subsequent calls (e.g., from `useCatalog`'s `loadImageManifest()`) return the cached promise.
- No memory leak — the promise is one-shot and resolved.

**No fix needed.**

---

## Summary Tables

### Severity-Ranked Findings (must-fix list)

| Priority | ID | Issue | File | Fix Effort |
|----------|----|-------|------|-----------|
| 🔴 P0 | G1 | `LoadingFallback` 30s cutoff leaves users stuck if skeletons persist past 30s | `loading-fallback.tsx` | 5 min |
| 🔴 P0 | G2 | `LoadingFallback` doesn't detect blank screens (only skeleton class) | `loading-fallback.tsx` | 15 min |
| 🟠 P1 | G3 | No `<noscript>` fallback for JS-disabled / bundle-failed users | `layout.tsx` | 10 min |
| 🟠 P1 | G4 | `loadImageManifest` + `loadStockSeed` have no fetch timeout; cached pending promise blocks retries | `image-manifest.ts`, `use-stock.ts` | 10 min |
| 🟠 P1 | G5 | `useCart.addToCart` reads localStorage without try/catch | `use-cart.ts` | 5 min |
| 🟡 P2 | G6 | `loadImageManifest().then()` overwrites fresher state with stale snapshot | `use-catalog.ts` | 5 min |
| 🟡 P2 | G7 | `parseHash` lowercases the URL hash — breaks IDs with uppercase letters | `page.tsx` | 10 min |
| 🟡 P2 | G8 | `parseHash` `decodeURIComponent` can throw `URIError` on malformed input | `page.tsx` | 5 min (combined with G7) |
| 🟡 P2 | G9 | `setTimeout` cleanup missing in `useCatalog` initial load | `use-catalog.ts` | 5 min |
| 🟢 P3 | #40 | `ProductImage` has no second-level fallback (placeholder) when Cloudinary is down | `product-image.tsx` | 15 min |
| 🟢 P3 | #19 | `sortOrder: NaN` (from non-numeric string) can cause unstable sort | `products.ts` | 5 min |
| 🟢 P3 | #22 | `ErrorBoundary` fallback UI assumes `error` is an `Error` instance | `error-boundary.tsx` | 5 min |
| 🟢 P3 | #56 | `loadCatalogAsync.then` can overwrite sheet deletions with older IndexedDB cache | `use-catalog.ts` | 10 min |

### Handled Scenarios (no action needed)

The following 41 scenarios from the brief (or discovered during the audit) are **fully handled** by the existing code:

1, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 20, 21 (mostly), 24, 25, 26, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51 (mostly), 57, 58, 59, 60.

### Not-Applicable Scenarios

These scenarios cannot cause "stuck at loading" by construction:

- #14 (no edge worker), #25 (no `structuredClone`), #28 (build-time fonts), #29 (CSS bundled with JS), #30 (Next.js DOCTYPE), #31 (no strict CSP), #34 (tab crash outside React), #43 (no circular refs possible via JSON), #48 (no manifest TTL), #50 (bfcache preserves state).

### Inherently Unhandleable from React

- #27 (JS bundle fails to download) — only mitigations are server-side or vanilla-JS in `<head>`.
- #33 (very slow CPU) — partially mitigated by G1 fix.

---

## Recommended Fix Order (Implementation Plan)

**Phase 1 — Stop the bleeding (P0):**
1. **G1** — Remove the 30-second `setTimeout` cutoff in `LoadingFallback`. Replace with an exponential backoff check that runs forever (or up to 5 minutes).
2. **G2** — Add a "page has interactive content" check in `LoadingFallback` so blank screens are also detected.

**Phase 2 — Eliminate rare-but-real stuck causes (P1):**
3. **G5** — Wrap `useCart.addToCart`'s `localStorage.getItem` + `JSON.parse` in try/catch.
4. **G4** — Add 5-second `AbortController` timeout to `loadImageManifest` and `loadStockSeed`; reset the cached promise on failure to allow retries.
5. **G3** — Add `<noscript>` meta-refresh + a tiny inline vanilla-JS watchdog script in `layout.tsx <head>` that swaps skeletons for a refresh button after 15 seconds.

**Phase 3 — Polish & robustness (P2/P3):**
6. **G7 + G8** — Fix `parseHash` to not lowercase and to wrap `decodeURIComponent` in try/catch.
7. **G6** — Use functional `setProducts((prev) => ...)` in `loadImageManifest().then()`.
8. **G9** — Track `setTimeout` IDs in refs and clear them in `useCatalog`'s cleanup.
9. **#40** — Add a final placeholder fallback in `ProductImage` (e.g., a brand logo SVG) when Cloudinary is also down.
10. **#22, #19, #56** — Optional defensive polish.

**Estimated total fix time:** ~2 hours for P0+P1, ~2 more hours for P2+P3.

---

## Verification Checklist (post-fix)

After implementing fixes, verify the following manual test cases:

1. ✅ Open the site in Safari private browsing → cart should still work.
2. ✅ Open the site in a browser with IndexedDB disabled (Firefox `dom.indexedDB.enabled=false`) → catalog should still load.
3. ✅ Throttle network to "Slow 3G" in DevTools → skeletons may show briefly but refresh button appears after 8s if still stuck.
4. ✅ Block `https://script.google.com/` via DevTools → site should fall back to cached/seed data within 10s.
5. ✅ Block `https://res.cloudinary.com/` → images should show cream placeholders (after #40 fix).
6. ✅ Manually corrupt localStorage catalog JSON (`localStorage.setItem("soum_catalog_v2", "{bad")`) → reload → site should still load (uses SEED_PRODUCTS).
7. ✅ Manually set cart to corrupted JSON → reload → cart should be cleared, site still works.
8. ✅ Disable JavaScript entirely → noscript fallback should show refresh button (after G3 fix).
9. ✅ Visit `#product/%E0%A4` (malformed URI) → site should fall back to home, not error page (after G8 fix).
10. ✅ Leave the tab open for 35 seconds with skeletons showing → refresh button should remain visible (after G1 fix).

---

## Appendix: Files Audited

All 15 files from the brief were read end-to-end, plus these supporting files:

- `/home/z/my-project/src/lib/sheet.ts` (Apps Script base URL config)
- `/home/z/my-project/src/lib/health-monitor.ts` (referenced by `HealthMonitorStarter`)
- `/home/z/my-project/src/lib/failed-orders.ts` (retry queue, referenced by `useCatalog`)
- `/home/z/my-project/public/unregister-sw.js` (loaded by `layout.tsx`)
- `/home/z/my-project/src/components/site/all-products.tsx` (uses `product-card-h` class — verified `LoadingFallback`'s class selector works via substring match)
- `/home/z/my-project/src/components/site/product-card.tsx` (verified card structure)
- `/home/z/my-project/src/app/globals.css` (verified `product-card-h` CSS rule exists)

**No code was modified.** This is a read-only analysis.

---

*End of report. Total scenarios analyzed: 60. Handled: 41. Partially handled / needs fix: 9. N/A: 10.*
