# 🎯 MASTER PROMPT — Build a Rebranded E-Commerce Storefront

> **What this is:** A complete, production-ready Next.js e-commerce storefront template. You feed this prompt + the source archive + the Google Sheet template to an AI coding agent (Claude, GPT, Cursor, etc.), tell it the new brand name + colors + contact info, and it produces a fully working store in ~10 minutes.
>
> **What the AI agent needs:**
> 1. This file (`MASTER-PROMPT.md`)
> 2. The source archive (`soumdeco-source.tar`)
> 3. The Google Sheet template (`SoumDeco-Sheet-Template.xlsx`) — or just create a new sheet with Orders/Stock/Products tabs
> 4. A free Cloudinary account (for image hosting)

---

You are an expert full-stack developer. Your task is to take the reference Next.js e-commerce storefront (provided as a source archive) and **rebrand it** for a new client. The reference is a real Algerian COD (cash-on-delivery) decor shop called SoumDecoDZ. You will change the brand identity, but the architecture, behaviors, integrations, and admin workflow MUST remain identical.

**This is the FINAL, BATTLE-TESTED spec.** Every detail below was learned through hard debugging. Do NOT skip, paraphrase, or "improve" anything — implement it EXACTLY as written.

────────────────────────────────────────────────────────────────────────────────
## INPUTS YOU WILL RECEIVE
────────────────────────────────────────────────────────────────────────────────

1. **Source archive** (`soumdeco-source.tar`) — the complete Next.js project
2. **Google Sheet template** — with 3 tabs: Orders, Stock, Products
3. **Cloudinary account** — free image hosting (cloud name + upload preset)
4. **Rebranding spec** from the client:
   - New brand name (replaces "SoumDeco")
   - New logo file
   - New colors (optional — can keep the Muted Boho Luxe palette)
   - New contact info (phone, Instagram, email, Facebook)
   - New shipping prices (if different from Algerian wilayas)
   - New brand story copy

────────────────────────────────────────────────────────────────────────────────
## ARCHITECTURE OVERVIEW (DO NOT CHANGE)
────────────────────────────────────────────────────────────────────────────────

```
Admin adds product in #admin panel
       ↓
Browser compresses photo (600px JPEG) → POST /api/products
       ↓
Next.js uploads photo to Cloudinary → gets 80-char URL
       ↓
Product data + Cloudinary URL → Google Sheet (via POST to Apps Script)
       ↓
Any visitor polls /api/products every 5.5 min → gets products with tiny Cloudinary URLs
       ↓
Images load from Cloudinary's global CDN (fast, free bandwidth)
```

**Three integrations, all via ONE Google Apps Script Web App:**
1. **Products** — stored in Google Sheet (product data) + Cloudinary (images)
2. **Orders** — stored in Google Sheet (Orders tab)
3. **Stock** — stored in Google Sheet (Stock tab)

**Why this architecture:**
- Zero build minutes on Netlify (only static code is hosted)
- Zero Netlify storage (products + images in Google + Cloudinary)
- Scales to 1500+ products (Cloudinary 25GB free, Sheet 10M cells)
- Works on any host (space-z.ai, Netlify, Vercel) — no database to migrate

────────────────────────────────────────────────────────────────────────────────
## GOOGLE APPS SCRIPT — THE BULLETPROOF INTEGRATION
────────────────────────────────────────────────────────────────────────────────

The Google Apps Script is the bridge between the website and the Google Sheet. It handles ALL operations via a single Web App URL.

### Critical implementation rules (learned from production debugging):

1. **ALL product operations use POST** (NOT GET). Google Apps Script's GET URL length limit is ~4000 chars. Product data with images exceeds this → products "disappear". POST has no limit.

2. **`featured` stored as STRING** `"true"`/`"false"` (NOT boolean). Google Sheets mangles boolean values unpredictably.

3. **Multi-image separator is `~~~`** (triple tilde). NOT `|` (Google strips pipes). NOT `|||` (Google strips triple pipes). `~~~` survives Google's URL parser.

4. **`findProductRow_` check uses `>= 0`** (NOT `> 0`). Row 0 is the first product — `> 0` treats it as "not found" → duplicates on every save.

5. **`doPost` reads product JSON from `e.postData.contents`** (the request body), NOT from URL parameters.

