// ============================================================
//  setupToken — PUBLIC wrapper for setAdminToken_ (which is private)
//  Run this ONCE from the Apps Script editor dropdown to set the admin token.
//  When prompted, enter the token from Cloudflare env var APPS_SCRIPT_ADMIN_TOKEN.
// ============================================================
function setupToken() {
  setAdminToken_();
}

/**
 * ============================================================
 *  SoumDecoDZ — Apps Script (ORDERS + STOCK + PRODUCTS)
 * ============================================================
 *
 *  Products: stored in Google Sheet (product data) + Cloudinary (images)
 *  Orders:   stored in Google Sheet (Orders tab)
 *  Stock:    stored in Google Sheet (Stock tab)
 *
 *  GET  ?action=stock              → Stock tab as CSV (polled every 10 min)
 *  GET  ?action=products           → Products tab as JSON (polled every 10 min)
 *  GET  ?action=order&...          → append order row
 *  POST ?action=product_create     → upsert product (JSON body, no URL limit)
 *  GET  ?action=product_delete&id= → delete by id
 *  GET  ?action=product_reset      → wipe Products tab
 *  GET  ?action=process_confirmed  → manually process pending Confirmed orders
 *
 *  STOCK RULE (IMPORTANT):
 *  - Empty stock cell  = INFINITE (unlimited — never decrement, never revert)
 *  - Stock cell = 0     = OUT OF STOCK (visitors see "نفدت الكمية")
 *  - Stock cell = N     = N items left (low-stock badge at 1-3)
 * ============================================================
 */

var ORDERS_SHEET = 'Orders';
var STOCK_SHEET = 'Stock';
var PRODUCTS_SHEET = 'Products';
var PRODUCTS_COLS = ['id', 'name', 'description', 'category', 'price', 'image', 'images', 'featured', 'isSpecialOffer', 'variations', 'variants', 'stock', 'highlights', 'sortOrder', 'badge', 'oldPrice', 'quantityTiers'];
var IMG_SEP = '~~~';

// Orders sheet column positions (1-indexed in the sheet, 0-indexed here).
// These MUST match the order in the appendRow() call inside doCreateOrderFromParams.
var ORDERS_COL = {
  DATE: 0, STATUS: 1, PRODUCT: 2, QTY: 3, UNIT_PRICE: 4,
  SHIPPING: 5, TOTAL: 6, CUSTOMER: 7, PHONE: 8, WILAYA: 9,
  COMMUNE: 10, DELIVERY: 11, COMPANY: 12, NOTES: 13,
  VARIANT: 14, STOCK_KEY: 15, STOCK_SYNCED: 16
};

// Statuses that mean "stock has been consumed" — decrement on entry, revert on cancel.
var STOCK_DECREMENTED = ['confirmed', 'shipped', 'delivered'];

// ============================================================
//  ADMIN TOKEN — protects WRITE operations only
// ============================================================
//  Reads (products, stock, order) stay PUBLIC (visitors need them).
//  Writes (product_create, product_delete, etc.) require this token.
//
//  The token is checked via the X-Admin-Token header.
//  Set this to the SAME value as the Cloudflare env var
//  APPS_SCRIPT_ADMIN_TOKEN.
//
//  ⚠️  To set this token:
//   1. Run the function 'setAdminToken_' once from the Apps Script editor
//      (it will prompt you to enter the token value)
//   2. The token is stored in the script's PropertiesService (encrypted at rest)
//   3. To change it later, run 'setAdminToken_' again
// ============================================================
function setAdminToken_() {
  var ui = SpreadsheetApp.getActiveSpreadsheet().getUi();
  var response = ui.prompt('Set Admin Token', 'Enter the admin token (from Cloudflare env var APPS_SCRIPT_ADMIN_TOKEN):', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() === ui.Button.OK) {
    var token = response.getResponseText().trim();
    if (token) {
      PropertiesService.getScriptProperties().setProperty('ADMIN_TOKEN', token);
      ui.alert('✅ Admin token saved. Write operations now require this token.');
    }
  }
}

function getAdminToken_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '';
}

/** Check if the request has a valid admin token (for write operations). */
function isAuthorized_(e) {
  var token = getAdminToken_();
  if (!token) return true; // ⚠️ If no token set, allow all (backwards compat)
  // Read admin_token from URL params, POST body, AND header (max compat)
  var p = (e && e.parameter) || {};
  var headers = (e && e.headers) || {};
  var provided = p.admin_token || headers['X-Admin-Token'] || headers['x-admin-token'] || '';
  // Fallback: check POST body for _admin_token (Cloudflare edge may lose URL params)
  if (!provided && e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      if (body._admin_token) provided = body._admin_token;
    } catch (err) {}
  }
  return provided === token;
}

