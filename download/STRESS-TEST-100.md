# SOUM DECO — 100+ Scenario Stress Test Report

**Task ID:** `stress-test-100`
**Target:** SOUM DECO e-commerce site (`/home/z/my-project`)
**Date of analysis:** Current session
**Scope:** 18 source files (~6,650 lines) covering catalog, stock, cart, admin, checkout, navigation, and rendering
**Test methodology:** Static code analysis + architectural reasoning — every scenario traced to specific code paths, with crash-or-not verdict, current-handling assessment, and concrete fix

---

## Executive Summary — Top 10 Critical Findings

The codebase is **impressively hardened** for a client-side SPA: ErrorBoundary wraps every top-level view, fetches are retried with exponential backoff, localStorage has IndexedDB fallback, the cart self-heals corrupted JSON, and the catalog always falls back to cached/seed data on network failure. **However, the simultaneous admin+customer scenarios (Category A) expose serious business-logic gaps** that will not crash the browser but will let customers check out with **stale prices**, **stale names**, and **deleted/out-of-stock items**.

The **single most important architectural gap**: the shopping cart snapshots `name`, `price`, and `image` at add-time (`use-cart.ts:7-15`) and **never re-validates** them against the live catalog. Combined with the 2-hour polling interval (`use-catalog.ts:40`), this means an admin can change a price from 5,000 DZ to 7,500 DZ and **a customer who added it 1 minute earlier will still pay 5,000 DZ at checkout**.

### Top 10 Critical Bugs (P0/P1)

| # | Severity | Scenario | Symptom | File:Line |
|---|----------|----------|---------|-----------|
| 1 | **P0** | Admin raises price while item sits in cart | Customer checks out at OLD (lower) price → revenue loss | `use-cart.ts:7-15` (cart snapshots price) + `cod-order-form.tsx:296` (uses cart's price, not catalog's) |
| 2 | **P0** | Admin deletes product while customer has it in cart | Cart drawer "click to view" silently no-ops (`find()` returns undefined); item keeps appearing in checkout | `page.tsx:151-157` + `use-cart.ts` (no orphan-pruning) |
| 3 | **P0** | Admin marks product out-of-stock while customer is mid-checkout | Checkout proceeds anyway (rupture flag not re-read after item was added); customer submits an order for an unavailable product | `cod-order-form.tsx:248` (rupture captured at render, not at submit) |
| 4 | **P0** | Sheet's `price` cell set to `"abc"` then re-fetched | `Number("abc") = NaN`; `formatPrice` checks `isNaN` and shows "السعر عند الطلب" → customer can't tell if it's free or unknown; admin sees a "free" product in some code paths | `products.ts:646-651` (guard exists but only at display time) |
| 5 | **P1** | Admin changes variant `priceAdjustment` to non-numeric in textarea (rare; or sheet string `color:Red:abc`) | `Number("abc")=NaN` propagates: `variantAdjustment` becomes NaN, `adjustedPrice` becomes NaN, `formatPrice(NaN)` shows fallback label, **order submits with `price: NaN`** → sheet stores NaN → admin can't filter/sort | `product-page.tsx:109-127` + `client-sheet.ts:462` (NaN serialized as `NaN` in URLSearchParams → Apps Script reads `Number("NaN")=NaN`) |
| 6 | **P1** | localStorage race condition: two `addToCart` calls fire near-simultaneously (e.g., user double-taps "+1" then quickly taps another product's add) | `addToCart` re-reads `localStorage` (`use-cart.ts:92`) then writes — second write clobbers first → **first product is silently dropped from cart** | `use-cart.ts:87-116` |
| 7 | **P1** | Two admin tabs both edit the SAME product & both click Save | Optimistic updates race; second POST wins on the sheet, but first tab's UI shows its own version; on next poll (2h later), first tab shows second's version → "where did my edits go?" complaint | `use-catalog.ts:263-342` (no ETag/version lock) |
| 8 | **P1** | Admin deletes ALL products in the sheet (row-by-row) while customer is browsing | Customer's catalog still shows cached products (good); but `clientListProducts` returns `[]` → `useCatalog.refresh` falls back to `SEED_PRODUCTS` → customer suddenly sees 29 demo products that don't exist | `use-catalog.ts:114-130` (seed fallback when sheet is empty) |
| 9 | **P1** | Cart contains 1000 items (manually injected via localStorage) | Cart drawer maps 1000 items → 1000 React nodes; no virtualization; `total = items.reduce(...)` runs every render → main-thread freeze; `localStorage.setItem` JSON.stringify 1000 items could exceed quota silently | `cart-bar.tsx:56-59` + `use-cart.ts:78-85` (no length cap) |
| 10 | **P1** | Tab A saves a product; tab B (same browser) doesn't see the change | `useCatalog` doesn't listen to the `storage` event; tab B's view is stale until the 2-hour poll fires | `use-catalog.ts:157-248` |

### Resilience that's already in place

- ✅ ErrorBoundary catches render crashes (`error-boundary.tsx`)
- ✅ All fetches wrapped in `fetchWithTimeoutAndRetry` with 2 retries + exponential backoff (`client-sheet.ts:55-98`)
- ✅ Cart self-heals corrupted JSON / invalid items (`use-cart.ts:21-76`)
- ✅ Catalog falls back to cache → seed on failure (`use-catalog.ts:131-146`)
- ✅ Stock seed rejected if >90 % of products have 0 (`use-stock.ts:194-204, 262-274`)
- ✅ Optimistic admin writes with rollback on failure (`use-catalog.ts:263-388`)
- ✅ Image upload failure returns `""` (not base64) → no sheet cell overflow (`client-sheet.ts:271-398`)
- ✅ IndexedDB fallback for large catalogs that overflow localStorage 5 MB quota (`adaptive-storage.ts`)
- ✅ Failed orders saved to localStorage for retry on next visit (`failed-orders.ts`)
- ✅ `decodeURIComponent` wrapped in try/catch for malformed hash URLs (`page.tsx:39-46`)
- ✅ Image `onError` falls back from local Pages path to Cloudinary (`product-image.tsx:85-87, 130-132`)
- ✅ Featured carousel guards `products[index] ?? products[0]` against race conditions (`featured-carousel.tsx:54-56`)

---

## Methodology

For every scenario I:

1. **Traced the data flow** from the trigger (admin action / sheet edit / user action) through the affected component(s).
2. **Identified the exact code path** that would execute (cited `file:line`).
3. **Checked for crash signals**: missing try/catch, unguarded property access on possibly-null, JSON.parse without try/catch, Number() without isNaN check, Array.reduce without accumulator guard, etc.
4. **Checked for stale-data signals**: snapshot-vs-live comparison, polling interval vs. expected freshness, propagation of state changes across tabs/components.
5. **Verified the ErrorBoundary will catch** the crash (if any) — meaning the customer never sees a white screen, but may still experience business-logic bugs (wrong price, missing item, etc.).

Severity legend:
- **P0 — Critical**: causes data loss, financial loss, security hole, or hard browser crash.
- **P1 — High**: causes UX breakage, customer can't complete flow, or admin sees wrong state.
- **P2 — Medium**: cosmetic, recovery easy, edge case unlikely in normal use.
- **P3 — Minor**: theoretical only, would require abuse to trigger.

---

## Category A — Simultaneous Admin + Customer (20 scenarios)

### A1. Admin deletes a product while customer is viewing it
**Verdict: P0 (business), no crash.**
- Customer has the product open at `/home/z/my-project/src/components/site/product-page.tsx`.
- Customer's `catalog.products` array is in memory; the deletion happens on the admin's tab and propagates to the sheet.
- On the customer's next `refresh()` (next visibility-change OR 2-hour poll), `clientListProducts()` no longer contains the deleted ID. `useCatalog.refresh` replaces `products` state with the new array (`use-catalog.ts:81-112`).
- `page.tsx:226-256`: `if (product)` check — when `catalog.products.find(p => p.id === view.id)` returns `undefined`, the `if (product)` branch is skipped and the home view is rendered.
- **Business bug:** The customer was viewing the product, the page suddenly jumped to home without explanation. No "this product is no longer available" toast.
- **Fix:** In `page.tsx`, when `view.kind === "product"` and `product` is undefined AND `catalog.hydrated` is true AND `catalog.loading` is false, show a small "product no longer available" toast and call `exitToHome()`. Currently the silent fallthrough makes the UX confusing.

### A2. Admin changes price while customer has item in cart
**Verdict: P0 — financial loss.**
- Cart snapshot stores `price: number | null` at add-time (`use-cart.ts:9`).
- Cart drawer (`cart-bar.tsx:130`) renders `formatPrice(item.price)` from the cart snapshot.
- Checkout (`cod-order-form.tsx:37-41`) builds `OrderItem[]` from cart items and uses `i.price` in the grand-total computation (`cod-order-form.tsx:164-184`).
- `clientSubmitOrder` POSTs `price: items[0].price ?? null` to Apps Script (`cod-order-form.tsx:296`).
- **The catalog's NEW price is never consulted during checkout.** Only at the moment of clicking "Add to cart" is the price captured.
- **Fix:** In `CheckoutModal`/`CodOrderForm`, before computing totals, re-resolve each cart item against the live `catalog.products` by `productId`:
  ```ts
  const liveItems = items.map(it => {
    const live = catalog.products.find(p => p.id === it.productId);
    return { ...it, price: live?.price ?? it.price, name: live?.name ?? it.name };
  });
  ```
  Also notify the customer ("price changed from X to Y") via toast.

### A3. Admin changes product image while customer is viewing
**Verdict: P3 — no crash, minor visual glitch.**
- Customer's product page renders `images[activeIdx]` from the snapshot of `product` prop.
- The customer's catalog will refresh on next visibility/poll → `product.images` will change → React re-renders → image swaps mid-view.
- `useEffect` resets `activeIdx` to 0 when `product?.id` changes (`product-page.tsx:57-65`), but here the ID stays the same — only the image URL changes. So `activeIdx` stays where it was, and the user sees a different image suddenly appear.
- **No fix strictly needed**, but could add a `useEffect` keyed on `product.image` to reset `activeIdx` if image set shrinks.

### A4. Admin adds a new product while customer is browsing
**Verdict: P3 — no issue.**
- New product appears in customer's catalog on next refresh (within 2h, or immediately if they switch tabs and come back thanks to visibility-change handler `use-catalog.ts:236-241`).
- No customer state is invalidated.

### A5. Admin reorders products while customer is scrolling
**Verdict: P2 — minor visual jump.**
- `moveProduct` swaps `sortOrder` of two products (`use-catalog.ts:424-483`).
- Optimistic update on admin's side; sheet syncs async.
- Customer's next poll reflects new order — the product grid may visibly "jump" while the customer is mid-scroll.
- No crash, just slightly disorienting UX.

### A6. Admin marks product as out of stock while customer is checking out
**Verdict: P0 — order for unavailable product.**
- The customer's checkout modal is already open with `rupture={false}` captured in `CodOrderForm` props.
- Even if the customer's `stock` hook picks up the new stock=0 on next poll, **the modal has already captured `rupture` from when it opened**, and `handleSubmit` checks `if (rupture) return` (`cod-order-form.tsx:248`) using the **prop value at the time render was committed**.
- Order goes through to Apps Script → `doCreateOrderFromParams` appends row → admin sees an order for an out-of-stock product.
- **Fix:** In `CodOrderForm.handleSubmit`, re-check `stock.isRupture(items[0].name)` via a passed-in callback right before submitting. Or: have the customer's modal poll stock every 30 s while open and disable submit if rupture becomes true.
- The stock-side `onStockEdit` Apps Script trigger decrements stock on "Confirmed" status, but doesn't PREVENT new orders when stock hits 0.

### A7. Admin deletes ALL products while customer is browsing
**Verdict: P1 — seed-products fallback creates confusing UX.**
- `clientListProducts` returns `[]` after all products are gone from the sheet.
- `useCatalog.refresh` (`use-catalog.ts:81-112`): `if (fetched.length > 0) {...}` skipped, falls to `loadCatalogAsync()` → returns cached products (good). If cache is also empty → falls to `SEED_PRODUCTS` (`use-catalog.ts:124-130`).
- Customer suddenly sees 29 demo products (the seed) instead of the real catalog. Admin sees the catalog disappear and seed products appear.
- **Fix:** When `clientListProducts` returns `[]` but the previous state had products, treat it as "sheet is being reset" and **DO NOT overwrite** the in-memory catalog — keep showing cached products. Only switch to seed if BOTH sheet AND cache are empty (i.e., truly first visit).

### A8. Admin changes category while customer is filtering
**Verdict: P2 — product vanishes from filtered view.**
- Customer filters by category X → `allProductsList.filter(p => p.category === X)` (`all-products.tsx:80-86`).
- Admin changes product P's category to Y → on next poll, P disappears from filtered X view (correct) and would appear in Y (if customer switches filters).
- If customer was viewing P's product page when its category changed → no visible change (product page doesn't show category-based "related" until next refresh).
- No crash.