6. **Orders use GET** with URL params (orders don't have images, so no URL length issue).

7. **Stock uses GET** — returns the Stock tab as CSV.

### Complete Apps Script (paste this into the sheet's Apps Script editor):

```javascript
var ORDERS_SHEET = 'Orders';
var STOCK_SHEET = 'Stock';
var PRODUCTS_SHEET = 'Products';
var PRODUCTS_COLS = ['id', 'name', 'description', 'category', 'price', 'image', 'images', 'featured'];
var IMG_SEP = '~~~';

function doGet(e) {
  e = e || {}; var p = e.parameter || {};
  var action = String(p.action || '').toLowerCase();
  try {
    if (action === 'stock') return serveStock();
    if (action === 'products') return serveProducts();
    if (action === 'order') return doCreateOrderFromParams(p);
    if (action === 'product_delete') return doDeleteProduct(p.id || '');
    if (action === 'product_reset') return doResetProducts();
    return jsonOut({ ok: false, error: 'unknown action: ' + action });
  } catch (err) { return jsonOut({ ok: false, error: String(err) }); }
}

function doPost(e) {
  e = e || {}; var p = e.parameter || {};
  var action = String(p.action || '').toLowerCase();
  try {
    if (action === 'product_create' || action === 'product_update') {
      var bodyStr = e.postData ? e.postData.contents : '';
      var prod = bodyStr ? JSON.parse(bodyStr) : p;
      return doCreateProduct(prod);
    }
    return doGet(e);
  } catch (err) { return jsonOut({ ok: false, error: String(err) }); }
}

function doCreateOrderFromParams(p) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet) { sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET); sheet.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes']); }
  sheet.appendRow([new Date(),'New',p.product||'',Number(p.quantity)||1,(p.price===null||p.price===undefined||p.price==='')?'':Number(p.price),Number(p.shippingPrice)||0,Number(p.grandTotal)||0,p.fullName||'',p.phone||'',p.wilaya||'',p.commune||'',p.deliveryLabel||'',p.shippingCompanyLabel||'',p.notes||'']);
  return jsonOut({ ok: true });
}

function serveStock() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) { sheet = ss.insertSheet(STOCK_SHEET); sheet.appendRow(['Product Name','Status']); }
  var values = sheet.getDataRange().getValues();
  var csv = values.map(function(r){return r.map(function(c){return '"'+String(c==null?'':c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function ensureProductsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRODUCTS_SHEET);
  if (sheet) return sheet;
  sheet = ss.insertSheet(PRODUCTS_SHEET);
  sheet.appendRow(PRODUCTS_COLS);
  return sheet;
}

function serveProducts() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut([]);
  var header = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    var obj = {};
    for (var j = 0; j < header.length; j++) obj[header[j]] = r[j];
    obj.price = (obj.price===''||obj.price===null||obj.price===undefined)?null:Number(obj.price);
    obj.featured = (obj.featured===true||obj.featured===1||obj.featured==='1'||(typeof obj.featured==='string'&&obj.featured.toLowerCase()==='true'));
    if ((!obj.images||String(obj.images).trim()==='')&&obj.image) obj.images = String(obj.image);
    out.push(obj);
  }
  return jsonOut(out);
}

function doCreateProduct(p) {
  var sheet = ensureProductsSheet();
  if (findProductRow_(sheet, p.id) >= 0) return doUpdateProduct(p);
  sheet.appendRow(buildProductRow_(p));
  return jsonOut({ ok: true });
}

function doUpdateProduct(p) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, p.id);
  if (rowIdx < 0) return doCreateProduct(p);
  sheet.getRange(rowIdx + 2, 1, 1, PRODUCTS_COLS.length).setValues([buildProductRow_(p)]);
  return jsonOut({ ok: true });
}

function doDeleteProduct(id) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, id);
  if (rowIdx < 0) return jsonOut({ ok: false, error: 'not found' });
  sheet.deleteRow(rowIdx + 2);
  return jsonOut({ ok: true });
}

function doResetProducts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRODUCTS_SHEET);
  if (sheet) ss.deleteSheet(sheet);
  var newSheet = ss.insertSheet(PRODUCTS_SHEET);
  newSheet.appendRow(PRODUCTS_COLS);
  return jsonOut({ ok: true });
}

function buildProductRow_(p) {
  var imagesStr = String(p.images || p.image || '');
  var coverImage = imagesStr ? imagesStr.split(IMG_SEP)[0] : '';
  return PRODUCTS_COLS.map(function(col) {
    if (col === 'price') return (p.price===null||p.price===undefined||p.price==='')?'':Number(p.price);
    if (col === 'featured') return (p.featured===true||p.featured==='true'||p.featured===1||p.featured==='1')?'true':'false';
    if (col === 'image') return coverImage;
    if (col === 'images') return imagesStr;
    return (p[col]===undefined||p[col]===null)?'':String(p[col]);
  });
}

function findProductRow_(sheet, id) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return -1;
  for (var i = 1; i < values.length; i++) { if (String(values[i][0]) === String(id)) return i - 1; }
  return -1;
}

function jsonOut(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function setupAllSheets() {
  ensureProductsSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(STOCK_SHEET)) { var s = ss.insertSheet(STOCK_SHEET); s.appendRow(['Product Name','Status']); }
  if (!ss.getSheetByName(ORDERS_SHEET)) { var o = ss.insertSheet(ORDERS_SHEET); o.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes']); }
  SpreadsheetApp.getActiveSpreadsheet().toast('All sheets ready ✔');
}
```

### Deployment steps (do once):
1. Open Google Sheet → Extensions → Apps Script
2. Paste the script above
3. Deploy → New deployment → Web app → Execute as: Me → Access: **Anyone**
4. Copy URL → set as `NEXT_PUBLIC_SHEET_URL` in `.env`

────────────────────────────────────────────────────────────────────────────────
## CLOUDINARY IMAGE HOSTING
────────────────────────────────────────────────────────────────────────────────

Product images are uploaded to Cloudinary (free image CDN). The website's `/api/products` POST route handles this automatically:

1. Admin uploads photo in browser → compressed to 600px JPEG
2. Browser sends base64 to `/api/products`
3. Next.js uploads to Cloudinary → gets permanent URL (80 chars)
4. URL stored in Google Sheet (not the base64 — keeps sheet tiny)

### Setup (2 minutes):
1. Create free account at cloudinary.com
2. Copy your **Cloud Name** from the dashboard
3. Go to Settings → Upload → Add upload preset:
   - Name: `soumdeco` (or any name)
   - Signing mode: **Unsigned**
4. Set in `.env`:
   ```
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=soumdeco
   ```

### Image optimization:
The `ProductImage` component automatically adds `q_auto,f_auto` to Cloudinary URLs → serves WebP format (30-50% smaller) with auto-quality.

────────────────────────────────────────────────────────────────────────────────
## FEATURES (all already implemented in the source)
────────────────────────────────────────────────────────────────────────────────

### Public site (single page, mobile-first):
- **Hero**: Circular logo with brass-gradient ring, brand wordmark (16px gap between words), italic tagline
- **Featured carousel**: Auto-rotating every 2.3s, Framer Motion animations, "Rupture de stock" overlay
- **Categories grid**: Smart icons that adapt to category name (plate, lightning, lamp, sofa, etc.)
- **All products grid**: 2 cols mobile / 4 cols desktop, hover effects, rupture overlay
- **Brand story**: Stats (69 wilayas, +100 clients, 24h), phone CTA
- **Footer**: Logo, contact links, COD note
- **Cart drawer**: Quantity steppers, total, checkout
- **Product modal**: Multi-photo gallery (arrows + dots + thumbnails), COD order form
- **COD order form**: Arabic RTL, phone validation, 58 Algerian wilayas, communes, shipping calculation

### Admin panel (visit /#admin):
- Password-gated (sessionStorage)
- Product list with thumbnails
- Multi-photo upload (drag-drop, max 5, auto-compress to 600px)
- Name, description, category, price, featured checkbox
- Edit/delete/reset
- **No "En stock" checkbox** — stock managed via Google Sheet's Stock tab

### Performance:
- Browser caching (60s + stale-while-revalidate 5min)
- API preloading (`<link rel="preload">`)
- Cloudinary DNS prefetch + preconnect
- Skeleton loading states (no blank page while loading)
- Conditional polling (5.5 min visible, 18 min hidden, immediate on visible)

────────────────────────────────────────────────────────────────────────────────
## REBRANDING INSTRUCTIONS
────────────────────────────────────────────────────────────────────────────────

When rebranding for a new client, change these strings/values throughout the codebase:

### Brand identity:
| What | Where | Example |
|---|---|---|
| Brand name | All files (search "SoumDeco") | "SaidDeco", "DecorDZ", etc. |
| Logo file | `public/logo.jpg` | Replace with new logo |
| Admin password | `src/components/site/admin-panel.tsx` | Change `"dimou2411@dz"` |
| localStorage keys | `src/lib/products.ts` | Change `soumdeco_catalog_v7` → `newbrand_catalog_v1` |

### Contact info (in `site-menu.tsx`, `site-footer.tsx`, `brand-story.tsx`, `cod-order-form.tsx`):
| What | Search for | Example |
|---|---|---|
| Phone | `0541645727` | New phone |
| Instagram | `soumdecodz` | New handle |
| Email | `soumdecorationdz@gmail.com` | New email |
| Facebook | `facebook.com/soumdeco/` | New Facebook URL |

### Shipping prices (if different region/country):
- File: `src/lib/shipping.ts`
- Contains pricing tables for 58 Algerian wilayas (ZR Express + Ecom Delivery)
- Replace with new region's pricing if not Algerian

### Colors (optional — keep Muted Boho Luxe or retune):
- File: `src/app/globals.css`
- CSS variables: `--cream`, `--sand`, `--clay`, `--charcoal`, `--brass`, `--terracotta`, etc.

### Brand story:
- File: `src/components/site/brand-story.tsx`
- Replace the 2 paragraphs + 3 stat boxes with new copy

### Metadata:
- File: `src/app/layout.tsx`
- Update title, description, keywords, OpenGraph

────────────────────────────────────────────────────────────────────────────────
## ENVIRONMENT VARIABLES (.env)
────────────────────────────────────────────────────────────────────────────────

```env
DATABASE_URL=file:/home/z/my-project/db/custom.db

# Google Apps Script web app URL
NEXT_PUBLIC_SHEET_URL=https://script.google.com/macros/s/AKfyc.../exec

# Cloudinary (image hosting)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=soumdeco
```

────────────────────────────────────────────────────────────────────────────────
## ACCEPTANCE CHECKLIST
────────────────────────────────────────────────────────────────────────────────

☐ Site loads with skeleton placeholders (no blank page)
☐ No hydration errors in console
☐ Visit /#admin → password gate → login → empty product list
☐ Admin: add product with photo + featured checked → "Produit enregistré"
☐ Photo uploads to Cloudinary (URL starts with `https://res.cloudinary.com/...`)
☐ Product appears on site within 5.5 min (or instantly on refresh)
☐ Featured product appears in "Produits Vedettes" carousel
☐ Multi-photo gallery works (arrows + dots + thumbnails)
☐ Admin: edit product → change persists
☐ Admin: delete product → gone, does NOT resurrect
☐ No "5 products of reference" or "produits d'origine" text
☐ No "Encountered two children with the same key" errors
☐ Category icons adapt (plate, lightning, lamp, etc.)
☐ Mark product "Out of Stock" in Stock tab → rupture overlay within 5.5 min
☐ Customer submits order → "شكراً لك على طلبك!" + row in Orders tab
☐ Mobile responsive (390px): no h-scroll, drawers fit, modal scrollable
☐ Apps Script deployed with "Anyone" access
☐ No lint errors, no console errors

────────────────────────────────────────────────────────────────────────────────
## START
────────────────────────────────────────────────────────────────────────────────

When given the source archive + sheet template + rebranding spec:

1. Extract the source archive
2. Run `bun install` to install dependencies
3. Search-and-replace all brand strings (see REBRANDING INSTRUCTIONS)
4. Update contact info, shipping prices, brand story, metadata
5. Replace logo file
6. Bump localStorage cache keys (e.g., `soumdeco_catalog_v7` → `newbrand_v1`)
7. Run `bun run lint` to verify no errors
8. Test in browser — verify all acceptance checklist items pass
9. Document any brand-specific changes made

Do NOT change the architecture, Apps Script, Cloudinary integration, polling logic, or any of the bug fixes documented above. These are battle-tested.