function doGet(e) {
  e = e || {}; var p = e.parameter || {};
  var action = String(p.action || '').toLowerCase();
  try {
    // ─── PUBLIC OPERATIONS (no auth required) ──────────────
    if (action === 'stock') return serveStock();
    if (action === 'products') return serveProducts();
    if (action === 'order') return doCreateOrderFromParams(p);
    if (action === 'health') return jsonOut({ ok: true, time: new Date().toISOString(), sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
    if (action === 'statistics') return setupStatistics();
    if (action === 'process_confirmed') return doProcessConfirmedFromUrl();

    // ─── PROTECTED OPERATIONS (require admin token) ───────
    if (action === 'product_delete' || action === 'product_reset' ||
        action === 'dedupe' || action === 'cleanup') {
      if (!isAuthorized_(e)) {
        return jsonOut({ ok: false, error: 'unauthorized', message: 'Admin token required for write operations' });
      }
    }
    if (action === 'product_delete') return doDeleteProduct(p.id || '');
    if (action === 'product_reset') return doResetProducts();
    if (action === 'dedupe') return doDedupeProducts();
    if (action === 'cleanup') return doCleanupSheet();

    return jsonOut({ ok: false, error: 'unknown action: ' + action });
  } catch (err) { return jsonOut({ ok: false, error: String(err) }); }
}

function doPost(e) {
  e = e || {}; var p = e.parameter || {};
  var action = String(p.action || '').toLowerCase();
  try {
    // Fallback: if action not in URL params, read from POST body
    // (Cloudflare edge fetch may lose URL params on 302 redirect)
    if (!action && e && e.postData && e.postData.contents) {
      try {
        var bodyObj = JSON.parse(e.postData.contents);
        if (bodyObj._action) action = String(bodyObj._action).toLowerCase();
      } catch (err) {}
    }

    if (action === 'product_create' || action === 'product_update') {
      // PROTECTED — require admin token
      if (!isAuthorized_(e)) {
        return jsonOut({ ok: false, error: 'unauthorized', message: 'Admin token required for write operations' });
      }
      var bodyStr = e.postData ? e.postData.contents : '';
      var prod = bodyStr ? JSON.parse(bodyStr) : p;
      // Remove internal fields (not product data)
      if (prod._action) delete prod._action;
      if (prod._admin_token) delete prod._admin_token;
      if (prod.action) delete prod.action;
      return doCreateProduct(prod);
    }
    return doGet(e);
  } catch (err) { return jsonOut({ ok: false, error: String(err) }); }
}

// ============================================================
//  CUSTOM MENU — appears when the spreadsheet is opened.
//  Lets the admin install triggers + process pending orders
//  with ONE click — no need to dig into Apps Script settings.
// ============================================================
function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('📦 SOUM DECO', [
    { name: '🔍 Diagnose Orders (dry-run — check what variant would be extracted)', functionName: 'diagnoseOrders' },
    { name: '🔧 Setup Auto-Stock (run once)', functionName: 'setupTriggers' },
    { name: '✅ Process Pending Confirmed Orders', functionName: 'processAllConfirmedOrders' },
    { name: '📊 Update Statistics Dashboard', functionName: 'setupStatistics' },
    { name: '🧹 Cleanup Products Sheet', functionName: 'doCleanupSheet' },
    { name: '🏥 Health Check', functionName: 'healthCheck' }
  ]);
}

/**
 * healthCheck — quick diagnostic that logs the state of triggers + sheets.
 * Useful for debugging "why isn't stock decrementing" issues.
 */
function healthCheck() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  var hasOnEdit = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onStockEdit') hasOnEdit = true;
  }
  var ordersSheet = ss.getSheetByName(ORDERS_SHEET);
  var stockSheet = ss.getSheetByName(STOCK_SHEET);
  var ordersRows = ordersSheet ? ordersSheet.getLastRow() - 1 : 0;
  var stockRows = stockSheet ? stockSheet.getLastRow() - 1 : 0;

  var msg = '===== SOUM DECO HEALTH CHECK =====\n';
  msg += 'onEdit trigger installed: ' + (hasOnEdit ? 'YES ✅' : 'NO ❌ (run "Setup Auto-Stock" once)') + '\n';
  msg += 'Total triggers: ' + triggers.length + '\n';
  msg += 'Orders sheet: ' + (ordersSheet ? 'YES (' + ordersRows + ' rows)' : 'MISSING ❌') + '\n';
  msg += 'Stock sheet: ' + (stockSheet ? 'YES (' + stockRows + ' rows)' : 'MISSING ❌') + '\n';

  if (ordersSheet && ordersRows > 0) {
    var data = ordersSheet.getRange(2, 1, Math.min(ordersRows, 10), ORDERS_COL.STOCK_SYNCED + 1).getValues();
    var pending = 0;
    var unsynced = 0;
    for (var j = 0; j < data.length; j++) {
      var status = String(data[j][ORDERS_COL.STATUS] || '').trim().toLowerCase();
      var synced = String(data[j][ORDERS_COL.STOCK_SYNCED] || '').trim().toLowerCase();
      if (STOCK_DECREMENTED.indexOf(status) >= 0) {
        pending++;
        if (synced !== 'y') unsynced++;
      }
    }
    msg += 'Recent confirmed orders (last 10): ' + pending + '\n';
    msg += 'Of which NOT yet stock-synced: ' + unsynced + (unsynced > 0 ? ' ⚠️ run "Process Pending Confirmed Orders"' : ' ✅') + '\n';
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Health Check', 15);
  return jsonOut({ ok: true, message: msg });
}

/**
 * diagnoseOrders — DRY-RUN diagnostic that shows what variant + stockKey
 * would be extracted from each row WITHOUT writing anything.
 * Run this if "Process Pending Confirmed Orders" errors out.
 *
 * Output goes to: View → Logs (in the Apps Script editor)
 * Returns: JSON summary with row count + first 10 sample rows.
 */
function diagnoseOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  if (!sheet) return jsonOut({ ok: false, error: 'No Orders sheet' });

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  Logger.log('=== DIAGNOSE ORDERS ===');
  Logger.log('Sheet lastRow=' + lastRow + ' lastCol=' + lastCol);

  if (lastRow < 2) {
    Logger.log('No data rows');
    return jsonOut({ ok: true, message: 'No data rows' });
  }

  // Read whatever columns actually exist (defensive — don't ask for col 17 if sheet has only 14)
  var readCols = Math.max(lastCol, ORDERS_COL.STOCK_SYNCED + 1);
  var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();
  Logger.log('Read ' + data.length + ' rows × ' + readCols + ' cols');

  var samples = [];
  var withVariant = 0;
  var withoutVariant = 0;
  var confirmed = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var status = String(row[ORDERS_COL.STATUS] || '').trim();
    var productName = String(row[ORDERS_COL.PRODUCT] || '').trim();
    var notes = String(row[ORDERS_COL.NOTES] || '').trim();
    var existingVariant = row.length > ORDERS_COL.VARIANT ? String(row[ORDERS_COL.VARIANT] || '').trim() : '';
    var existingStockKey = row.length > ORDERS_COL.STOCK_KEY ? String(row[ORDERS_COL.STOCK_KEY] || '').trim() : '';

    var extracted = extractVariantFromRow_(productName, notes, existingVariant, existingStockKey);

    if (extracted.variant) withVariant++; else withoutVariant++;
    if (STOCK_DECREMENTED.indexOf(status.toLowerCase()) >= 0) confirmed++;

    if (i < 10) {
      samples.push({
        row: i + 2,
        status: status,
        product: productName.substring(0, 60),
        notes: notes.substring(0, 80),
        existingVariant: existingVariant,
        extractedVariant: extracted.variant,
        extractedStockKey: extracted.stockKey,
      });
    }
  }

  Logger.log('=== SUMMARY ===');
  Logger.log('Total rows: ' + data.length);
  Logger.log('Rows with extractable variant: ' + withVariant);
  Logger.log('Rows without variant info: ' + withoutVariant);
  Logger.log('Confirmed/Shipped/Delivered: ' + confirmed);
  Logger.log('=== FIRST 10 ROWS ===');
  for (var s = 0; s < samples.length; s++) {
    Logger.log('Row ' + samples[s].row + ': status=' + samples[s].status);
    Logger.log('  product: ' + samples[s].product);
    Logger.log('  notes:   ' + samples[s].notes);
    Logger.log('  existing variant: ' + samples[s].existingVariant);
    Logger.log('  extracted variant: ' + samples[s].extractedVariant);
    Logger.log('  extracted stockKey: ' + samples[s].extractedStockKey);
  }

  var msg = 'Total: ' + data.length + ' | With variant: ' + withVariant + ' | Without: ' + withoutVariant + ' | Confirmed: ' + confirmed + '. See View → Logs for details.';
  ss.toast(msg, 'Diagnose Complete', 15);
  return jsonOut({ ok: true, total: data.length, withVariant: withVariant, withoutVariant: withoutVariant, confirmed: confirmed, samples: samples });
}