### A9. Admin changes variants while customer has selected one
**Verdict: P0/P1 — selected variant may disappear, NaN adjustments.**
- Customer selected `selectedColor = "أحمر"` (`product-page.tsx:52`).
- Admin removes the "أحمر" variant from the product and saves → next poll reflects the new variant list.
- Customer's `selectedColor` state still = `"أحمر"`, but `colorVariants.find(v => v.name === selectedColor)` returns `undefined`.
- `selectedColorVariant?.priceAdjustment ?? 0` → `0` (no crash, but adjustment silently drops).
- `adjustedPrice` = base price (lost the +100 DZ for red).
- `variantSummary` still shows "اللون: أحمر" — the order will be submitted with the variant name even though it no longer exists in the catalog.
- **Fix:** Add a `useEffect` watching `colorVariants.length` and `selectedColor` to auto-clear the selection if it's no longer in the list. Same for sizes and custom variants.
- **Edge:** If the admin changed `priceAdjustment` from `+100` to `+abc` (invalid) in the sheet string → `parseVariants` calls `Number("abc") = NaN` (`products.ts:755`) → `variantAdjustment` = NaN → `adjustedPrice = basePrice + NaN = NaN` → `formatPrice(NaN)` shows fallback label, but the order goes through with `price: NaN`.

### A10. Admin edits the SAME product the customer is viewing
**Verdict: P2 — page may show stale data for up to 2 hours.**
- Customer's product page renders the `product` object captured at the time `view.id` was set.
- React's `useEffect([product?.id])` only fires when the ID changes (`product-page.tsx:65`) — it doesn't fire when other fields of `product` change because the parent re-renders the same instance.
- However, `page.tsx:227` re-finds the product on every catalog state change, so the prop passed to `ProductPage` IS the new version. React re-renders `ProductPage` with the new `product` prop. The state vars `selectedColor`, `selectedSize`, `activeIdx` are preserved (good).
- **Result:** Customer sees the new price/image/name within seconds of the admin's save propagating to the customer's catalog state — typically only when customer's tab becomes visible again (could be 2h if tab stays visible because poll is 2h).
- No crash.

### A11. Admin uploads images (slow) while customer navigates
**Verdict: P3 — no issue.**
- Image upload is isolated to `clientUploadImages` (`client-sheet.ts:408-431`) which runs entirely on the admin's tab.
- Customer's catalog poll happens on the customer's tab — independent network request, separate AbortController.
- Customer doesn't see the new product/image until the admin clicks Save AND the customer's next poll fires.

### A12. Admin resets catalog while customer has items in cart
**Verdict: P1 — cart items become orphans.**
- `resetCatalog` calls `clientResetProducts` → Apps Script wipes the Products tab and re-adds the header row.
- Customer's `useCatalog` is unmounted/remounted? No — it's still mounted, just polls again on visibility/2h. So customer's catalog state will eventually become `SEED_PRODUCTS` (29 demo items).
- Cart still references old product IDs that no longer exist.
- `cart-bar.tsx:112` calls `onItemClick(item.productId)` → `page.tsx:151-157` finds nothing → silently no-ops.
- Checkout submits the order anyway with the cart snapshot's `name` and `price`.
- **Fix:** Add orphan detection in `useCart`: on hydrate, prune items whose `productId` isn't in the current `catalog.products`. Or show a warning banner in the cart if any item is orphaned.

