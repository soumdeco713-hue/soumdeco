# SOUM DECO — Self-Healing Protocol

## MISSION
You are the guardian of the SOUM DECO website. Your single mission: **ensure the site works perfectly for every visitor, on every browser, every time.** No errors. No stuck loading. No broken images. No broken checkout. No data loss.

## THE 7 PROTECTIONS (verify ALL before making changes)

1. **Loading:** Site paints within 2 seconds. Cached data shows instantly. Background refresh is silent.
2. **Images:** Every product image appears. If local fails, Cloudinary fallback fires. No white boxes.
3. **Stock:** Only TRULY out-of-stock products show "نفدت الكمية". Seed data is validated (reject >90% zero).
4. **Checkout:** Checkout form opens. Orders submit. Failed orders saved to retry queue. No false "cart empty".
5. **Cart:** Items survive refresh. Orphan items pruned. NaN prices → null. Quantity ≥ 1.
6. **Admin:** Save is fast. Delete frees slots. Rollback on failure. Max 5 images.
7. **Errors:** ErrorBoundary catches crashes. LoadingFallback detects stuck/blank. `<noscript>` for no-JS.

## SAFE CHANGE PRINCIPLES (follow EXACTLY)

- **NEVER add complexity.** If a fix needs a new dependency, service worker, or state machine, find a simpler way.
- **NEVER change what works.** Only fix the specific bug. Don't refactor surrounding code.
- **NEVER remove a fallback.** Every try/catch, every `?? default`, every `|| []` is there for a reason.
- **NEVER add a service worker.** It caused the "stuck at loading" bug. Use HTTP headers instead.
- **ALWAYS test after changes.** Build → wrangler dev → Playwright test → push → verify production.
- **ALWAYS preserve backward compat.** Old localStorage data, old sheet formats, old URLs must work.
- **ALWAYS use the simplest fix.** A 1-line guard beats a 50-line rewrite.

## SCENARIOS TO CHECK (verify each is handled)

### Loading (5)
- [ ] First visit (no cache) → seed products show instantly
- [ ] Returning visit (cached) → cache shows instantly, refresh silent
- [ ] Apps Script slow (10s) → cached/seed shows, refresh completes in background
- [ ] Apps Script down → cached/seed shows, no error visible to user
- [ ] Blank screen → LoadingFallback detects + shows refresh button

### Images (5)
- [ ] Normal image → loads from /images/products/ (Cloudflare Pages)
- [ ] New upload (not synced yet) → loads from Cloudinary (fallback)
- [ ] Broken local image → onError fires → Cloudinary URL used
- [ ] All images lazy loaded (except above-the-fold priority)
- [ ] No white boxes (warm background color #FAF8F4 + fade-in on load)

### Stock (5)
- [ ] Seed file valid (≤90% zero) → shows correctly
- [ ] Seed file stale (>90% zero) → rejected, shows nothing (no false "out of stock")
- [ ] Live stock fetch → sanity check before applying
- [ ] Per-variant stock → "Product - Variant" naming convention
- [ ] Chrome caching → `no-cache` header on seed (not force-cache)

### Checkout (5)
- [ ] Cart has items → checkout form opens
- [ ] Cart empty → blocked with error toast
- [ ] Product out of stock → checkout blocked + rupture re-checked at submit
- [ ] Network fails mid-submit → order saved to retry queue
- [ ] NaN price → treated as null (price-on-request)

### Cart (5)
- [ ] Add item → persists to localStorage
- [ ] Remove item → updates localStorage
- [ ] Orphan item (deleted product) → pruned on catalog refresh
- [ ] Corrupted localStorage → sanitized (invalid items removed)
- [ ] Quantity 0/negative → clamped to 1

### Admin (5)
- [ ] Add product → image uploads to Cloudinary, product saves to sheet
- [ ] Edit product → changes save + sync
- [ ] Delete product → removed from sheet, orphan cart items pruned
- [ ] Image upload fails → error toast, save blocked
- [ ] Max 5 images → enforced (was 8)

### Errors (5)
- [ ] Render crash → ErrorBoundary catches, shows friendly UI
- [ ] JS disabled → `<noscript>` fallback shows message
- [ ] Network offline → cached data shows, health monitor detects
- [ ] Hydration mismatch → suppressHydrationWarning on html + head
- [ ] 404 page → shows friendly "not found" with link home

## EXECUTION CHECKLIST (run this before EVERY push)

```
1. Build succeeds?        npx next build
2. Cloudflare builds?     npx @cloudflare/next-on-pages@1
3. Local test passes?     wrangler pages dev + Playwright
4. Production deploys?     git push → wait 90s → verify
5. Products load?          81 products, 80 cards
6. Stock correct?         6 rupture (not 57!)
7. Checkout opens?        Form visible, no false errors
8. 0 page errors?         Check browser console
9. 0 skeletons stuck?     All content renders
10. Images load?           82 local, 0 broken
```

## THE GOLDEN RULE

> **If a change could introduce a new bug, don't make it. The simplest fix that works is better than the smartest fix that might break something.**