/**
 * extractVariantFromRow_ — extract variant + stockKey from a row.
 * Tries FOUR sources in order:
 *   1. Existing Variant column (already populated)
 *   2. Product name parentheses  "(المقاس: 06L)"
 *   3. Notes column patterns     "المقاس: 06L · ..." (where variant is currently being written)
 *   4. Returns empty if none found
 *
 * Returns: { variant: string, stockKey: string }
 */
function extractVariantFromRow_(productName, notes, existingVariant, existingStockKey) {
  var variantStr = String(existingVariant || '').trim();
  var stockKeyStr = String(existingStockKey || '').trim();
  if (stockKeyStr) return { variant: variantStr, stockKey: stockKeyStr }; // already have both

  // Strip trailing ×N
  var bareName = String(productName || '').replace(/\s*[×x]\s*\d+\s*$/, '').trim();

  // ─── SOURCE 1: existing variant column ───────────────────────
  if (variantStr) {
    return buildStockKey_(bareName, variantStr);
  }

  // ─── SOURCE 2: product name parentheses ──────────────────────
  var variantMatch = bareName.match(/\(([^)]+)\)\s*$/);
  if (variantMatch) {
    var extractedVariant = parseVariantContent_(variantMatch[1]);
    if (extractedVariant) {
      return buildStockKey_(bareName, extractedVariant);
    }
  }

  // ─── SOURCE 3: notes column (current frontend writes variant here) ──
  // Notes format: "اللون: Blue · المقاس: Large · [user notes] · [company]"
  // Or just: "المقاس: 06L"
  if (notes) {
    var notesVariant = extractVariantFromNotes_(notes);
    if (notesVariant) {
      return buildStockKey_(bareName, notesVariant);
    }
  }

  return { variant: '', stockKey: '' };
}

/** Parse the content inside parentheses: "اللون: Red · المقاس: Large" → "Red - Large" */
function parseVariantContent_(content) {
  var parts = String(content || '').split('·');
  var values = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var colonIdx = part.lastIndexOf(':');
    if (colonIdx >= 0) {
      var value = part.substring(colonIdx + 1).trim();
      // Strip emojis + variation selectors + normalize whitespace
      value = value
        .replace(/[\u{1F000}-\u{1FFFF}]/u, '')
        .replace(/[\u{2600}-\u{27BF}]/u, '')
        .replace(/[\uFE0F\u200D]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (value) values.push(value);
    } else if (part) {
      values.push(part);
    }
  }
  return values.join(' - ');
}

/** Extract variant from notes — looks for "Label: value" patterns. */
function extractVariantFromNotes_(notes) {
  var notesStr = String(notes || '').trim();
  if (!notesStr) return '';

  // Common Arabic + French variant labels (lowercased comparison)
  var labels = [
    'المقاس', 'اللون', 'الحجم', 'الوزن', 'النوع', 'النموذج',
    'Taille', 'Couleur', 'Modèle', 'Size', 'Color'
  ];

  var parts = notesStr.split('·');
  var values = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var colonIdx = part.lastIndexOf(':');
    if (colonIdx < 0) continue;
    var label = part.substring(0, colonIdx).trim().toLowerCase();
    var value = part.substring(colonIdx + 1).trim();
    if (!value) continue;

    var isVariant = false;
    for (var l = 0; l < labels.length; l++) {
      if (label === labels[l].toLowerCase()) { isVariant = true; break; }
    }

    if (isVariant) {
      // Strip emojis + variation selectors (U+FE0F) + zero-width joiners (U+200D)
      // and normalize whitespace. This handles cases like "06L 🚚" → "06L"
      // and "Red ❤️" → "Red" (the heart has a variation selector).
      value = value
        .replace(/[\u{1F000}-\u{1FFFF}]/u, '')
        .replace(/[\u{2600}-\u{27BF}]/u, '')
        .replace(/[\uFE0F\u200D]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (value) values.push(value);
    }
  }
  return values.join(' - ');
}

/** Build stockKey from cleanProductName + variantStr.
 *  "Cocotte...Ref 01" + "06L" → "Cocotte...Ref 01 - 06L"
 *  "Cocotte...Ref 01" + "Red - Large" → "Cocotte...Ref 01 - Red;Cocotte...Ref 01 - Large"
 *
 *  IMPORTANT: Uses ";" as separator (NOT ",") because product names can contain
 *  commas (e.g. "Cocotte minute 06, 08, 10, 12 litres Ref 01"). Using ";" ensures
 *  we can reliably split the stockKey back into individual keys later.
 */
function buildStockKey_(bareName, variantStr) {
  var cleanProductName = String(bareName || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
  var variantValues = String(variantStr || '').split(' - ');
  var keys = [];
  for (var k = 0; k < variantValues.length; k++) {
    var v = variantValues[k].trim();
    if (v) keys.push(cleanProductName + ' - ' + v);
  }
  return { variant: variantStr, stockKey: keys.join(';') };
}

/** Split stockKey into individual keys.
 *  ONLY splits on ";" (the new separator that handles product names with commas).
 *
 *  NEVER splits on "," — because product names can contain commas
 *  (e.g. "Cocotte minute 06, 08, 10, 12 litres Ref 01"). Splitting on ","
 *  would break a single valid key into fragments.
 *
 *  Legacy comma-format stockKeys (from before the semicolon fix) are
 *  treated as a SINGLE key here. If they were multi-key comma-format,
 *  they were already broken (the comma-in-product-name bug) and won't
 *  match — admin should run "Process Pending Confirmed Orders" to
 *  re-extract variants with the new semicolon format.
 */
function splitStockKey_(stockKeyStr) {
  if (!stockKeyStr) return [];
  var s = String(stockKeyStr).trim();
  if (!s) return [];
  // Only split on ";" — never on ","
  if (s.indexOf(';') >= 0) return s.split(';');
  return [s]; // single key (even if it contains commas)
}

/**
 * ============================================================
 *  setupTriggers — installs the onEdit trigger AUTOMATICALLY.
 *  Run this ONCE from the Apps Script editor or the spreadsheet menu.
 *  After running, all status changes to "Confirmed" / "Cancelled"
 *  will auto-decrement / revert stock with no further setup.
 *
 *  Re-running is safe — duplicates are detected + removed.
 * ============================================================
 */
function setupTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  var existing = 0;
  for (var i = 0; i < triggers.length; i++) {
    var t = triggers[i];
    if (t.getHandlerFunction() === 'onStockEdit') {
      existing++;
      // Remove duplicates (keep only the first one)
      if (existing > 1) {
        ScriptApp.deleteTrigger(t);
      }
    }
  }
  if (existing === 0) {
    ScriptApp.newTrigger('onStockEdit')
      .forSpreadsheet(ss)
      .onEdit()
      .create();
  }
  // Also ensure sheets exist with the right headers
  setupAllSheets();
  ss.toast('✅ Auto-stock trigger installed. Confirmed orders will now decrement variant stock automatically.', 'Setup Complete', 10);
}