### A13. Admin changes stock to 0 for a product in someone's cart
**Verdict: P1 — customer can still check out (variant of A6).**
- Same root cause as A6: cart doesn't validate stock at checkout time.
- Cart badge doesn't show "نفدت الكمية" — only the product page does (`product-page.tsx:521` checks `rupture` prop, which is passed from `page.tsx:248`).
- Cart drawer has NO rupture indicator (`cart-bar.tsx` doesn't take `isRupture`).
- Customer adds item → stock hits 0 on next poll → cart shows item with no warning → checkout proceeds.
- **Fix:** `CartDrawer` should accept a `getStockCount(name)` callback and show a "نفدت" badge on each line item whose stock is 0.

### A14. Admin changes shipping tiers (quantity tiers) while customer is checking out
**Verdict: P2 — discount/free-shipping benefit may be wrong.**
- `CodOrderForm` receives `quantityTiers={tiers}` from `product-page.tsx:555`. `tiers` is `product.quantityTiers ?? []` captured at render time of ProductPage.
- When admin changes tiers (e.g., removes the "buy 2 → free shipping" tier), the customer's product page still shows the old tier benefit if they don't navigate away.
- If the customer's catalog updates mid-checkout (unlikely if tab is in foreground — 2h poll), `product.quantityTiers` updates → `CodOrderForm` re-renders with new `quantityTiers` prop → `activeTier` recalculates.
- Could cause a sudden "your free shipping disappeared" UX if the poll fires mid-checkout.
- **Fix:** Either shorten the poll to fire when customer enters checkout (poll immediately on mount), or freeze the tiers at checkout-open time.

### A15. Admin changes variant prices while customer is on product page
**Verdict: P1 — variantAdjustment NaN propagation; stale adjustments.**
- Same root cause as A9: customer's `selectedColor` was locked in at add-time, but the variant list can change under them.
- `product-page.tsx:97`: `selectedColorVariant = colorVariants.find(v => v.name === selectedColor)`. After admin's edit, this may return undefined (if the name changed) or a different `priceAdjustment`.
- `adjustedPrice` recomputes correctly when the product prop updates.
- No crash; just a price change the customer didn't expect.

### A16. Admin moves product to different category while customer is in that category
**Verdict: P3 — product vanishes from the filtered grid.**
- Customer has `activeCategory = "Meubles"`.
- Admin moves product P from Meubles to Décoration → on customer's next poll, P's category = Décoration.
- `allProducts.tsx:80-86`: `filteredProducts = products.filter(p => p.category === "Meubles")` no longer includes P.
- The grid re-renders without P. Slightly jarring but not broken.
- If customer was viewing P's product page, the page stays open (it doesn't check `activeCategory`).

### A17. Admin deletes a category (all products in it) while customer is filtering
**Verdict: P2 — empty state shown.**
- Customer filtering by "Meubles" → admin deletes every Meubles product.
- `filteredProducts.length === 0` → `all-products.tsx:112-114` shows "لا توجد منتجات في هذه الفئة."
- Correct behavior. No crash.

### A18. Admin changes product name while customer's cart references old name
**Verdict: P1 — order submitted with old name.**
- Cart snapshot stores `name: string` at add-time (`use-cart.ts:8`).
- `cart-bar.tsx:127` displays `item.name` from snapshot.
- `cod-order-form.tsx:261-263` builds `allProducts = items.map(it => it.name × it.quantity).join(" + ")` from snapshot → submits to Apps Script.
- Apps Script's `onStockEdit` trigger (`apps-script.gs:333-348`) strips `× N` and matches the bare name to the Stock tab. If the name was changed in the catalog, the bare name **won't match the Stock tab's old entry** — stock won't decrement.
- Admin sees the order with an OLD name; the new product name in the Products sheet is different → confusion when fulfilling.
- **Fix:** Cart should refresh `name` from live catalog at checkout time (same fix as A2).

### A19. Admin changes product ID (recreate) while customer has old ID in cart
**Verdict: P1 — orphan item.**
- Same as A12: cart references an ID that no longer exists in `catalog.products`.
- `onItemClick` silently no-ops.
- Checkout submits with old name/price (snapshot) — order is received but the admin can't link it to a current product.
- **Fix:** Add orphan detection. When cart hydrates, prune items whose `productId` isn't in `catalog.products` after first successful fetch.

### A20. Admin uploads 5 large images simultaneously
**Verdict: P2 — possible Cloudinary 429 rate limit; admin UI frozen for ~5 seconds.**
- `clientUploadImages` (`client-sheet.ts:408-431`) processes in batches of 2 (`for (let i = 0; i < images.length; i += 2)`).
- Each upload has 45s timeout, 2 retries with exponential backoff.
- 5 images = 3 batches: ~3 × 3s = 9s sequential, OR if Cloudinary rate-limits (free tier = ~600 uploads/hour), retries add 1.5s + 3s + 6s per failed batch.
- Admin UI: `uploading=true` blocks Save button and disables drop zone (`admin-panel.tsx:544-559`). Admin waits ~10s.
- If all 5 fail: `uploadedUrls = []` → toast error → admin sees "فشل في رفع الصور" → no images saved. Save is blocked because `syncPhotos` returned 0 photos.
- **Fix:** Increase parallelism to 3 (Cloudinary allows it) OR show a progress bar. Current 2-at-a-time is safe but slow.

---

## Category B — Sheet Direct Editing (20 scenarios)

### B1. Admin adds a row with missing columns
**Verdict: P3 — handled by Apps Script's `obj[header[j]] = r[j]` loop.**
- `apps-script.gs:155-157`: builds object by iterating header columns; missing cells become `undefined`.
- `normalizeSheetProduct` (`client-sheet.ts:518-558`) coerces undefined → `String(p.id ?? "")` → `""`.
- Empty `id` is filtered out by `clientListProducts` (`client-sheet.ts:127-135`): `if (!id || seen.has(id)) continue;`.
- Row silently dropped. ✅ No crash.

### B2. Admin deletes the header row
**Verdict: P1 — Apps Script auto-heals, but the next poll may return malformed data.**
- `ensureProductsSheet` (`apps-script.gs:115-133`): checks if header row matches `PRODUCTS_COLS`; if not, **overwrites row 1** with the canonical header. So deleting the header is self-healing.
- BUT: the row that used to be row 2 (the first real product) is now treated as a header by `serveProducts` (`apps-script.gs:146-156`): `for (var i = 1; i < values.length; i++)` starts from index 1, skipping row 1 (the restored header). So the old first product is preserved as data, but the auto-fix may have OVERWRITTEN it with the header row labels.
- Result: one product is silently lost. Admin sees the count drop by 1 with no explanation.
- **Fix:** Add a check: if header doesn't match AND row 1 looks like real product data (id present, image is a URL), insert a new header row instead of overwriting.

### B3. Admin types non-numeric price (e.g., "abc")
**Verdict: P2 — gracefully falls back to null (price-on-request).**
- Apps Script: `obj.price = Number(obj.price)` → `NaN` if "abc". Server stores `NaN` in the sheet cell.
- Client: `normalizeSheetProduct` (`client-sheet.ts:524-530`): `Number(p.price)` → NaN. The check `p.price === null || p.price === undefined || p.price === ""` does NOT include NaN. So `price` is set to `NaN` in the SheetProduct.
- `normalizeProduct` (`use-catalog.ts:618-624`): same check, same result — `price = NaN`.
- `formatPrice(NaN)` returns "السعر عند الطلب" (`products.ts:646-651`) — graceful UI.
- **Business bug:** `Number(NaN) + variantAdjustment = NaN` → `adjustedPrice = NaN` → customer can add to cart → cart stores `price: NaN` → checkout submits `price: NaN` to Apps Script → `Number("NaN") = NaN` in the order row.
- Admin sees "NaN" in the Orders sheet for that order's unit price. Not great, but no crash.
- **Fix:** In `normalizeSheetProduct` and `normalizeProduct`, add `|| Number.isNaN(Number(p.price))` to the null-coalescing condition so NaN becomes null.

### B4. Admin types negative price
**Verdict: P1 — admin panel rejects it; sheet-side doesn't.**
- Admin panel validation (`admin-panel.tsx:437-442`): rejects `price < 0` with toast "السعر غير صالح."
- But if admin edits the sheet DIRECTLY (typing `-500` in the cell), there's no client-side validation. The negative price flows through.
- `formatPrice(-500)` → `-500 دج` (displayed as a negative number).
- Cart computes `total = -500 × 1 = -500`. Checkout submits `grandTotal: -500 + shippingPrice`.
- Customer could theoretically get a refund order. Apps Script stores the negative number; admin sees a negative-order row.
- **Fix:** In `normalizeSheetProduct`/`normalizeProduct`, clamp negative price to 0 or treat as null.

### B5. Admin types very long name (1000 chars)
**Verdict: P2 — UI overflow but no crash.**
- Sheet accepts the value (cell limit is 50K chars).
- `product-card.tsx:64`: `line-clamp-2 h-10 overflow-hidden` — truncates to 2 lines visually.
- `featured-carousel.tsx:145`: `font-serif text-lg` — no line clamp; long name overflows the carousel card.
- `product-page.tsx:339`: `font-arabic text-3xl` — full long name renders, possibly pushing the layout vertically.
- Cart drawer (`cart-bar.tsx:127`): `line-clamp-2` — truncates.
- Apps Script order submission: `clientSubmitOrder` truncates product name to 200 chars (`client-sheet.ts:460`).
- No crash. Layout slightly broken on featured carousel and product page.

### B6. Admin types HTML/JS in description (XSS)
**Verdict: P3 — React escapes by default.**
- React renders `{product.description}` as a string in `<p>` (`product-page.tsx:380`).
- React's JSX automatically escapes `<`, `>`, `&` — no innerHTML is used.
- No `dangerouslySetInnerHTML` anywhere in the codebase.
- ✅ XSS-safe by design.

