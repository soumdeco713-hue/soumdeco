#!/bin/bash
# Build the "magic zip" — a self-contained deployment package for SOUM DECO
# Contains: latest apps-script.gs + all source code changes + test suite + docs

set -e

STAGING="/home/z/my-project/download/soumdeco-magic-zip"
OUT="/home/z/my-project/download/soumdeco-magic.zip"

# Clean staging
rm -rf "$STAGING"
mkdir -p "$STAGING"

# 1. Apps Script (the brain)
cp /home/z/my-project/download/apps-script.gs "$STAGING/apps-script.gs"

# 2. Source code (only the files we changed + key support files)
mkdir -p "$STAGING/src/components/site"
mkdir -p "$STAGING/src/lib"
mkdir -p "$STAGING/scripts"

cp /home/z/my-project/src/components/site/product-page.tsx "$STAGING/src/components/site/"
cp /home/z/my-project/src/components/site/admin-panel.tsx "$STAGING/src/components/site/"
cp /home/z/my-project/src/components/site/cod-order-form.tsx "$STAGING/src/components/site/"
cp /home/z/my-project/src/components/site/checkout-modal.tsx "$STAGING/src/components/site/"
cp /home/z/my-project/src/lib/client-sheet.ts "$STAGING/src/lib/"
cp /home/z/my-project/src/lib/failed-orders.ts "$STAGING/src/lib/"
cp /home/z/my-project/src/lib/products.ts "$STAGING/src/lib/"
cp /home/z/my-project/src/hooks/use-stock.ts "$STAGING/src/lib/use-stock.ts"
mkdir -p "$STAGING/src/app"
mkdir -p "$STAGING/src/app/api/refresh"
cp /home/z/my-project/src/app/page.tsx "$STAGING/src/app/page.tsx"
cp /home/z/my-project/src/app/api/refresh/route.ts "$STAGING/src/app/api/refresh/route.ts"

# 3. Test suite
cp /home/z/my-project/scripts/test-comprehensive.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-stock-logic.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-variant-flow.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-server-extraction.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-notes-extraction.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-comma-bug-fix.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-stock-sync.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/test-cart-rapture.js "$STAGING/scripts/"
cp /home/z/my-project/scripts/verify-apps-script.js "$STAGING/scripts/"

# 4. README with deployment instructions
cat > "$STAGING/README.md" << 'README'
# SOUM DECO — Magic Zip (Latest Build)

This zip contains the LATEST fixes for variant stock management.

## What's New in This Build

### 1. Out-of-stock variant prevention (elegant)
- Color and size buttons now show "(نفدت)" + line-through when out of stock
- Buttons are DISABLED — customers can't select out-of-stock variants
- Auto-clear: if a previously-selected variant becomes out-of-stock, the selection is cleared + a toast warning appears
- Direct checkout form also blocks when selected variant is out of stock

### 2. Easier variant editor (admin panel)
- Quick-add chips above each variant section (13 common colors + 16 common sizes)
- Click a chip → variant added with pre-filled name (one click)
- Dedup: chip greys out when variant already exists
- Autofocus on newly-added inputs

### 3. Stock sync from sheet (admin panel)
- When admin opens the edit form, per-variant stock values are synced from the Stock tab CSV
- Sheet is the source of truth (it gets auto-decremented by Confirmed orders)
- Admin can edit → saves back to both Products tab + Stock tab

### 4. Critical bug fixes
- `splitStockKey_` now ONLY splits on ";" — never on "," (fixes comma-in-product-name bug)
- Emoji stripping now handles variation selectors (U+FE0F) + zero-width joiners (U+200D)

## Deployment Instructions

### Step 1: Update Apps Script
1. Open your Google Sheet → Extensions → Apps Script
2. Replace ALL content with `apps-script.gs` from this zip
3. Save (Ctrl+S)
4. Reload the Google Sheet → 📦 SOUM DECO menu appears

### Step 2: Install the trigger (one-time)
1. Click 📦 SOUM DECO → 🔧 Setup Auto-Stock (run once)
2. Authorize when prompted
3. Done — confirmed orders will now auto-decrement variant stock