/**
 * processAllConfirmedOrders — manually scans ALL Confirmed orders that
 * haven't been stock-synced yet and processes them. Useful when:
 *   - The trigger was just installed (catch up on past orders)
 *   - The trigger failed for some reason
 *   - You imported orders from another source
 *
 * Uses the "Stock Synced" column for idempotency — safe to run multiple times.
 *
 * SAFETY: This function NEVER errors out on a single bad row — it logs the
 * error and continues. Returns a detailed summary at the end.
 */
function processAllConfirmedOrders() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ORDERS_SHEET);
  if (!sheet) return jsonOut({ ok: false, error: 'No Orders sheet' });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOut({ ok: true, processed: 0, message: 'No orders to process' });

  // Ensure headers exist (extends sheet if needed)
  ensureOrdersHeaders_(sheet);

  // Defensive: read whatever columns actually exist, padded to at least 17
  var readCols = Math.max(sheet.getLastColumn(), ORDERS_COL.STOCK_SYNCED + 1);
  var data = sheet.getRange(2, 1, lastRow - 1, readCols).getValues();

  var processed = 0;
  var skipped = 0;
  var errors = 0;
  var errorDetails = [];

  // Collect writes to do in batches (much faster than 1-by-1 setValue)
  var variantUpdates = []; // [{ rowIdx, value }]
  var stockKeyUpdates = [];
  var syncedUpdates = [];

  for (var i = 0; i < data.length; i++) {
    try {
      var row = data[i];
      // Pad row if shorter than expected
      while (row.length < ORDERS_COL.STOCK_SYNCED + 1) row.push('');

      var status = String(row[ORDERS_COL.STATUS] || '').trim().toLowerCase();
      var synced = String(row[ORDERS_COL.STOCK_SYNCED] || '').trim().toLowerCase();

      // Only process Confirmed/Shipped/Delivered orders that haven't been synced
      if (STOCK_DECREMENTED.indexOf(status) < 0) {
        skipped++;
        continue;
      }
      if (synced === 'y') {
        skipped++;
        continue;
      }

      var productName = String(row[ORDERS_COL.PRODUCT] || '').trim();
      var notes = String(row[ORDERS_COL.NOTES] || '').trim();
      var existingVariant = String(row[ORDERS_COL.VARIANT] || '').trim();
      var existingStockKey = String(row[ORDERS_COL.STOCK_KEY] || '').trim();
      var qtyRaw = row[ORDERS_COL.QTY];
      var qty = (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined) ? 1 : parseInt(String(qtyRaw), 10);
      if (isNaN(qty) || qty < 1) qty = 1;

      // Multi-item orders (contain "+") — skip (can't reliably split)
      if (productName.indexOf('+') >= 0) {
        skipped++;
        continue;
      }

      // Strip trailing ×N
      var bareName = productName.replace(/\s*[×x]\s*\d+\s*$/, '').trim();
      if (!bareName) {
        skipped++;
        continue;
      }

      // Use the unified extractor (tries Variant col, then product name, then notes)
      var extracted = extractVariantFromRow_(productName, notes, existingVariant, existingStockKey);
      var variantStr = extracted.variant;
      var stockKeyStr = extracted.stockKey;

      // Queue writes (will be applied in batch after the loop)
      if (variantStr && variantStr !== existingVariant) {
        variantUpdates.push({ rowIdx: i + 2, value: variantStr });
      }
      if (stockKeyStr && stockKeyStr !== existingStockKey) {
        stockKeyUpdates.push({ rowIdx: i + 2, value: stockKeyStr });
      }

      // ─── DECREMENT STOCK ──────────────────────────────────────
      var decremented = false;

      // Try stockKey FIRST (variant match)
      if (stockKeyStr) {
        var keys = splitStockKey_(stockKeyStr);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k].trim();
          if (!key) continue;
          if (decrementStockByKey_(key, qty)) {
            decremented = true;
            break;
          }
        }
        // IMPORTANT: if stockKey was set but no match found in Stock tab,
        // the variant is INFINITE — DO NOT fall back to whole-product decrement.
      } else {
        // No stockKey at all → no variant info extractable → try whole-product decrement
        decrementProductStock_(bareName, qty);
        decremented = true; // even if infinite, mark synced
      }

      // Queue the synced flag update
      syncedUpdates.push({ rowIdx: i + 2, value: 'Y' });
      if (decremented) processed++; else skipped++;

    } catch (err) {
      errors++;
      errorDetails.push({ row: i + 2, error: String(err) });
      Logger.log('[processAllConfirmedOrders] row ' + (i + 2) + ' error: ' + err);
    }
  }

  // ─── APPLY BATCH WRITES ─────────────────────────────────────
  try {
    for (var v = 0; v < variantUpdates.length; v++) {
      sheet.getRange(variantUpdates[v].rowIdx, ORDERS_COL.VARIANT + 1).setValue(variantUpdates[v].value);
    }
    for (var sk = 0; sk < stockKeyUpdates.length; sk++) {
      sheet.getRange(stockKeyUpdates[sk].rowIdx, ORDERS_COL.STOCK_KEY + 1).setValue(stockKeyUpdates[sk].value);
    }
    for (var sy = 0; sy < syncedUpdates.length; sy++) {
      sheet.getRange(syncedUpdates[sy].rowIdx, ORDERS_COL.STOCK_SYNCED + 1).setValue(syncedUpdates[sy].value);
    }
  } catch (writeErr) {
    Logger.log('[processAllConfirmedOrders] batch write error: ' + writeErr);
    errors++;
    errorDetails.push({ row: 0, error: 'Batch write error: ' + writeErr });
  }

  var msg = '✅ Processed: ' + processed + ' | Skipped: ' + skipped + ' | Errors: ' + errors;
  if (variantUpdates.length > 0) msg += ' | Variants backfilled: ' + variantUpdates.length;
  if (stockKeyUpdates.length > 0) msg += ' | Stock Keys backfilled: ' + stockKeyUpdates.length;
  ss.toast(msg, 'Stock Sync Complete', 15);

  Logger.log('=== processAllConfirmedOrders DONE ===');
  Logger.log('Processed: ' + processed + ' | Skipped: ' + skipped + ' | Errors: ' + errors);
  Logger.log('Variant backfills: ' + variantUpdates.length + ' | StockKey backfills: ' + stockKeyUpdates.length);
  if (errorDetails.length > 0) {
    Logger.log('Errors:');
    for (var e = 0; e < errorDetails.length; e++) {
      Logger.log('  Row ' + errorDetails[e].row + ': ' + errorDetails[e].error);
    }
  }

  return jsonOut({
    ok: true,
    processed: processed,
    skipped: skipped,
    errors: errors,
    errorDetails: errorDetails,
    variantsBackfilled: variantUpdates.length,
    stockKeysBackfilled: stockKeyUpdates.length,
  });
}