### B7. Admin pastes Excel data with formatting
**Verdict: P2 — extra whitespace/non-printable chars may break parsing.**
- Excel pastes typically insert tabs, non-breaking spaces (\u00A0), and rich-text markers.
- `parseVariants` (`products.ts:733-771`) splits by `:` and `,` — extra whitespace is trimmed.
- `parseQuantityTiers` (`products.ts:829-871`) splits by `,` and `:` — same.
- Non-breaking spaces in `price` cell: `Number("\u00A05\u00A0000")` returns `NaN` — falls back to null (price-on-request). Correct.
- ✅ No crash.

### B8. Admin clears all rows
**Verdict: P1 — falls back to SEED_PRODUCTS.**
- Same as A7: `clientListProducts` returns `[]`, `useCatalog.refresh` falls back to cached or seed.
- If customer has cached products, they continue to see them. If no cache (first visit), they see SEED_PRODUCTS (29 demo items) which may be confusing.
- The admin's own admin panel shows 0 products ("لا توجد منتجات").

### B9. Admin adds duplicate IDs
**Verdict: P3 — deduplicated by Apps Script AND client.**
- `apps-script.serveProducts` (`apps-script.gs:143-155`): `seenIds` Set skips duplicates.
- `clientListProducts` (`client-sheet.ts:124-135`): another `seen` Set skips duplicates.
- `loadCatalog` (`products.ts:907-924`): another `seen` Set skips duplicates in localStorage.
- ✅ Triple-deduplicated. No crash.

### B10. Admin types emoji in product name
**Verdict: P3 — emoji not in ID, so the row is preserved.**
- The ID regex `/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u` (`client-sheet.ts:132`) only filters out rows with Arabic/emoji in the **ID** field, not the name.
- Product name with emoji renders fine in the UI (emoji is valid UTF-8).
- ✅ No crash.

### B11. Admin leaves image field empty
**Verdict: P2 — product is filtered out of the storefront.**
- `page.tsx:172-184`: `validProducts = catalog.products.filter(p => p.image && p.image.trim() !== "" && (p.image.startsWith("http") || "data:" || "/"))`.
- If `image === ""`, the product is excluded from `validProducts`.
- The product still appears in the admin panel (admin can edit it and add an image).
- The admin panel's save validation (`admin-panel.tsx:443-448`) rejects saves with no image — but a sheet-direct edit bypasses this check.
- ✅ No crash. Correct fallback.

### B12. Admin types a URL that's not Cloudinary
**Verdict: P2 — image may load slowly but won't crash.**
- `optimizeCloudinaryUrls` (`use-catalog.ts:555-583`) only rewrites URLs matching `res.cloudinary.com` — other URLs pass through.
- `product-image.tsx:35-46`: `if (src.startsWith("/"))` returns as-is; otherwise `optimizeImageUrl` returns the external URL.
- `ProductImage` renders it as an external URL (`unoptimized = isExternalUrl`).
- If the URL is broken/404, `onError` fires → `useFallback` set to true → but `cloudinaryFallback` is null (only built for `/images/products/` paths) → falls back to the original broken URL again → infinite `onError` loop? No: `if (!useFallback) setUseFallback(true)` only fires once.
- After first error, image just shows the warm cream background indefinitely. No crash.
- **Fix:** Could show a "broken image" placeholder if the second attempt fails too.

### B13. Admin types malformed quantityTiers
**Verdict: P3 — `parseQuantityTiers` is bulletproof.**
- `products.ts:829-871`: parses with strict validation:
  - `qty = Number(qtyStr)`; `if (isNaN(qty) || qty < 1) continue;` — skips invalid tier.
  - `middle` must be in `["none", "desk", "home", "both"]` (new format) or legacy tokens; else defaults to `"none"`.
  - `discount = Number(discountStr) || 0`.
- All malformed tiers are either skipped or normalized to safe defaults.
- ✅ No crash.

### B14. Admin changes sortOrder to NaN
**Verdict: P2 — product sorts to the bottom.**
- `normalizeSheetProduct` (`client-sheet.ts:553`): `p.sortOrder === null || undefined ? 999 : Number(p.sortOrder)`.
- If `p.sortOrder = "abc"` (string), `Number("abc") = NaN`. The check doesn't catch NaN.
- `products.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))` — `NaN - 999 = NaN`, `NaN < 0 = false`, `NaN > 0 = false` → unstable sort order.
- In practice, Array.sort with NaN comparisons places the product at a random position.
- **Fix:** Add `Number.isNaN(Number(p.sortOrder)) ? 999 : Number(p.sortOrder)` to the normalization.

### B15. Admin types Arabic in the ID field
**Verdict: P3 — row is filtered out at TWO layers.**
- `apps-script.serveProducts` (`apps-script.gs:152`): `if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idStr)) continue;`
- `clientListProducts` (`client-sheet.ts:132`): same regex filter.
- ✅ Triple-filtered (client sheet.ts, client use-catalog normalize, Apps Script). No crash.

### B16. Admin adds 1000 products at once
**Verdict: P1 — localStorage overflow; IndexedDB fallback works.**
- 1000 products × ~2 KB each = ~2 MB. localStorage limit is 5 MB (4 MB safe threshold in `adaptive-storage.ts:70`).
- `saveCatalog` (`products.ts:1048-1074`): writes to localStorage; verifies length match. If verification fails (truncation), removes the key and falls back to `adaptiveSet` (IndexedDB).
- `loadCatalogAsync` (`products.ts:931-950`): tries localStorage first, falls back to IndexedDB.
- **Potential issue:** `loadCatalog` (sync version, used in `useCatalog.refresh` at line 70) ONLY checks localStorage. If localStorage was too small and the catalog is in IndexedDB, the sync load returns `[]`. The async load runs in parallel and updates state later — a few hundred ms of "no products" flash.
- ✅ Eventually correct, but UX has a brief flash.
- Apps Script: `serveProducts` returns 1000 rows of JSON in ~3-5s. Browser parses fine.
- Admin panel: renders 1000 list items — could be slow (~1s render). No virtualization.

### B17. Admin types very long description (50K chars)
**Verdict: P1 — sheet cell limit hit.**
- Google Sheets cells have a 50,000-character limit.
- 50K chars will fit (just barely).
- `IMAGES_TOTAL_CHAR_CAP = 47000` (`products.ts:103`) is for the IMAGES field, not description.
- Description is not truncated anywhere client-side.
- UI: `product-page.tsx:380` renders the full description in a `<p>` with no clamp. Customer scrolls a lot.
- **Fix:** Optionally truncate description to ~5,000 chars on display (admin still sees full text in editor).

### B18. Admin clears the Products tab entirely
**Verdict: P1 — same as B8.**
- Falls back to cache → seed. Customer may see SEED_PRODUCTS.

### B19. Admin renames a product to match another
**Verdict: P2 — duplicate name in Stock tab causes wrong decrement.**
- Apps Script's `onStockEdit` (`apps-script.gs:361-382`) matches by `productName` — finds the FIRST match.
- If two products share the same name, stock decrement hits the wrong row.
- The catalog has unique IDs (still works), but stock logic conflates the two.
- **Fix:** Make `onStockEdit` match by ID (would require adding product ID to the Orders sheet).

### B20. Admin types special characters in category
**Verdict: P3 — handled gracefully.**
- Category is just a string in the catalog. Special chars (`<`, `>`, `&`, emoji, Arabic, etc.) are rendered as text by React.
- `all-products.tsx:131`: `{activeCategory}` rendered as text in `<h3>`. Escaped by React.
- No SQL (no DB), no shell injection (no shell), no eval.
- ✅ No issue.

---

## Category C — Network + Timing (15 scenarios)

### C1. Network drops mid-checkout
**Verdict: P1 — order saved to retry queue; customer sees thank-you.**
- `clientSubmitOrder` (`client-sheet.ts:442-514`): retries 2 times with 2s × 2^attempt backoff. If all fail, throws.
- `cod-order-form.tsx:308-334`: catches the failure, calls `addFailedOrder` → saves to localStorage.
- **Customer sees the thank-you screen regardless** (`cod-order-form.tsx:336-376`).
- Order is retried on next page visit by `retryFailedOrders` (`failed-orders.ts:84-133`).
- ✅ Resilient. No data loss.

### C2. Network is very slow (10s per request)
**Verdict: P2 — 10s timeout in `fetchWithTimeoutAndRetry` may fire mid-stream.**
- `DEFAULT_TIMEOUT_MS = 10_000` (`client-sheet.ts:32`).
- If the response takes 9.5s, the timeout is cleared and the response is processed.
- If 10.5s, the AbortController aborts → caught → retries with exponential backoff (1s, 2s) → next attempt also times out at 10s.
- Total time before fallback: ~33s (3 attempts × 10s + 2 backoff delays).
- During this time, the customer sees cached data (good) and the catalog poll happens in the background.
- Cart operations are synchronous localStorage → no impact.
- Checkout submit would freeze the "Submitting..." spinner for ~33s before showing the thank-you screen.
- **Fix:** Lower timeout to 7s and add a visible "this is taking longer than expected" toast after 5s.