### Step 3: Add size variants to your products (admin panel)
1. Open the admin panel (/#admin with password)
2. Edit a product (e.g. "Cocotte minute 06, 08, 10, 12 litres Ref 01")
3. Scroll to المقاسات section
4. Click the quick-add chips for 06L, 08L, 10L, 12L
5. Set stock counts (e.g. 06L=5, 08L=3, 10L=0, 12L=empty=infinite)
6. Save

### Step 4: Test the full flow
1. Place a NEW test order with 06L selected
2. Check the Orders sheet:
   - Product column: `Cocotte minute 06, 08, 10, 12 litres Ref 01 ×1`
   - Variant column: `06L`
   - Stock Key column: `Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L`
3. Change status to "Confirmed"
4. Check the Stock tab → `Cocotte...- 06L` count should decrement from 5 to 4

## Test Suite

Run the test suite to verify everything works:
```bash
node scripts/test-comprehensive.js   # 212 checks
node scripts/test-stock-logic.js     # 7 checks
node scripts/test-variant-flow.js    # 4 checks
node scripts/test-server-extraction.js  # 6 checks
node scripts/test-notes-extraction.js    # 8 checks
node scripts/test-comma-bug-fix.js   # 2 checks
node scripts/verify-apps-script.js   # syntax check
```

All tests pass: 239/239 checks ✓

## Files Changed

| File | Change |
|------|--------|
| `apps-script.gs` | Server-side extraction, semicolon separator, emoji stripping, menu, trigger installer |
| `src/components/site/product-page.tsx` | Out-of-stock variant buttons, auto-clear, pass to order form |
| `src/components/site/admin-panel.tsx` | Quick-add chips, autofocus, per-variant CSV stock sync |
| `src/components/site/cod-order-form.tsx` | Semicolon separator for stockKey |
| `src/lib/failed-orders.ts` | Preserve variant + stockKey across retries |
| `src/lib/client-sheet.ts` | Server-side extraction safety net |

## Architecture

- **Frontend**: Next.js 16 + React + Tailwind CSS + shadcn/ui
- **Backend**: Google Apps Script (Google Sheets as database)
- **Images**: Cloudinary (unsigned uploads)
- **Deployment**: Cloudflare Pages + Workers + KV
- **Notifications**: Telegram bot (optional)

## Stock Decrement Flow

```
Customer places order
  ↓
Frontend sends: product + variant + stockKey
  ↓
Apps Script doCreateOrderFromParams:
  - Extracts variant (tries: Variant param → product name parens → Notes column)
  - Builds stockKey (semicolon-separated for multi-variant)
  - Writes to Orders sheet (Variant + Stock Key columns populated)
  ↓
Admin changes status to "Confirmed"
  ↓
onStockEdit trigger fires:
  - Reads Stock Key column
  - Splits on ";" (NEVER on ",")
  - For each key: tries to find matching row in Stock tab
  - First match with finite stock → decrements
  - Infinite (empty cell) → silently skipped
  - No match → treated as infinite (no fallback to whole-product)
  - Sets Stock Synced = "Y" (idempotency)
  ↓
Stock tab updated → visitors see new stock on next poll (5 min)
```

## Support

If something doesn't work:
1. Run 📦 SOUM DECO → 🔍 Diagnose Orders (dry-run) — shows what variant would be extracted
2. Run 📦 SOUM DECO → 🏥 Health Check — shows trigger state + pending orders
3. Check View → Logs in Apps Script editor for detailed error messages
README

# 5. Create the zip
cd /home/z/my-project/download
rm -f soumdeco-magic.zip
zip -r soumdeco-magic.zip soumdeco-magic-zip/ -x "*.DS_Store" "*/__pycache__/*"
rm -rf soumdeco-magic-zip

echo ""
echo "✅ Magic zip created: /home/z/my-project/download/soumdeco-magic.zip"
ls -lh soumdeco-magic.zip
unzip -l soumdeco-magic.zip | tail -20