// Wrapper for URL invocation
function doProcessConfirmedFromUrl() {
  return processAllConfirmedOrders();
}

// ============================================================
//  ORDERS
// ============================================================

function doCreateOrderFromParams(p) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET);
    sheet.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes','Variant','Stock Key','Stock Synced']);
  }
  // Auto-add 'Variant' + 'Stock Key' + 'Stock Synced' columns if they don't exist
  ensureOrdersHeaders_(sheet);

  // ============================================================
  //  SERVER-SIDE VARIANT EXTRACTION (safety net)
  // ============================================================
  var productStr = String(p.product || '');
  var notesStr = String(p.notes || '');
  var extracted = extractVariantFromRow_(productStr, notesStr, p.variant || '', p.stockKey || '');
  var variantStr = extracted.variant;
  var stockKeyStr = extracted.stockKey;

  sheet.appendRow([
    new Date(), 'New',
    productStr, Number(p.quantity) || 1,
    (p.price === null || p.price === undefined || p.price === '') ? '' : Number(p.price),
    Number(p.shippingPrice) || 0, Number(p.grandTotal) || 0,
    p.fullName || '', p.phone || '', p.wilaya || '', p.commune || '',
    p.deliveryLabel || '', p.shippingCompanyLabel || '', notesStr,
    variantStr, stockKeyStr, ''  // Stock Synced = empty (not yet processed)
  ]);
  return jsonOut({ ok: true, variant: variantStr, stockKey: stockKeyStr });
}

/** Ensure Orders sheet has the Variant, Stock Key, and Stock Synced columns. */
function ensureOrdersHeaders_(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), ORDERS_COL.STOCK_SYNCED + 1)).getValues()[0];
  if (!headerRow[ORDERS_COL.VARIANT] || String(headerRow[ORDERS_COL.VARIANT]).trim() !== 'Variant') {
    sheet.getRange(1, ORDERS_COL.VARIANT + 1).setValue('Variant');
  }
  if (!headerRow[ORDERS_COL.STOCK_KEY] || String(headerRow[ORDERS_COL.STOCK_KEY]).trim() !== 'Stock Key') {
    sheet.getRange(1, ORDERS_COL.STOCK_KEY + 1).setValue('Stock Key');
  }
  if (!headerRow[ORDERS_COL.STOCK_SYNCED] || String(headerRow[ORDERS_COL.STOCK_SYNCED]).trim() !== 'Stock Synced') {
    sheet.getRange(1, ORDERS_COL.STOCK_SYNCED + 1).setValue('Stock Synced');
  }
}

// ============================================================
//  STOCK
// ============================================================

function serveStock() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) { sheet = ss.insertSheet(STOCK_SHEET); sheet.appendRow(['Product Name','Stock Count']); }
  var headerRow = sheet.getRange(1, 1, 1, 2).getValues()[0];
  if (String(headerRow[0]||'') !== 'Product Name' || String(headerRow[1]||'') !== 'Stock Count') {
    sheet.getRange(1, 1, 1, 2).setValues([['Product Name','Stock Count']]);
  }
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (i === 1 && r[0] && /[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(String(r[0]))) continue;
    rows.push(r.map(function(c){ return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','));
  }
  var csv = rows.join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

// ============================================================
//  PRODUCTS
// ============================================================

function ensureProductsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRODUCTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PRODUCTS_SHEET);
    sheet.appendRow(PRODUCTS_COLS);
    return sheet;
  }
  var headerRow = sheet.getRange(1, 1, 1, PRODUCTS_COLS.length).getValues()[0];
  var needsFix = false;
  for (var i = 0; i < PRODUCTS_COLS.length; i++) {
    if (String(headerRow[i] || '') !== PRODUCTS_COLS[i]) { needsFix = true; break; }
  }
  if (needsFix) {
    sheet.getRange(1, 1, 1, PRODUCTS_COLS.length).setValues([PRODUCTS_COLS]);
  }
  return sheet;
}

function serveProducts() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut([]);
  var header = values[0];
  var out = [];
  var seenIds = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    var idStr = String(r[0]);
    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idStr)) continue;
    if (seenIds[idStr]) continue;
    seenIds[idStr] = true;
    var obj = {};
    for (var j = 0; j < header.length; j++) obj[header[j]] = r[j];
    obj.price = (obj.price===''||obj.price===null||obj.price===undefined)?null:Number(obj.price);
    obj.oldPrice = (obj.oldPrice===''||obj.oldPrice===null||obj.oldPrice===undefined)?null:Number(obj.oldPrice);
    obj.featured = (obj.featured===true||obj.featured===1||obj.featured==='1'||(typeof obj.featured==='string'&&obj.featured.toLowerCase()==='true'));
    obj.isSpecialOffer = (obj.isSpecialOffer===true||obj.isSpecialOffer===1||obj.isSpecialOffer==='1'||(typeof obj.isSpecialOffer==='string'&&obj.isSpecialOffer.toLowerCase()==='true'));
    obj.stock = (obj.stock===''||obj.stock===null||obj.stock===undefined)?null:Number(obj.stock);
    obj.variants = obj.variants==null?'':String(obj.variants);
    if ((!obj.images||String(obj.images).trim()==='')&&obj.image) obj.images = String(obj.image);
    if (obj.category) {
      var cat = String(obj.category).trim();
      if (cat === 'Meubes') cat = 'Meubles';
      obj.category = cat;
    }
    out.push(obj);
  }
  return jsonOut(out);
}

function doCreateProduct(p) {
  var sheet = ensureProductsSheet();
  if (findProductRow_(sheet, p.id) >= 0) return doUpdateProduct(p);
  sheet.appendRow(buildProductRow_(p));
  addToStockTab_(p.name || '');
  updateStockTab_(p.name || '', p.stock);
  updateVariantStockTab_(p.name || '', p.variants || '');
  return jsonOut({ ok: true });
}

function doUpdateProduct(p) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, p.id);
  if (rowIdx < 0) return doCreateProduct(p);
  sheet.getRange(rowIdx + 2, 1, 1, PRODUCTS_COLS.length).setValues([buildProductRow_(p)]);
  updateStockTab_(p.name || '', p.stock);
  updateVariantStockTab_(p.name || '', p.variants || '');
  return jsonOut({ ok: true });
}

function doDeleteProduct(id) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, id);
  if (rowIdx < 0) return jsonOut({ ok: false, error: 'not found' });
  var productName = sheet.getRange(rowIdx + 2, 2).getValue();
  sheet.deleteRow(rowIdx + 2);
  removeFromStockTab_(productName);
  return jsonOut({ ok: true });
}

function addToStockTab_(productName) {
  if (!productName) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0] || '').trim() === productName.trim()) return;
    }
  }
  // Empty stock = INFINITE (not zero!)
  sheet.appendRow([productName, '']);
}

function removeFromStockTab_(productName) {
  if (!productName) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === productName.trim()) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