### C3. Apps Script is down entirely
**Verdict: P2 — site keeps working on cached data.**
- All `clientListProducts` / `clientGetStockCsv` calls fail → return `[]` / `""`.
- `useCatalog.refresh` falls back to cached products (`use-catalog.ts:114-123`).
- `useStock.fetchStock` keeps the cached stock (`use-stock.ts:281-287`).
- Image uploads in admin fail with toast. Order submissions go to retry queue.
- ✅ Customer-facing site stays functional.
- **Failure mode:** If the sheet has been down for >2h (TTL of stock cache), stock data is stale but still shown.

### C4. Apps Script returns 500 error
**Verdict: P2 — same as C3.**
- `fetchWithTimeoutAndRetry` (`client-sheet.ts:79-84`): retries 5xx up to `retries` count, then returns the failed Response.
- `clientListProducts`: `if (!res.ok) return [];` → falls back to cache.
- ✅ Resilient.

### C5. Apps Script returns malformed JSON
**Verdict: P2 — caught at JSON.parse.**
- `clientListProducts` (`client-sheet.ts:121`): `const data = await res.json();` — throws SyntaxError.
- Wrapped in try/catch (`client-sheet.ts:137-140`): `return [];` → falls back to cache.
- ✅ Resilient.

### C6. Apps Script returns empty array
**Verdict: P1 — falls back to SEED_PRODUCTS (same as A7).**
- `clientListProducts` returns `[]`. `useCatalog.refresh` falls through to cache → seed.
- If the customer has never visited, they see 29 demo products.
- **Fix:** Add a "looks like the catalog is empty — refresh in a few minutes" empty state instead of seed fallback when the previous state had products.

### C7. Apps Script returns 302 redirect loop
**Verdict: P2 — `redirect: "follow"` will follow up to browser's limit (20 hops).**
- Browser throws `TypeError: Failed to fetch` after too many redirects.
- Caught by `fetchWithTimeoutAndRetry` → retried → same failure.
- Falls back to cache.
- ✅ Resilient, but wastes ~30s on retries before falling back.
- **Fix:** Add `redirect: "error"` for read operations to fail fast.

### C8. Cloudinary is down during image upload
**Verdict: P2 — image upload returns `""`; admin sees error toast.**
- `clientUploadImage` (`client-sheet.ts:276-398`): 2 retries with exponential backoff (1.5s, 3s).
- All failures return `""` (empty string).
- `clientUploadImages` filters out empty strings (`client-sheet.ts:430`).
- `admin-panel.tsx:298-306`: if `uploadedUrls.length === 0` → toast error → return early.
- Admin's product image set is unchanged. Save is blocked until at least one image succeeds.
- ✅ Resilient.

