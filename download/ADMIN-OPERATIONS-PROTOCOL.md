# SOUM DECO — Admin Operations Protocol

## MISSION
Ensure that ALL admin operations (add, edit, delete, reorder, image upload) work perfectly without causing ANY disruption to customers browsing the site. No crashes, no slow loading, no broken images, no data loss — for either the admin OR the customers.

## THE 10 ADMIN PROTECTIONS

### 1. IMAGE UPLOAD SAFETY
- [ ] Admin can't save while images are still uploading (button disabled)
- [ ] Upload has 45s timeout (won't hang forever)
- [ ] Failed uploads return empty string (not base64 — prevents sheet overflow)
- [ ] Upload retry: 2 attempts with exponential backoff
- [ ] Max 5 images per product (enforced)
- [ ] Max 15MB per image (prevents browser freeze)
- [ ] SVG rejected (can't render to canvas)
- [ ] Each upload gets unique public_id (timestamp prevents CDN cache collision)

### 2. SAVE SAFETY
- [ ] Double-click prevention (saving flag)
- [ ] Image required check (product without image won't show)
- [ ] Price validation (must be number or null)
- [ ] Name required check
- [ ] Optimistic update (instant UI feedback)
- [ ] Rollback on failure (restore previous state)
- [ ] Error toast on failure (admin knows it failed)
- [ ] Background refresh after save (non-blocking, 100ms delay)

### 3. DELETE SAFETY
- [ ] Confirmation dialog (prevents accidental deletion)
- [ ] Optimistic removal (instant UI feedback)
- [ ] Rollback on failure (restore deleted product)
- [ ] Orphan cart pruning (customers' carts updated automatically)
- [ ] Background refresh after delete (non-blocking)

### 4. CUSTOMER ISOLATION
- [ ] Admin operations NEVER block customer browsing
- [ ] Catalog refresh is non-blocking (setTimeout 100ms, not awaited)
- [ ] Customers see cached data instantly (never wait for admin changes)
- [ ] Customers' pages never crash when admin edits/deletes
- [ ] Product page handles missing product gracefully (falls through to home)

### 5. DATA CONSISTENCY
- [ ] Sheet is source of truth (always synced)
- [ ] localStorage cache updated on every change
- [ ] IndexedDB fallback for large catalogs
- [ ] Orphan cart items pruned when catalog changes
- [ ] NaN prices → null (never reach Apps Script)

### 6. IMAGE TRANSITION SAFETY
- [ ] New images: Cloudinary URL (instant display)
- [ ] Synced images: local path (Pages, unlimited bandwidth)
- [ ] Broken local image: onError → Cloudinary fallback
- [ ] Manifest: lists all local files (checked before rewriting URL)
- [ ] Manifest timeout: 5s (won't block rendering)

### 7. CONCURRENT OPERATIONS
- [ ] Admin saves while customer browses: customer sees old data until next poll (2h)
- [ ] Admin deletes while customer views product: product page handles missing product
- [ ] Admin changes price while customer has cart: cart keeps old price (acceptable)
- [ ] Admin changes image while customer views: customer sees old image until refresh
- [ ] Multiple admin tabs: each has its own state (last write wins)

### 8. ERROR RECOVERY
- [ ] Save fails: rollback + error toast
- [ ] Delete fails: rollback + error toast
- [ ] Upload fails: error toast, save blocked
- [ ] Network down: operations fail gracefully, no data loss
- [ ] Apps Script down: save/delete fail, error toast, no data corruption

### 9. PERFORMANCE
- [ ] Image upload: parallel (2 at a time, not sequential)
- [ ] Save: 1-3s (just POST to Apps Script, images already uploaded)
- [ ] Background refresh: 100ms after save (non-blocking)
- [ ] Catalog: cached locally (instant display)
- [ ] Images: lazy loaded (only visible images load)

### 10. EDGE CASES
- [ ] Admin uploads 5 images simultaneously: handled (parallel upload)
- [ ] Admin saves product with no variants: works (variants optional)
- [ ] Admin saves product with no price: works (price-on-request)
- [ ] Admin saves product with special characters in name: works (URL-encoded)
- [ ] Admin deletes ALL products: works (site shows empty state)
- [ ] Admin resets catalog: works (seed products restored)

## EXECUTION CHECKLIST (run before EVERY admin change)

```
1. Build succeeds?           npx next build
2. Cloudflare builds?        npx @cloudflare/next-on-pages@1
3. Admin add works?          Add product → save → verify in list
4. Admin edit works?          Edit product → save → verify changes
5. Admin delete works?        Delete product → confirm → verify removed
6. Image upload works?        Upload image → verify appears
7. Cart still works?          Add to cart → checkout opens
8. No page errors?            Check browser console
9. Customer view OK?          Home loads, products show, images load
10. Orphan pruning works?     Deleted product removed from cart
```

## THE GOLDEN RULE

> **Admin operations must NEVER disrupt customers. The admin sees instant feedback (optimistic updates). Customers see changes on their next page load (cached data). Both work independently and never crash.**