// ============================================================
//  updateStockTab_ — Sync product-level stock to Stock tab
//  - If stock is null/undefined/empty → skip (leave as INFINITE)
//  - If stock is a number (incl 0) → update or create the row
// ============================================================
function updateStockTab_(productName, stockValue) {
  if (!productName) return;
  // Only update if stock is explicitly set (number, including 0)
  // null/undefined/empty → admin didn't set stock → leave as INFINITE
  if (stockValue === null || stockValue === undefined || stockValue === '') return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(STOCK_SHEET);
    sheet.appendRow(['Product Name', 'Stock Count']);
  }

  var count = Number(stockValue);
  if (isNaN(count)) return;

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0] || '').trim() === productName.trim()) {
        sheet.getRange(i + 2, 2).setValue(count);
        return;
      }
    }
  }
  sheet.appendRow([productName, count]);
}

// ============================================================
//  updateVariantStockTab_ — Sync per-variant stock to Stock tab
//  Variants format: "color:Red:0|5,color:Blue:0|,color:Green:0"
//  Variants WITH |stock → create "ProductName - VariantName" row
//  Variants WITHOUT |stock → skip (variant is INFINITE)
// ============================================================
function updateVariantStockTab_(productName, variantsStr) {
  if (!productName || !variantsStr) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;

  var parts = variantsStr.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;

    var pipeIdx = part.lastIndexOf('|');
    if (pipeIdx < 0) continue; // no stock set → INFINITE, skip

    var stockStr = part.substring(pipeIdx + 1).trim();
    var mainPart = part.substring(0, pipeIdx).trim();

    // Empty stock string after | = explicitly INFINITE → skip row creation
    if (stockStr === '' || stockStr.toLowerCase() === 'null') continue;

    var stockNum = Number(stockStr);
    if (isNaN(stockNum) || stockNum < 0) continue;

    var firstColon = mainPart.indexOf(':');
    if (firstColon < 0) continue;
    var rest = mainPart.substring(firstColon + 1);
    var lastColon = rest.lastIndexOf(':');
    var variantName;
    if (lastColon < 0) {
      variantName = rest.trim();
    } else {
      variantName = rest.substring(0, lastColon).trim();
    }
    if (!variantName) continue;

    var stockTabName = productName + ' - ' + variantName;

    var lastRow = sheet.getLastRow();
    var found = false;
    if (lastRow >= 2) {
      var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < names.length; j++) {
        if (String(names[j][0] || '').trim() === stockTabName) {
          sheet.getRange(j + 2, 2).setValue(stockNum);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      sheet.appendRow([stockTabName, stockNum]);
    }
  }
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
    if (col === 'oldPrice') return (p.oldPrice===null||p.oldPrice===undefined||p.oldPrice==='')?'':Number(p.oldPrice);
    if (col === 'featured') return (p.featured===true||p.featured==='true'||p.featured===1||p.featured==='1')?'true':'false';
    if (col === 'isSpecialOffer') return (p.isSpecialOffer===true||p.isSpecialOffer==='true'||p.isSpecialOffer===1||p.isSpecialOffer==='1')?'true':'false';
    if (col === 'stock') {
      if (p.stock===null||p.stock===undefined||p.stock==='') return '';
      var n = Number(p.stock);
      return isNaN(n) ? '' : n;
    }
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

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  STATISTICS — auto-update Statistics tab with formulas
// ============================================================

function setupStatistics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Statistics');
  if (!sheet) { sheet = ss.insertSheet('Statistics'); }
  sheet.clear();

  sheet.setColumnWidth(1, 350); sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120); sheet.setColumnWidth(4, 150); sheet.setColumnWidth(5, 150);

  var brass = '#9A7E3A'; var cream = '#FAF8F4'; var sand = '#F1ECE3';
  var stone = '#E8E4DC'; var white = 'FFFFFF'; var dark = '#1C1815';

  function secTitle(row, text, icon) {
    var c = sheet.getRange(row, 1, 1, 5);
    c.merge(); c.setValue(icon + ' ' + text);
    c.setFontWeight('bold').setFontSize(12).setFontColor(dark).setBackground(sand);
  }
  function hdr(row, col, text) {
    var c = sheet.getRange(row, col);
    c.setValue(text); c.setFontWeight('bold').setFontColor(white).setBackground(brass);
    c.setBorder(true, true, true, true, true, true);
  }
  function val(row, col, formula, fmt) {
    var c = sheet.getRange(row, col);
    c.setValue(formula); if (fmt) c.setNumberFormat(fmt);
    c.setBorder(true, true, true, true, true, true);
  }

  var t = sheet.getRange(1, 1, 1, 5);
  t.merge(); t.setValue('📊 SOUM DECO — Tableau de bord');
  t.setFontWeight('bold').setFontSize(16).setFontColor(brass).setBackground(cream);

  secTitle(3, 'Résumé', '📦');
  sheet.getRange(4, 1).setValue('Total Commandes').setFontWeight('bold');
  val(4, 2, '=IFERROR(COUNTA(Orders!C2:C),0)', '0');
  sheet.getRange(5, 1).setValue("Chiffre d'Affaires (DZD)").setFontWeight('bold');
  val(5, 2, '=IFERROR(SUM(Orders!G2:G),0)', '#,##0');
  sheet.getRange(6, 1).setValue('Panier Moyen (DZD)').setFontWeight('bold');
  val(6, 2, '=IFERROR(IF(COUNTA(Orders!C2:C)>0,SUM(Orders!G2:G)/COUNTA(Orders!C2:C),0),0)', '#,##0');

  secTitle(8, 'Top 10 Produits', '🏆');
  hdr(9, 1, 'Produit'); hdr(9, 2, 'Commandes'); hdr(9, 3, 'CA (DZD)');
  sheet.getRange(10, 1).setValue('=IFERROR(QUERY(Orders!C2:G, "SELECT C, COUNT(C), SUM(G) WHERE C IS NOT NULL GROUP BY C ORDER BY COUNT(C) DESC LIMIT 10", 1), "Aucune commande")');

  secTitle(22, 'Top 10 Wilayas', '📍');
  hdr(23, 1, 'Wilaya'); hdr(23, 2, 'Commandes'); hdr(23, 3, 'CA (DZD)');
  sheet.getRange(24, 1).setValue('=IFERROR(QUERY(Orders!J2:G, "SELECT J, COUNT(J), SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY COUNT(J) DESC LIMIT 10", 1), "Aucune commande")');

  secTitle(36, 'Statut des Commandes', '📋');
  hdr(37, 1, 'Statut'); hdr(37, 2, 'Nombre');
  sheet.getRange(38, 1).setValue('=IFERROR(QUERY(Orders!B2:B, "SELECT B, COUNT(B) WHERE B IS NOT NULL GROUP BY B ORDER BY COUNT(B) DESC LIMIT 10", 1), "Aucune commande")');

  secTitle(50, 'Top 5 Wilayas par CA', '💰');
  hdr(51, 1, 'Wilaya'); hdr(51, 2, 'CA (DZD)');
  sheet.getRange(52, 1).setValue('=IFERROR(QUERY(Orders!J2:G, "SELECT J, SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY SUM(G) DESC LIMIT 5", 1), "Aucune commande")');

  secTitle(58, 'Dernières 10 Commandes', '🕐');
  hdr(59, 1, 'Date'); hdr(59, 2, 'Statut'); hdr(59, 3, 'Produit'); hdr(59, 4, 'Wilaya'); hdr(59, 5, 'Total');
  sheet.getRange(60, 1).setValue('=IFERROR(QUERY(Orders!A2:Q, "SELECT A, B, C, J, G ORDER BY A DESC LIMIT 10", 1), "Aucune commande")');

  sheet.setFrozenRows(1);
  return jsonOut({ ok: true, message: 'Statistics tab updated with 6 sections' });
}