### C9. Cloudinary returns 400 (bad preset)
**Verdict: P2 — second attempt without `public_id`; if still 400, skip image.**
- `clientUploadImage` (`client-sheet.ts:333-364`): on 400, retries once without `public_id` (some presets don't allow it).
- If second attempt also 400, returns `""`.
- ✅ Handled.

### C10. Cloudinary returns 429 (rate limited)
**Verdict: P2 — retries with exponential backoff.**
- `fetchWithTimeoutAndRetry` (`client-sheet.ts:79-84`): `if (res.status >= 500 || res.status === 429)` → retries.
- BUT: `clientUploadImage` doesn't use `fetchWithTimeoutAndRetry` — it uses raw `fetch` with manual retry (`client-sheet.ts:301-390`).
- The manual retry loop (`for attempt 0..MAX_IMAGE_RETRIES`) handles 429 via `lastError = new Error("Cloudinary " + res.status)` and retries (`client-sheet.ts:365-369`).
- 2 retries with 1.5s + 3s backoff. May not be enough for sustained rate-limit.
- **Fix:** Honor `Retry-After` header from Cloudinary's 429 response.

### C11. Wi-Fi reconnects during checkout
**Verdict: P2 — order goes to retry queue.**
- Same as C1. Customer sees thank-you screen, order is retried later.
- ✅ Resilient.

### C12. Tab is backgrounded during fetch
**Verdict: P2 — fetch may be paused by browser; AbortController may fire.**
- Browsers throttle/pause JavaScript in background tabs (especially mobile).
- `setInterval` continues but may be delayed (Chrome throttles to 1/min for background tabs).
- `fetch` ongoing when tab is backgrounded may complete or be aborted depending on browser.
- `useCatalog` schedules `HIDDEN_POLL_MS = 4h` when hidden (`use-catalog.ts:41`) — good.
- `useStock` does the same (`use-stock.ts:222`).
- On visibility regain, both fire immediate refresh (`use-catalog.ts:236-241`, `use-stock.ts:320-329`).
- ✅ Correctly handled.

### C13. Multiple tabs open simultaneously
**Verdict: P1 — each tab polls independently; no `storage` event listener.**
- Each tab maintains its own `useCatalog` state in React memory.
- Both tabs write to the SAME `localStorage` key (CATALOG_STORAGE_KEY) via `saveCatalog`.
- Tab A saves a product → writes localStorage → tab B doesn't know until B's next `refresh()` (2h later).
- If B's `refresh()` fires while A's write is in progress → race condition: B reads stale data → overwrites with stale.
- **Fix:** Listen to the `storage` event in `useCatalog`:
  ```ts
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CATALOG_STORAGE_KEY && e.newValue) {
        // Another tab updated the catalog — refresh from localStorage
        const next = JSON.parse(e.newValue).map(normalizeProduct);
        setProducts(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  ```

### C14. Page closed during image upload
**Verdict: P2 — Cloudinary upload may complete on server but client never knows.**
- The upload was initiated but the response never reaches the client.
- Cloudinary stores the image (the upload completed server-side before the response).
- The product save was never triggered (Save button wasn't clicked or the upsert POST didn't fire).
- Result: orphan image in Cloudinary, no entry in the sheet.
- **Fix:** Use a `beforeunload` handler to warn the admin if uploads are in progress:
  ```ts
  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);
  ```

### C15. Browser goes offline then online
**Verdict: P2 — fetches fail then succeed on next poll.**
- `navigator.onLine` is not checked anywhere in the code.
- During offline: all `fetch` calls fail with `TypeError: Failed to fetch`. Caught, falls back to cache.
- When back online: next `setInterval` poll succeeds.
- **Fix:** Add an `online` event listener to trigger an immediate `refresh()` when connectivity returns:
  ```ts
  useEffect(() => {
    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);
  ```

---

## Category D — Cart Edge Cases (15 scenarios)

### D1. Cart has 1000 items
**Verdict: P1 — UI freeze; localStorage quota risk.**
- Cart sanitizer: `parsed.filter(...).map(...)` (`use-cart.ts:29-52`) iterates 1000 items — fast.
- `JSON.stringify(1000 items)` → ~500 KB. localStorage limit 5 MB → fits.
- Cart drawer renders 1000 `<div>` elements (`cart-bar.tsx:105-177`) → main-thread render freeze (~2s on mobile).
- `total = items.reduce(...)` runs on every render — 1000 ops × every keystroke in the form = jank.
- **Fix:** Virtualize the cart drawer list (e.g., `react-window`). Also cap cart size at 99 items (same as per-item qty cap) in `addToCart`.

### D2. Cart has items with deleted products
**Verdict: P1 — orphan items; checkout still works.**
- Cart snapshot has `productId` that's no longer in `catalog.products`.
- `onItemClick(productId)` (`page.tsx:151-157`) → `catalog.products.find()` returns undefined → silently no-ops.
- Cart drawer still shows the item with its snapshot image/name/price.
- Checkout submits the order with snapshot data → admin receives order for a non-existent product.
- **Fix:** On cart hydrate, prune orphans by checking against `catalog.products`:
  ```ts
  // In useCart (or in the consuming component)
  const liveProductIds = new Set(catalog.products.map(p => p.id));
  const liveItems = items.filter(it => liveProductIds.has(it.productId));
  if (liveItems.length !== items.length) {
    persist(liveItems);
    toast.info("تمت إزالة منتجات لم تعد متوفرة من السلة");
  }
  ```

### D3. Cart has items with changed prices
**Verdict: P0 — same as A2. Customer pays old price.**

### D4. Cart has items with changed images
**Verdict: P3 — visual glitch only.**
- Cart drawer renders `item.image` from snapshot.
- Clicking the item navigates to the product page (if still exists), which shows the new image.
- No crash.

### D5. Cart has items with changed names
**Verdict: P1 — same as A18. Order submitted with old name; stock decrement may fail.**

### D6. Cart has items with changed variants
**Verdict: P1 — `variantKey` no longer matches a real variant.**
- Cart snapshot stores `variantKey: "Red_Large"` at add-time.
- Admin removes "Red" variant → on next refresh, `product.variants` doesn't include Red.
- Cart drawer still shows the item with the old variantKey.
- Checkout submits `allProducts = items.map(it => it.name × it.quantity)` — variantKey is NOT in the order payload (`cod-order-form.tsx:261-263` only sends `name`, not `variantKey`).
- The variant info is in `notes` (via `extraNotes` from `product-page.tsx:554`), but only for single-item checkout from the product page. Multi-item cart checkout loses variant info entirely.
- **Fix:** Include `variantKey` in the `OrderItem` and append to order notes for multi-item cart.

### D7. Cart has items with 0 quantity
**Verdict: P3 — filtered out by sanitizer.**
- `use-cart.ts:38`: `item.quantity > 0` is required. Items with qty=0 are dropped on hydrate.
- ✅ Handled.

### D8. Cart has items with negative quantity
**Verdict: P3 — filtered out.**
- Same line: `item.quantity > 0`. Negative qty dropped on hydrate.
- ✅ Handled.

### D9. Cart has items with NaN price
**Verdict: P1 — `price: NaN` stored in cart.**
- Sanitizer: `typeof item.price === "number" && !isNaN(item.price) ? item.price : null` (`use-cart.ts:45-47`).
- NaN is rejected → `price = null` (price-on-request).
- ✅ Handled at hydrate.
- But if a product with `price: NaN` is added to cart at runtime (not from localStorage), the sanitizer doesn't run on `addToCart` — only on hydrate.
- `addToCart` accepts any `price: number | null` from the caller.
- **Fix:** Sanitize in `addToCart`:
  ```ts
  const safePrice = typeof item.price === "number" && !isNaN(item.price) ? item.price : null;
  ```

### D10. Cart has items with null price
**Verdict: P3 — valid; price-on-request products.**
- `CartItem.price: number | null` (`use-cart.ts:9`).
- Cart drawer (`cart-bar.tsx:60-66`): detects null and shows "السعر عند الطلب" instead of total.
- Checkout submits `price: null` → Apps Script stores empty cell.
- ✅ Designed behavior.

### D11. Cart has duplicate items (same productId, same variantKey)
**Verdict: P3 — merged by `addToCart`.**
- `use-cart.ts:100-102`: `findIndex((i) => i.productId === item.productId && (i.variantKey || "") === variantKey)`.
- If found, increments quantity instead of adding new line.
- ✅ Handled.
- But if duplicates were injected directly into localStorage (bypassing `addToCart`), they survive. The sanitizer doesn't dedupe.
- **Fix:** Add dedupe in sanitizer:
  ```ts
  const seen = new Set<string>();
  const deduped = sanitized.filter(it => {
    const k = `${it.productId}|${it.variantKey || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  ```

### D12. Cart has items with variantKey but no variants in product
**Verdict: P2 — orphan variant; cart shows it but checkout ignores it.**
- Cart item has `variantKey: "Red"` but the product's `variants` array is empty.
- Cart drawer renders normally (uses snapshot data).
- Checkout: `OrderItem` only has `name`/`price`/`quantity` — `variantKey` is lost.
- ✅ No crash, but variant info is silently dropped from the order.

### D13. Cart localStorage is corrupted
**Verdict: P3 — caught and cleared.**
- `use-cart.ts:68-74`: `try { JSON.parse(raw) } catch { localStorage.removeItem(CART_STORAGE_KEY); }`.
- ✅ Handled. Cart starts fresh.

### D14. Cart localStorage is empty array
**Verdict: P3 — handled normally.**
- `JSON.parse("[]") = []`. `Array.isArray([]) = true`. Sanitizer maps → `[]`.
- `setItems([])`. Cart shows empty state.
- ✅ Handled.

### D15. Cart localStorage has invalid JSON
**Verdict: P3 — same as D13.**
- `JSON.parse` throws → caught → cart cleared.
- ✅ Handled.

---

## Category E — Navigation Edge Cases (15 scenarios)

### E1. Navigate to product with non-existent ID
**Verdict: P3 — falls through to home view.**
- `page.tsx:226-257`: `if (product)` is false → falls through to home view.
- Customer sees the home page. No "product not found" message.
- **Fix:** Show a brief toast "المنتج غير موجود" before redirecting.

### E2. Navigate to product with emoji ID
**Verdict: P3 — emoji ID filtered out of catalog.**
- The catalog filters out emoji/Arabic IDs (`client-sheet.ts:132`, `page.tsx:179`).
- `catalog.products.find(p => p.id === view.id)` returns undefined → falls through to home.
- ✅ Handled.

### E3. Navigate to product with very long ID
**Verdict: P3 — works fine.**
- IDs are strings; no length limit in JS or React.
- `encodeURIComponent(longID)` may produce a long URL hash but stays within browser limits (~2K chars).
- ✅ No issue.

### E4. Navigate to admin with wrong password
**Verdict: P3 — error shown.**
- `admin-panel.tsx:142-152`: `if (value === ADMIN_PASSWORD)` else `setError(true)`.
- Error message: "كلمة المرور غير صحيحة."
- ✅ Handled.
- **Note:** `ADMIN_PASSWORD` is hardcoded in `BRAND.adminPassword` (client-side). Anyone can read it from the JS bundle. Not a real security boundary.
- **Fix:** Move admin auth to a server-side check (e.g., Cloudflare Worker with a KV store of valid passwords or, better, a magic-link email).

### E5. Navigate to admin with empty password
**Verdict: P3 — error shown.**
- `value === ADMIN_PASSWORD` is false (unless password is empty).
- Error shown.
- ✅ Handled.

### E6. Rapid navigation between products
**Verdict: P2 — multiple concurrent state updates; React batches them.**
- Each navigation sets `view` state, sets `window.location.hash`, saves scroll position.
- React 18+ batches state updates — should be fine.
- `useEffect([product?.id])` resets product page state each time (`product-page.tsx:57-65`).
- The product page's `useEffect` registers an Escape handler (`product-page.tsx:67-73`) — these may stack up if not cleaned up. But the cleanup `return () => window.removeEventListener(...)` runs on every re-render — correct.
- ✅ No crash, but scroll restoration may be slightly off.

### E7. Navigate back/forward rapidly
**Verdict: P2 — `hashchange` event fires; state updates accordingly.**
- `page.tsx:80-85`: `hashchange` listener updates `view` state.
- Rapid back/forward = multiple hashchange events = multiple `setView` calls.
- React batches; final state is the latest hash.
- ✅ No crash.

### E8. Navigate during loading
**Verdict: P3 — `useCatalog.loading` shows skeleton only when no data; navigation just changes the view.**
- `showSkeletons = catalog.loading && validProducts.length === 0 && !catalog.hydrated` (`page.tsx:194`).
- If user navigates to product page while loading: `catalog.products.find(p => p.id === view.id)` returns undefined → falls through to home → home shows skeletons if no data yet.
- ✅ Handled.

### E9. Navigate during checkout
**Verdict: P2 — modal stays open; cart may be cleared on success.**
- Checkout modal is open (`checkoutOpen = true`).
- User presses back button or clicks a link → `hashchange` fires → `setView({kind: "home"})`.
- The modal is still rendered (it's not tied to `view`).
- If user was mid-submit, the `clientSubmitOrder` fetch continues in the background.
- ✅ No crash; modal may need an explicit "are you sure?" before navigation.

### E10. Navigate during admin save
**Verdict: P1 — save may be lost.**
- Admin clicks Save → `upsertProduct` starts (async).
- Admin navigates away (clicks "خروج" or back button) → `AdminPanel` unmounts.
- The `upsertProduct` Promise continues (it's a fetch in flight), but the React state update on success (`setProducts(optimisticNext)`) targets a now-unmounted component → React warns about state update on unmounted component.
- The save may succeed on the sheet but the admin doesn't see the success toast.
- **Fix:** Track in-flight requests in a ref and warn before unload:
  ```ts
  useEffect(() => {
    if (!syncing) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [syncing]);
  ```

### E11. URL hash with special characters
**Verdict: P3 — `decodeURIComponent` wrapped in try/catch.**
- `page.tsx:39-46`: try/catch around `decodeURIComponent(m[1])`. Malformed → returns `{kind: "home"}`.
- ✅ Handled.

### E12. URL hash with SQL injection attempt
**Verdict: P3 — irrelevant (no SQL DB).**
- Hash is just a string; no SQL anywhere in the app.
- ✅ No issue.

### E13. URL hash with very long string
**Verdict: P3 — handled.**
- Hash strings have no practical length limit (browsers support ~2K chars in the URL).
- If longer, browser truncates → hash becomes invalid → falls through to home.
- ✅ Handled.

### E14. Direct URL to product page
**Verdict: P3 — works fine.**
- `parseHash` reads `window.location.hash` on mount (`page.tsx:80-85`).
- If hash is `#product/abc123` → view = product page.
- ✅ Handled.

### E15. Refresh on product page
**Verdict: P2 — page reloads; hash is preserved.**
- Browser preserves `#product/abc123` across reload.
- `useCatalog` re-mounts → reads localStorage cache → fetches from sheet.
- The product page is shown as soon as `catalog.products` contains the ID.
- If the catalog is still loading and the product isn't in cache → falls through to home (briefly) then back to product page once catalog loads.
- ✅ Handled, but slightly jarring UX (home page flash before product page).

---

## Category F — Render Edge Cases (15 scenarios)

### F1. Product with no image
**Verdict: P3 — filtered out of storefront.**
- `page.tsx:172-184`: `validProducts` filters out products with empty image.
- Product doesn't appear in featured carousel, all-products grid, etc.
- Product page can still be navigated to directly → `currentImage = images[activeIdx] || images[0] || ""` (`product-page.tsx:75`) → empty string → renders "لا توجد صورة" placeholder (`product-page.tsx:251-253`).
- ✅ Handled.

### F2. Product with data: URL image
**Verdict: P2 — `ProductImage` skips Next.js optimizer; renders fine.**
- `product-image.tsx:81`: `isDataUrl = src.startsWith("data:")`.
- `unoptimized = isDataUrl || isExternalUrl` → Next.js passes through.
- ✅ Renders. But data: URLs are typically very long (50K+ chars for a 850px WebP) — would overflow the sheet cell if persisted.
- The admin upload path resizes + uploads to Cloudinary (`admin-panel.tsx:295-301`), so data: URLs in the sheet only happen if the upload silently failed AND the code fell back to data: URL. But `clientUploadImage` returns `""` on failure, not the data: URL — so this case shouldn't occur in practice.

### F3. Product with broken image URL
**Verdict: P2 — `onError` falls back to Cloudinary (for local paths) or shows cream background.**
- `product-image.tsx:130-132`: `onError` sets `useFallback = true`.
- If src is `/images/products/foo.jpg` → `buildCloudinaryFallback` returns the Cloudinary URL → image loads from Cloudinary.
- If src is already Cloudinary → no fallback → image stays broken (cream background).
- ✅ Handled for local paths; partial handling for Cloudinary.

### F4. Product with very long name (1000 chars)
**Verdict: P2 — same as B5. UI overflow.**
- `product-card.tsx:64`: `line-clamp-2 h-10` truncates.
- `featured-carousel.tsx:145`: no clamp; overflows.
- `product-page.tsx:339`: renders full name; pushes layout.
- ✅ No crash.

### F5. Product with HTML in name
**Verdict: P3 — React escapes by default.**
- Same as B6.
- ✅ XSS-safe.

### F6. Product with empty name
**Verdict: P2 — admin save rejects; sheet-side may have it.**
- `admin-panel.tsx:432-435`: `if (!nameStr)` → toast error → save blocked.
- Direct sheet edit could leave name empty.
- `product-card.tsx:65`: renders empty `<span>` — empty title.
- `all-products.tsx:414`: shows "(بدون اسم)" for empty names in the admin panel.
- Customer-facing: empty title looks broken.
- ✅ No crash.

### F7. Product with null price
**Verdict: P3 — handled.**
- `formatPrice(null)` returns "السعر عند الطلب" (`products.ts:647`).
- `product-card.tsx:70`: `product.price === null ? "italic text-gray-light" : "text-emerald"`.
- ✅ Designed behavior.

### F8. Product with NaN price
**Verdict: P2 — handled at display, propagates to checkout.**
- Same as B3/D9. `formatPrice(NaN)` returns fallback label.
- But `NaN + variantAdjustment = NaN` → cart stores NaN → checkout submits NaN.
- **Fix:** Normalize NaN → null in `normalizeSheetProduct` and `normalizeProduct`.

### F9. Product with negative price
**Verdict: P2 — admin rejects; sheet-side doesn't.**
- Same as B4. Negative prices flow through to customer.
- ✅ Display works (shows "-500 دج"); business logic problem.

### F10. Product with 0 variants
**Verdict: P3 — handled.**
- `variants = product.variants ?? []` (`product-page.tsx:84`).
- `colorVariants.length === 0` → variant section not rendered (`product-page.tsx:386`).
- ✅ No issue.

### F11. Product with 50 variants
**Verdict: P2 — UI overflows; no crash.**
- `colorVariants.map(c => <button>)` renders 50 buttons (`product-page.tsx:397-419`).
- `flex flex-wrap gap-2` wraps to multiple lines — long scroll.
- Admin panel renders all 50 in the list (`admin-panel.tsx:741-780`).
- ✅ No crash, just ugly.

### F12. Product with duplicate variant names
**Verdict: P2 — `find(v => v.name === selectedColor)` returns first match.**
- If `colorVariants = [{name: "Red", adj: 100}, {name: "Red", adj: 200}]`, customer selects "Red" → `selectedColorVariant = first Red (+100)`.
- Both buttons render but selecting either sets `selectedColor = "Red"` → same variant.
- ✅ No crash, but the second button is effectively unreachable.

### F13. Product with special characters in description
**Verdict: P3 — React renders as text.**
- Same as B20.
- ✅ Handled.

### F14. Featured carousel with 1 product
**Verdict: P3 — handled.**
- `featured-carousel.tsx:36`: `if (count <= 1) return;` — no interval set.
- The single product is shown statically.
- Arrows work (just wrap to itself).
- ✅ Handled.

### F15. Featured carousel with 0 products
**Verdict: P3 — `if (count === 0) return null;`**
- `featured-carousel.tsx:51`: returns `null` — the section is omitted entirely.
- ✅ Handled.

---

## Summary Table — Priority Ranking

### P0 — Critical (must fix before production traffic)

| ID | Scenario | Fix Location |
|----|----------|--------------|
| A2 / D3 | Cart snapshots price; admin price change not reflected at checkout | `use-cart.ts` + `cod-order-form.tsx:164-184, 296` — re-resolve from live catalog before computing totals & submitting |
| A6 / A13 | Cart doesn't re-check rupture at checkout time | `cod-order-form.tsx:248` — accept `getStockCount` callback, re-check before submit |
| A19 / D2 | Cart retains orphaned (deleted) product IDs | `use-cart.ts` hydrate — prune items not in `catalog.products` |
| B3 / F8 | `Number("abc")` = NaN propagates to cart/checkout | `client-sheet.ts:518-558` + `use-catalog.ts:585-669` — add `Number.isNaN(Number(p.price)) ? null : Number(p.price)` |

### P1 — High (fix in next sprint)

| ID | Scenario | Fix Location |
|----|----------|--------------|
| A7 / B8 / C6 | Sheet returns `[]` → falls back to SEED_PRODUCTS on every visit | `use-catalog.ts:114-130` — if previous state had products, keep them; don't fall back to seed |
| A9 / A15 | Customer's selected variant becomes orphan after admin edit | `product-page.tsx` — add `useEffect` watching variant list to auto-clear orphaned selections |
| A18 / D5 | Cart snapshot name persists; stock decrement may fail | Same fix as A2 — re-resolve name from catalog at checkout |
| A20 | 5 simultaneous image uploads may rate-limit Cloudinary | `client-sheet.ts:415` — honor `Retry-After` header; consider increasing parallelism to 3 |
| B2 | Admin deletes header row → Apps Script auto-fix overwrites first product | `apps-script.gs:115-133` — insert new header row instead of overwriting when row 1 looks like real data |
| B4 / F9 | Negative price from direct sheet edit | `client-sheet.ts` — clamp negative to 0 or null |
| B14 | NaN sortOrder breaks sort stability | `client-sheet.ts:553` + `use-catalog.ts:651-653` — coerce NaN to 999 |
| B16 / D1 | 1000+ products causes localStorage overflow + admin panel render freeze | `admin-panel.tsx` — virtualize the product list (e.g., `react-window`) |
| B17 | 50K char description overflows UI | `product-page.tsx:380` — clamp to N chars with "عرض المزيد" expand |
| C13 | Multiple tabs don't sync via `storage` event | `use-catalog.ts:157-248` — add `storage` event listener |
| D6 | Cart variantKey lost on multi-item checkout | `cod-order-form.tsx:261-263` — include variantKey in `OrderItem`, append to order notes |
| D9 | `addToCart` doesn't sanitize NaN price (only hydrate does) | `use-cart.ts:87-116` — sanitize `item.price` in `addToCart` |
| D11 | Direct localStorage injection can create duplicate cart items | `use-cart.ts:29-52` — add dedupe in sanitizer |
| E10 | Navigate during admin save may lose the save | `admin-panel.tsx` — add `beforeunload` warning when `syncing` |

### P2 — Medium (fix opportunistically)

| ID | Scenario | Fix Location |
|----|----------|--------------|
| A3 | Customer's `activeIdx` doesn't reset when image set changes | `product-page.tsx:57-65` — extend `useEffect` deps to include `images.length` |
| A5 / A8 / A16 | Catalog mid-scroll reorders products visually | Cosmetic — no fix strictly needed |
| A14 | Quantity tiers change mid-checkout | `cod-order-form.tsx` — capture tiers at modal open, freeze |
| B5 / F4 | Long name overflows featured carousel | `featured-carousel.tsx:145` — add `line-clamp-2` |
| B7 / B11 / B12 | Sheet-direct edge cases (Excel paste, empty image, non-Cloudinary URL) | Already handled or self-limiting |
| B19 | Duplicate names cause wrong stock decrement | `apps-script.gs:361-382` — match by product ID instead of name |
| C2 / C7 | Slow network / redirect loop wastes 30s before fallback | `client-sheet.ts` — lower timeout to 7s; use `redirect: "error"` for reads |
| C10 | Cloudinary 429 doesn't honor `Retry-After` | `client-sheet.ts:365-369` — read `Retry-After` header |
| C14 | Page closed during upload → orphan Cloudinary image | `admin-panel.tsx` — `beforeunload` warning when `uploading` |
| D12 | Cart variantKey points to non-existent variant | Cosmetic — checkout drops it; no crash |
| E6 / E7 | Rapid navigation may stack Escape handlers | Verify cleanup function in `product-page.tsx:67-73` |
| E9 | Modal stays open during navigation | `checkout-modal.tsx` — add "are you sure?" before close |
| F2 | data: URL image (shouldn't happen in practice) | No fix needed — admin upload path prevents this |
| F3 | Broken external image URL shows cream background indefinitely | `product-image.tsx` — show "broken image" placeholder after 2nd error |
| F11 / F12 | Many variants / duplicate variant names | Cosmetic — admin panel could warn on duplicates |

### P3 — Minor (theoretical / cosmetic)

| ID | Scenario |
|----|----------|
| A4, A10, A11, A20 (Cloudinary part), B1, B6, B7, B10, B13, B15, B20, C3-C6, C8, C9, C11, C12, C15, D7, D8, D10, D13, D14, D15, E1-E5, E8, E11-E15, F1, F5, F6, F7, F10, F13, F14, F15 |

---

## Concrete Fixes (Top 4 P0)

### Fix 1 — Cart staleness: re-resolve from live catalog at checkout

**File:** `/home/z/my-project/src/components/site/checkout-modal.tsx`

```tsx
// AFTER: const orderItems: OrderItem[] = items.map((i) => ({ ... }))
// CHANGE TO:
type CheckoutModalProps = {
  open: boolean;
  items: CartItem[];
  liveProducts: Product[];          // NEW
  onClose: () => void;
  onOrderSuccess: () => void;
};

export function CheckoutModal({ open, items, liveProducts, onClose, onOrderSuccess }: CheckoutModalProps) {
  // ...existing state...
  
  // Re-resolve each cart item against the live catalog before checkout
  const orderItems: OrderItem[] = items.map((i) => {
    const live = liveProducts.find(p => p.id === i.productId);
    const livePrice = live?.price; // may have changed
    const priceChanged = livePrice !== i.price;
    if (priceChanged && open) {
      // Show toast ONCE per render cycle when modal opens
      // (Use a ref to avoid re-toasting on every render)
    }
    return {
      name: live?.name ?? i.name,
      price: livePrice ?? i.price,
      quantity: i.quantity,
    };
  });
  // ...
}
```

**File:** `/home/z/my-project/src/app/page.tsx`

```tsx
<CheckoutModal
  open={checkoutOpen}
  items={cart.items}
  liveProducts={catalog.products}    // NEW
  onClose={() => setCheckoutOpen(false)}
  onOrderSuccess={handleOrderSuccess}
/>
```

### Fix 2 — Cart rupture re-check at submit time

**File:** `/home/z/my-project/src/components/site/cod-order-form.tsx`

```tsx
type CodOrderFormProps = {
  // ...existing...
  isRuptureNow?: (productName: string) => boolean;  // NEW
};

// In handleSubmit:
const handleSubmit = async () => {
  if (rupture) return;
  // NEW: re-check rupture for each item
  if (isRuptureNow) {
    const rupturedItem = items.find(it => isRuptureNow(it.name));
    if (rupturedItem) {
      toast.error(`المنتج "${rupturedItem.name}" نفدت كميته. يرجى إزالته من السلة.`);
      return;
    }
  }
  // ...existing submit logic...
};
```

### Fix 3 — Orphan cart item pruning

**File:** `/home/z/my-project/src/hooks/use-cart.ts`

```ts
// Add a method to prune orphan items
const pruneOrphans = useCallback((liveProductIds: Set<string>) => {
  setItems(prev => {
    const next = prev.filter(it => liveProductIds.has(it.productId));
    if (next.length !== prev.length) {
      console.warn(`[Cart] Pruned ${prev.length - next.length} orphan item(s)`);
      try {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
      } catch {}
    }
    return next;
  });
}, []);

// Expose it
return { ..., pruneOrphans };
```

**File:** `/home/z/my-project/src/app/page.tsx`

```tsx
// After catalog hydrates, prune orphan cart items
useEffect(() => {
  if (catalog.hydrated && catalog.products.length > 0) {
    const liveIds = new Set(catalog.products.map(p => p.id));
    cart.pruneOrphans(liveIds);
  }
}, [catalog.hydrated, catalog.products, cart.pruneOrphans]);
```

### Fix 4 — NaN price normalization

**File:** `/home/z/my-project/src/lib/client-sheet.ts`

```ts
function normalizeSheetProduct(p: any): SheetProduct {
  const numOrNull = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "object" && v !== null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  return {
    // ...
    price: numOrNull(p.price),
    oldPrice: numOrNull(p.oldPrice),
    stock: numOrNull(p.stock),
    sortOrder: (p.sortOrder === null || p.sortOrder === undefined || Number.isNaN(Number(p.sortOrder)))
      ? 999
      : Number(p.sortOrder),
    // ...
  };
}
```

**File:** `/home/z/my-project/src/lib/products.ts` (mirror the change in the `normalizeProduct` function at line 952+).

---

## Architectural Recommendations (beyond individual fixes)

1. **Reduce polling interval for active shoppers.** 2 hours is too long for active e-commerce. Consider 15-minute polling when tab is visible, with a 4-hour backoff when hidden. Apps Script quota (30K/day) supports 100 users × 96 polls = 9,600/day — comfortable.

2. **Add a `storage` event listener** for multi-tab sync. This is free (browser provides it) and prevents "stale tab" complaints.

3. **Move admin auth off the client.** The `ADMIN_PASSWORD` constant is in the JS bundle and can be extracted in 30 seconds by anyone. Use a server-side check (Cloudflare Worker + KV) or magic-link email.

4. **Add an `online` event listener** to refresh immediately when connectivity returns.

5. **Virtualize long lists** (admin panel product list, cart drawer with 100+ items). `react-window` is ~7 KB and saves the main thread.

6. **Add an order version stamp.** When admin edits a product, increment a version counter. Store the version in the cart item at add-time. At checkout, compare versions → if mismatch, show "product details have changed" warning with the new price/image and let the customer confirm.

7. **Server-side stock validation.** Currently the client-side `isRupture` check is the only barrier. Apps Script's `doCreateOrderFromParams` should also check stock and reject if 0. This prevents the entire class of A6/A13 bugs regardless of client-side state.

8. **Add `Retry-After` honoring** for Cloudinary 429s to avoid hammering the API during rate-limit windows.

9. **Cap cart size** at 50 items (current per-item cap is 99, but no total cap). Prevents both UI freeze and localStorage overflow.

10. **Use `redirect: "error"` for read operations** (catalog/stock fetches) so redirect loops fail fast instead of eating 30s.

---

## Final Verdict

**Will the site crash under simultaneous admin + customer use?** No — the ErrorBoundary, self-healing cart, and fallback chains prevent hard crashes.

**Will business operations stay correct?** No — **the four P0 issues (cart price staleness, rupture not re-checked, orphan items, NaN propagation) will cause real customer-facing problems within hours of going live with concurrent admin + customer traffic.**

The most important fix is **Fix 1 (re-resolve cart from live catalog at checkout)** — it addresses A2, A13, A18, A19, D2, D3, D5, D6 in a single change.

— End of report —