function setupAllSheets() {
  ensureProductsSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(STOCK_SHEET)) { var s = ss.insertSheet(STOCK_SHEET); s.appendRow(['Product Name','Stock Count']); }
  if (!ss.getSheetByName(ORDERS_SHEET)) {
    var o = ss.insertSheet(ORDERS_SHEET);
    o.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes','Variant','Stock Key','Stock Synced']);
  } else {
    ensureOrdersHeaders_(ss.getSheetByName(ORDERS_SHEET));
  }
  ss.toast('All sheets ready ✔', 'Setup', 5);
}


// ============================================================
//  STOCK DECREMENT — onEdit trigger (the brain)
// ============================================================
//
//  HOW IT WORKS:
//  - Watches the Orders sheet for Status column edits.
//  - When status changes to Confirmed/Shipped/Delivered:
//      → Decrement variant stock (if stockKey was sent by frontend)
//      → If no stockKey (whole-product order), decrement product-level stock
//      → If matching Stock tab entry is EMPTY → treat as INFINITE (skip)
//  - When status changes to Cancelled (from a stock-decremented state):
//      → Revert stock back (+qty), but preserve INFINITE (empty stays empty)
//  - Uses "Stock Synced" column for IDEMPOTENCY — safe to re-trigger.
//
//  INSTALLATION (run ONE of these ONCE):
//    Option A: Open spreadsheet → 📦 SOUM DECO menu → "🔧 Setup Auto-Stock"
//    Option B: Apps Script editor → Run `setupTriggers` once
//
//  After installation, status changes auto-trigger stock updates.
// ============================================================

function onStockEdit(e) {
  try {
    var range = e && e.range;
    if (!range) return;
    var sheet = range.getSheet();
    if (sheet.getName() !== ORDERS_SHEET) return;
    // Status column = column B (index 1)
    if (range.getColumn() !== ORDERS_COL.STATUS + 1) return;
    if (range.getRow() < 2) return;

    var newStatus = String(e.value || '').trim().toLowerCase();
    var oldStatus = String((e.oldValue || '')).trim().toLowerCase();

    var row = range.getRow();
    // Defensive: read whatever columns exist, padded to at least 17
    var readCols = Math.max(sheet.getLastColumn(), ORDERS_COL.STOCK_SYNCED + 1);
    var data = sheet.getRange(row, 1, 1, readCols).getValues()[0];
    while (data.length < ORDERS_COL.STOCK_SYNCED + 1) data.push('');

    var productName = String(data[ORDERS_COL.PRODUCT] || '').trim();
    var notes = String(data[ORDERS_COL.NOTES] || '').trim();
    var qtyRaw = data[ORDERS_COL.QTY];
    var qty = (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined) ? 1 : parseInt(String(qtyRaw), 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    if (!productName) return;

    // Multi-item orders (contain "+") — skip (admin must handle manually)
    if (productName.indexOf('+') >= 0) return;

    var bareName = productName.replace(/\s*[×x]\s*\d+\s*$/, '').trim();
    if (!bareName) return;

    var stockKeyStr = String(data[ORDERS_COL.STOCK_KEY] || '').trim();
    var variantStr = String(data[ORDERS_COL.VARIANT] || '').trim();
    var alreadySynced = String(data[ORDERS_COL.STOCK_SYNCED] || '').trim().toLowerCase();

    // ============================================================
    //  BACKFILL — use the unified extractor (tries Variant col,
    //  then product name parentheses, then notes column).
    //  Writes back the extracted Variant + Stock Key columns.
    // ============================================================
    if (!stockKeyStr || !variantStr) {
      var extracted = extractVariantFromRow_(productName, notes, variantStr, stockKeyStr);
      if (extracted.variant && !variantStr) {
        try {
          sheet.getRange(row, ORDERS_COL.VARIANT + 1).setValue(extracted.variant);
        } catch (e) { Logger.log('[onStockEdit] backfill variant write error: ' + e); }
        variantStr = extracted.variant;
      }
      if (extracted.stockKey && !stockKeyStr) {
        try {
          sheet.getRange(row, ORDERS_COL.STOCK_KEY + 1).setValue(extracted.stockKey);
        } catch (e) { Logger.log('[onStockEdit] backfill stockKey write error: ' + e); }
        stockKeyStr = extracted.stockKey;
      }
    }

    // ─── CASE 1: Confirmed → DECREMENT ───────────────────────────
    if (STOCK_DECREMENTED.indexOf(newStatus) >= 0) {
      // Skip if already synced (idempotent — prevents double-decrement)
      if (alreadySynced === 'y') return;

      var decremented = false;

      // Try stockKey FIRST (variant match — sent by frontend)
      if (stockKeyStr) {
        var keys = splitStockKey_(stockKeyStr);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k].trim();
          if (!key) continue;
          if (decrementStockByKey_(key, qty)) {
            decremented = true;
            break;
          }
        }
        // IMPORTANT: if stockKey was sent but no match found in Stock tab,
        // the variant is INFINITE (admin hasn't set per-variant stock yet).
        // → DO NOT fall back to whole-product decrement.
        // → Just mark as synced (so we don't retry forever).
      } else {
        // No stockKey → whole-product order → decrement product-level stock
        decrementProductStock_(bareName, qty);
        decremented = true; // even if stock was infinite (no row found), mark synced
      }

      // Mark as synced (idempotency)
      sheet.getRange(row, ORDERS_COL.STOCK_SYNCED + 1).setValue('Y');
      Logger.log('[Stock] Confirmed ' + bareName + (stockKeyStr ? ' [' + stockKeyStr + ']' : '') + ' x' + qty + ' → ' + (decremented ? 'applied' : 'infinite'));
      return;
    }

    // ─── CASE 2: Cancelled → REVERT ──────────────────────────────
    if (newStatus === 'cancelled') {
      // Only revert if previously synced
      if (alreadySynced !== 'y') return;

      var reverted = false;

      if (stockKeyStr) {
        var keys2 = splitStockKey_(stockKeyStr);
        for (var k2 = 0; k2 < keys2.length; k2++) {
          var key2 = keys2[k2].trim();
          if (!key2) continue;
          if (incrementStockByKey_(key2, qty)) {
            reverted = true;
            break;
          }
        }
      } else {
        incrementProductStock_(bareName, qty);
        reverted = true;
      }

      // Clear the synced flag (so a re-confirm would re-decrement)
      sheet.getRange(row, ORDERS_COL.STOCK_SYNCED + 1).setValue('N');
      Logger.log('[Stock] Cancelled ' + bareName + ' x' + qty + ' → ' + (reverted ? 'reverted' : 'no-op'));
      return;
    }
  } catch (err) {
    Logger.log('[onStockEdit] error: ' + err);
  }
}

// ============================================================
//  Stock tab helpers — ALL treat EMPTY cell as INFINITE
// ============================================================

/**
 * Decrement stock by EXACT Stock tab name (from stockKey).
 * - If row not found → returns false (no match)
 * - If stock cell is EMPTY (infinite) → returns false (no decrement)
 * - If stock cell is a number → decrement (min 0), returns true
 */
function decrementStockByKey_(stockTabName, qty) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === stockTabName.trim()) {
      var current = values[i][1];
      var currentNum = (current === '' || current === null || current === undefined) ? null : Number(current);
      // EMPTY = INFINITE → don't decrement, signal "no match" so caller knows
      if (currentNum === null || isNaN(currentNum)) return false;
      var next = Math.max(0, currentNum - qty);
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] DECREMENT ' + stockTabName + ' -' + qty + ' = ' + next);
      return true;
    }
  }
  return false;
}

/**
 * Increment stock by EXACT Stock tab name (revert cancel).
 * - If row not found → returns false
 * - If stock cell is EMPTY (infinite) → returns true WITHOUT modifying (preserves infinite)
 * - If stock cell is a number → increment, returns true
 */
function incrementStockByKey_(stockTabName, qty) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === stockTabName.trim()) {
      var current = values[i][1];
      var currentNum = (current === '' || current === null || current === undefined) ? null : Number(current);
      // EMPTY = INFINITE → leave it empty (don't write a number)
      if (currentNum === null || isNaN(currentNum)) {
        Logger.log('[Stock] INCREMENT skipped (infinite) ' + stockTabName);
        return true; // treat as "handled" — variant was infinite
      }
      var next = currentNum + qty;
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] INCREMENT (revert) ' + stockTabName + ' +' + qty + ' = ' + next);
      return true;
    }
  }
  return false;
}

/**
 * Decrement whole-product stock by name.
 * - If row not found → no-op (admin hasn't added to Stock tab)
 * - If stock cell is EMPTY (infinite) → no-op (don't decrement)
 * - If stock cell is a number → decrement (min 0)
 */
function decrementProductStock_(productName, qty) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === productName.trim()) {
      var current = values[i][1];
      var currentNum = (current === '' || current === null || current === undefined) ? null : Number(current);
      if (currentNum === null || isNaN(currentNum)) return; // infinite, skip
      var next = Math.max(0, currentNum - qty);
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] DECREMENT ' + productName + ' -' + qty + ' = ' + next);
      return;
    }
  }
}

/**
 * Increment whole-product stock (revert cancel).
 * - If row not found → no-op
 * - If stock cell is EMPTY (infinite) → leave empty (preserve infinite)
 * - If stock cell is a number → increment
 */
function incrementProductStock_(productName, qty) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === productName.trim()) {
      var current = values[i][1];
      var currentNum = (current === '' || current === null || current === undefined) ? null : Number(current);
      if (currentNum === null || isNaN(currentNum)) {
        Logger.log('[Stock] INCREMENT skipped (infinite) ' + productName);
        return; // preserve infinite — don't write
      }
      var next = currentNum + qty;
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] INCREMENT (revert) ' + productName + ' +' + qty + ' = ' + next);
      return;
    }
  }
}


// ============================================================
//  DEDUPE + CLEANUP — one-time maintenance actions
// ============================================================

function doDedupeProducts() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut({ ok: true, removed: 0, remaining: 0 });

  var header = values[0];
  var idCol = 0;
  var categoryCol = header.indexOf('category');
  var nameCol = header.indexOf('name');

  var categoryFixes = 0;
  if (categoryCol >= 0) {
    for (var i = 1; i < values.length; i++) {
      var cat = String(values[i][categoryCol] || '').trim();
      if (cat === 'Meubes') {
        sheet.getRange(i + 1, categoryCol + 1).setValue('Meubles');
        categoryFixes++;
      }
    }
  }

  var seenIds = {};
  var rowsToDelete = [];
  for (var j = 1; j < values.length; j++) {
    var idVal = String(values[j][idCol] || '').trim();
    if (!idVal) continue;
    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idVal)) continue;
    if (seenIds[idVal]) {
      rowsToDelete.push(j + 1);
    } else {
      seenIds[idVal] = true;
    }
  }

  rowsToDelete.sort(function(a, b) { return b - a; });
  for (var k = 0; k < rowsToDelete.length; k++) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  var remaining = sheet.getLastRow() - 1;
  return jsonOut({
    ok: true,
    removed: rowsToDelete.length,
    fixed_categories: categoryFixes,
    remaining: remaining
  });
}

function doCleanupSheet() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut({ ok: true, removed: 0, remaining: 0 });

  var header = values[0];
  var idCol = 0;
  var nameCol = header.indexOf('name');
  var imageCol = header.indexOf('image');
  var categoryCol = header.indexOf('category');

  var categoryFixes = 0;
  if (categoryCol >= 0) {
    for (var i = 1; i < values.length; i++) {
      var cat = String(values[i][categoryCol] || '').trim();
      if (cat === 'Meubes') {
        sheet.getRange(i + 1, categoryCol + 1).setValue('Meubles');
        categoryFixes++;
      }
    }
  }

  var seenIds = {};
  var rowsToDelete = [];
  for (var j = 1; j < values.length; j++) {
    var idVal = String(values[j][idCol] || '').trim();
    var nameVal = nameCol >= 0 ? String(values[j][nameCol] || '').trim() : '';
    var imgVal = imageCol >= 0 ? String(values[j][imageCol] || '').trim() : '';

    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idVal)) continue;

    if (!idVal && !nameVal && !imgVal) {
      rowsToDelete.push(j + 1);
      continue;
    }

    if (idVal && seenIds[idVal]) {
      rowsToDelete.push(j + 1);
      continue;
    }
    if (idVal) seenIds[idVal] = true;
  }

  rowsToDelete.sort(function(a, b) { return b - a; });
  for (var k = 0; k < rowsToDelete.length; k++) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  var remaining = sheet.getLastRow() - 1;
  return jsonOut({
    ok: true,
    removed: rowsToDelete.length,
    fixed_categories: categoryFixes,
    remaining: remaining
  });
}
