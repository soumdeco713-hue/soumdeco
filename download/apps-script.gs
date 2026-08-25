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
  COMMUNE: 10, DELIVERY: 11, COMPANY: 12, NOTES: 13, VARIANT: 14, STOCK_KEY: 15
};

function doGet(e) {
  e = e || {}; var p = e.parameter || {};
  var action = String(p.action || '').toLowerCase();
  try {
    if (action === 'stock') return serveStock();
    if (action === 'products') return serveProducts();
    if (action === 'order') return doCreateOrderFromParams(p);
    if (action === 'product_delete') return doDeleteProduct(p.id || '');
    if (action === 'product_reset') return doResetProducts();
    if (action === 'dedupe') return doDedupeProducts();
    if (action === 'cleanup') return doCleanupSheet();
    if (action === 'health') return jsonOut({ ok: true, time: new Date().toISOString(), sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
    if (action === 'statistics') return setupStatistics();
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

// ============================================================
//  ORDERS
// ============================================================

function doCreateOrderFromParams(p) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(ORDERS_SHEET);
    sheet.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes','Variant','Stock Key']);
  }
  // Auto-add 'Variant' + 'Stock Key' columns if they don't exist
  var headerRow = sheet.getRange(1, 1, 1, 16).getValues()[0];
  if (!headerRow[14] || String(headerRow[14]).trim() !== 'Variant') {
    sheet.getRange(1, 15).setValue('Variant');
  }
  if (!headerRow[15] || String(headerRow[15]).trim() !== 'Stock Key') {
    sheet.getRange(1, 16).setValue('Stock Key');
  }
  sheet.appendRow([
    new Date(), 'New',
    p.product || '', Number(p.quantity) || 1,
    (p.price === null || p.price === undefined || p.price === '') ? '' : Number(p.price),
    Number(p.shippingPrice) || 0, Number(p.grandTotal) || 0,
    p.fullName || '', p.phone || '', p.wilaya || '', p.commune || '',
    p.deliveryLabel || '', p.shippingCompanyLabel || '', p.notes || '',
    p.variant || '', p.stockKey || ''
  ]);
  return jsonOut({ ok: true });
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
  // Fix headers if they don't match PRODUCTS_COLS (e.g. Arabic labels from template)
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
  // Track seen IDs to skip duplicate rows (the sheet sometimes has dupes
  // when a product is saved twice or moved between categories).
  var seenIds = {};
  // Start from row 2 (index 1). Skip guidance row (row 2) if it contains
  // Arabic/emoji hints instead of real product data.
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    // Skip the guidance row — detect it by checking if the id cell contains
    // non-ASCII characters (emojis/Arabic) which real product IDs never have.
    var idStr = String(r[0]);
    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idStr)) continue;
    // Skip duplicate IDs (keep first occurrence)
    if (seenIds[idStr]) continue;
    seenIds[idStr] = true;
    var obj = {};
    for (var j = 0; j < header.length; j++) obj[header[j]] = r[j];
    obj.price = (obj.price===''||obj.price===null||obj.price===undefined)?null:Number(obj.price);
    obj.oldPrice = (obj.oldPrice===''||obj.oldPrice===null||obj.oldPrice===undefined)?null:Number(obj.oldPrice);
    obj.featured = (obj.featured===true||obj.featured===1||obj.featured==='1'||(typeof obj.featured==='string'&&obj.featured.toLowerCase()==='true'));
    obj.isSpecialOffer = (obj.isSpecialOffer===true||obj.isSpecialOffer===1||obj.isSpecialOffer==='1'||(typeof obj.isSpecialOffer==='string'&&obj.isSpecialOffer.toLowerCase()==='true'));
    // stock — null when blank/non-numeric, otherwise a number.
    obj.stock = (obj.stock===''||obj.stock===null||obj.stock===undefined)?null:Number(obj.stock);
    // variants — pass through as a string for the client to parse.
    obj.variants = obj.variants==null?'':String(obj.variants);
    if ((!obj.images||String(obj.images).trim()==='')&&obj.image) obj.images = String(obj.image);
    // Auto-fix common category typos
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
  // Auto-add product name to Stock tab so admin only needs to set the stock count
  addToStockTab_(p.name || '');
  // Also sync stock from product to Stock tab (if admin set a stock value)
  updateStockTab_(p.name || '', p.stock);
  // Also sync per-variant stock to Stock tab (if variants have stock values)
  updateVariantStockTab_(p.name || '', p.variants || '');
  return jsonOut({ ok: true });
}

function doUpdateProduct(p) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, p.id);
  if (rowIdx < 0) return doCreateProduct(p);
  sheet.getRange(rowIdx + 2, 1, 1, PRODUCTS_COLS.length).setValues([buildProductRow_(p)]);
  // Sync stock from product to Stock tab (if admin set a stock value)
  updateStockTab_(p.name || '', p.stock);
  // Also sync per-variant stock to Stock tab
  updateVariantStockTab_(p.name || '', p.variants || '');
  return jsonOut({ ok: true });
}

function doDeleteProduct(id) {
  var sheet = ensureProductsSheet();
  var rowIdx = findProductRow_(sheet, id);
  if (rowIdx < 0) return jsonOut({ ok: false, error: 'not found' });
  // Get product name before deleting (so we can also remove from Stock tab)
  var productName = sheet.getRange(rowIdx + 2, 2).getValue(); // column B = name
  sheet.deleteRow(rowIdx + 2);
  // Also remove from Stock tab
  removeFromStockTab_(productName);
  return jsonOut({ ok: true });
}

// Auto-add product name to Stock tab when a product is created.
// Admin only needs to set the stock count — the name is pre-filled.
function addToStockTab_(productName) {
  if (!productName) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;
  // Check if product already exists in Stock tab
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0] || '').trim() === productName.trim()) return; // already exists
    }
  }
  // Add new row with product name + empty stock count (unlimited)
  sheet.appendRow([productName, '']);
}

// Remove product from Stock tab when a product is deleted.
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
//  updateStockTab_ — Sync stock from product to Stock tab
// ============================================================
//  Called from doCreateProduct + doUpdateProduct.
//  If the product has a stock value (number, including 0),
//  this updates (or creates) the corresponding row in the
//  Stock tab so the visitor sees the correct stock count.
//
//  - If productName already exists in Stock tab → update count
//  - If productName doesn't exist → add new row with count
//  - If stock is null/undefined/empty → skip (don't touch Stock tab)
//  - Never touches other products' rows (safe — no overlap)
// ============================================================
function updateStockTab_(productName, stockValue) {
  if (!productName) return;
  // Only update if stock is explicitly set (number, including 0)
  // null/undefined/empty → admin didn't set stock → don't touch Stock tab
  if (stockValue === null || stockValue === undefined || stockValue === '') return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) {
    // Stock sheet doesn't exist — create it with headers
    sheet = ss.insertSheet(STOCK_SHEET);
    sheet.appendRow(['Product Name', 'Stock Count']);
  }

  var count = String(stockValue); // number → string for sheet storage

  // Search for existing row with this product name
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0] || '').trim() === productName.trim()) {
        // Found — update the count (column B = column 2)
        sheet.getRange(i + 2, 2).setValue(count);
        return; // updated, done
      }
    }
  }
  // Not found — add new row
  sheet.appendRow([productName, count]);
}

// ============================================================
//  updateVariantStockTab_ — Sync per-variant stock to Stock tab
// ============================================================
//  Called from doCreateProduct + doUpdateProduct.
//  Parses the variants string and for each variant that has
//  a stock value, creates/updates a row in the Stock tab
//  with name "ProductName - VariantName" and the stock count.
//
//  Variants format: "color:Red:0|0,color:Blue:0|3,color:Green:0"
//  The |stock suffix is optional — only variants WITH it get
//  a Stock tab entry.
//
//  - Format: "ProductName - VariantName","stockCount"
//  - Safe: only touches rows for THIS product's variants
//  - Never overwrites other products' rows
// ============================================================
function updateVariantStockTab_(productName, variantsStr) {
  if (!productName || !variantsStr) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STOCK_SHEET);
  if (!sheet) return;

  // Parse variants string: "color:Red:0|0,color:Blue:0|3,..."
  var parts = variantsStr.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;

    // Check for |stock suffix
    var pipeIdx = part.lastIndexOf('|');
    if (pipeIdx < 0) continue; // no stock set for this variant

    var stockStr = part.substring(pipeIdx + 1).trim();
    var mainPart = part.substring(0, pipeIdx).trim();

    // Parse stock value (must be a number >= 0)
    var stockNum = Number(stockStr);
    if (isNaN(stockNum) || stockNum < 0) continue;

    // Extract variant name from mainPart: "type:name:priceAdjustment"
    // The name is between the first and last colon
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

    // Build the Stock tab entry name: "ProductName - VariantName"
    var stockTabName = productName + ' - ' + variantName;

    // Search for existing row and update, or add new
    var lastRow = sheet.getLastRow();
    var found = false;
    if (lastRow >= 2) {
      var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var j = 0; j < names.length; j++) {
        if (String(names[j][0] || '').trim() === stockTabName) {
          // Found — update the count
          sheet.getRange(j + 2, 2).setValue(String(stockNum));
          found = true;
          break;
        }
      }
    }
    if (!found) {
      // Not found — add new row
      sheet.appendRow([stockTabName, String(stockNum)]);
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
      // null / undefined / blank → empty cell (means unlimited on the website)
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
//  Creates/updates a "Statistics" tab with:
//    - Total orders
//    - Total revenue
//    - Top 10 products (by order count)
//    - Top 10 wilayas (by order count)
//
//  Uses QUERY formulas on the Orders tab — auto-updates when
//  new orders arrive. No Apps Script trigger needed.
//
//  Call via: ?action=statistics
//  Or: run setupStatistics() manually in the Apps Script editor.
// ============================================================

function setupStatistics() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Statistics');
  if (!sheet) { sheet = ss.insertSheet('Statistics'); }
  sheet.clear();
  
  sheet.setColumnWidth(1, 350); sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 120); sheet.setColumnWidth(4, 150); sheet.setColumnWidth(5, 150);
  
  // Colors
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
  
  // Title
  var t = sheet.getRange(1, 1, 1, 5);
  t.merge(); t.setValue('📊 SOUM DECO — Tableau de bord');
  t.setFontWeight('bold').setFontSize(16).setFontColor(brass).setBackground(cream);
  
  // S1: Summary
  secTitle(3, 'Résumé', '📦');
  sheet.getRange(4, 1).setValue('Total Commandes').setFontWeight('bold');
  val(4, 2, '=IFERROR(COUNTA(Orders!C2:C),0)', '0');
  sheet.getRange(5, 1).setValue("Chiffre d'Affaires (DZD)").setFontWeight('bold');
  val(5, 2, '=IFERROR(SUM(Orders!G2:G),0)', '#,##0');
  sheet.getRange(6, 1).setValue('Panier Moyen (DZD)').setFontWeight('bold');
  val(6, 2, '=IFERROR(IF(COUNTA(Orders!C2:C)>0,SUM(Orders!G2:G)/COUNTA(Orders!C2:C),0),0)', '#,##0');
  
  // S2: Top 10 Products
  secTitle(8, 'Top 10 Produits', '🏆');
  hdr(9, 1, 'Produit'); hdr(9, 2, 'Commandes'); hdr(9, 3, 'CA (DZD)');
  sheet.getRange(10, 1).setValue('=IFERROR(QUERY(Orders!C2:G, "SELECT C, COUNT(C), SUM(G) WHERE C IS NOT NULL GROUP BY C ORDER BY COUNT(C) DESC LIMIT 10", 1), "Aucune commande")');
  
  // S3: Top 10 Wilayas
  secTitle(22, 'Top 10 Wilayas', '📍');
  hdr(23, 1, 'Wilaya'); hdr(23, 2, 'Commandes'); hdr(23, 3, 'CA (DZD)');
  sheet.getRange(24, 1).setValue('=IFERROR(QUERY(Orders!J2:G, "SELECT J, COUNT(J), SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY COUNT(J) DESC LIMIT 10", 1), "Aucune commande")');
  
  // S4: Status Breakdown
  secTitle(36, 'Statut des Commandes', '📋');
  hdr(37, 1, 'Statut'); hdr(37, 2, 'Nombre');
  sheet.getRange(38, 1).setValue('=IFERROR(QUERY(Orders!B2:B, "SELECT B, COUNT(B) WHERE B IS NOT NULL GROUP BY B ORDER BY COUNT(B) DESC LIMIT 10", 1), "Aucune commande")');
  
  // S5: Top 5 Wilayas by Revenue
  secTitle(50, 'Top 5 Wilayas par CA', '💰');
  hdr(51, 1, 'Wilaya'); hdr(51, 2, 'CA (DZD)');
  sheet.getRange(52, 1).setValue('=IFERROR(QUERY(Orders!J2:G, "SELECT J, SUM(G) WHERE J IS NOT NULL GROUP BY J ORDER BY SUM(G) DESC LIMIT 5", 1), "Aucune commande")');
  
  // S6: Recent Orders (last 10)
  secTitle(58, 'Dernières 10 Commandes', '🕐');
  hdr(59, 1, 'Date'); hdr(59, 2, 'Statut'); hdr(59, 3, 'Produit'); hdr(59, 4, 'Wilaya'); hdr(59, 5, 'Total');
  sheet.getRange(60, 1).setValue('=IFERROR(QUERY(Orders!A2:P, "SELECT A, B, C, J, G ORDER BY A DESC LIMIT 10", 1), "Aucune commande")');
  
  sheet.setFrozenRows(1);
  return jsonOut({ ok: true, message: 'Statistics tab updated with 6 sections' });
}

function setupAllSheets() {
  ensureProductsSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(STOCK_SHEET)) { var s = ss.insertSheet(STOCK_SHEET); s.appendRow(['Product Name','Stock Count']); }
  if (!ss.getSheetByName(ORDERS_SHEET)) {
    var o = ss.insertSheet(ORDERS_SHEET);
    o.appendRow(['Date','Status','Product','Qty','Unit Price','Shipping','Total','Customer','Phone','Wilaya','Commune','Delivery','Company','Notes']);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('All sheets ready ✔');
}


// ============================================================
//  STOCK DECREMENT — onEdit trigger (RESTORED)
// ============================================================
//  Watches the Orders sheet. When an order's Status changes to
//  "Confirmed", the matching product's Stock is decremented.
//
//  Uses Stock Key column (column P) for EXACT matching:
//    - If stockKey has value → find exact match in Stock tab → decrement
//    - If empty → try product name match → decrement
//    - If no match → skip (can't decrement unlimited)
//
//  To install: Apps Script editor → Triggers → Add trigger →
//    Function: onStockEdit
//    Event source: From spreadsheet
//    Event type: On edit
// ============================================================

function onStockEdit(e) {
  try {
    var range = e && e.range;
    if (!range) return;
    var sheet = range.getSheet();
    if (sheet.getName() !== ORDERS_SHEET) return;
    if (range.getColumn() !== ORDERS_COL.STATUS + 1) return;
    if (range.getRow() < 2) return;

    var newStatus = String(e.value || '').trim().toLowerCase();
    var oldStatus = String((e.oldValue || '')).trim().toLowerCase();

    var row = range.getRow();
    var data = sheet.getRange(row, 1, 1, ORDERS_COL.STOCK_KEY + 1).getValues()[0];
    var productName = String(data[ORDERS_COL.PRODUCT] || '').trim();
    var qtyRaw = data[ORDERS_COL.QTY];
    var qty = (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined) ? 1 : parseInt(String(qtyRaw), 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    if (!productName) return;

    // Multi-item orders (contain "+") — skip
    if (productName.indexOf('+') >= 0) return;

    // Strip trailing ×N
    var bareName = productName.replace(/\s*[×x]\s*\d+\s*$/, '').trim();
    if (!bareName) return;

    // Read Stock Key column (column P = index 15)
    var stockKeyStr = String(data[ORDERS_COL.STOCK_KEY] || '').trim();

    var STOCK_DECREMENTED = ['confirmed', 'shipped', 'delivered'];

    // CASE 1: Confirmed → DECREMENT
    if (STOCK_DECREMENTED.indexOf(newStatus) >= 0) {
      if (STOCK_DECREMENTED.indexOf(oldStatus) >= 0) return;

      // Try stockKey FIRST (EXACT match — sent by frontend)
      if (stockKeyStr) {
        // stockKey may be comma-separated (multiple variant keys)
        var keys = stockKeyStr.split(',');
        var decremented = false;
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k].trim();
          if (!key) continue;
          decremented = decrementStockByKey_(key, qty);
          if (decremented) break; // found and decremented
        }
        if (decremented) return; // done
      }

      // Fallback: try product name match
      decrementProductStock_(bareName, qty);
    }

    // CASE 2: Cancelled → REVERT
    if (newStatus === 'cancelled') {
      if (STOCK_DECREMENTED.indexOf(oldStatus) < 0) return;

      if (stockKeyStr) {
        var keys2 = stockKeyStr.split(',');
        var reverted = false;
        for (var k2 = 0; k2 < keys2.length; k2++) {
          var key2 = keys2[k2].trim();
          if (!key2) continue;
          reverted = incrementStockByKey_(key2, qty);
          if (reverted) break;
        }
        if (reverted) return;
      }

      incrementProductStock_(bareName, qty);
    }

  } catch (err) {
    Logger.log('[onStockEdit] error: ' + err);
  }
}

// Decrement stock by EXACT Stock tab name (from stockKey)
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
      if (currentNum === null || isNaN(currentNum)) return false;
      var next = Math.max(0, currentNum - qty);
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] DECREMENT ' + stockTabName + ' -' + qty + ' = ' + next);
      return true;
    }
  }
  return false;
}

// Increment stock by EXACT Stock tab name (revert cancel)
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
      var currentNum = (current === '' || current === null || current === undefined) ? 0 : Number(current);
      if (isNaN(currentNum)) currentNum = 0;
      var next = currentNum + qty;
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] INCREMENT (revert) ' + stockTabName + ' +' + qty + ' = ' + next);
      return true;
    }
  }
  return false;
}

// Decrement by product name (fallback when stockKey is empty)
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
      if (currentNum === null || isNaN(currentNum)) return;
      var next = Math.max(0, currentNum - qty);
      sheet.getRange(i + 2, 2).setValue(next);
      Logger.log('[Stock] DECREMENT ' + productName + ' -' + qty + ' = ' + next);
      return;
    }
  }
}

// Increment by product name (fallback)
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
      var currentNum = (current === '' || current === null || current === undefined) ? 0 : Number(current);
      if (isNaN(currentNum)) currentNum = 0;
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

/**
 * Remove duplicate product rows (same ID appearing multiple times).
 * Keeps the FIRST occurrence (which is usually the original, most-complete row)
 * and deletes subsequent duplicates.
 *
 * Also fixes the "Meubes" → "Meubles" typo in-place for all rows.
 *
 * Called via: ?action=dedupe
 * Returns: { ok: true, removed: <count>, fixed_categories: <count>, remaining: <count> }
 */
function doDedupeProducts() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut({ ok: true, removed: 0, remaining: 0 });

  var header = values[0];
  var idCol = 0;            // column A
  var categoryCol = header.indexOf('category');
  var nameCol = header.indexOf('name');

  // First pass: fix "Meubes" → "Meubles" in-place for every row
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

  // Second pass: find duplicate IDs and mark rows for deletion
  // (iterate from the END so deleting doesn't shift indices we still need)
  var seenIds = {};
  var rowsToDelete = [];
  for (var j = 1; j < values.length; j++) {
    var idVal = String(values[j][idCol] || '').trim();
    if (!idVal) continue;
    // Skip guidance rows (emoji/Arabic in ID)
    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idVal)) continue;
    if (seenIds[idVal]) {
      rowsToDelete.push(j + 1); // sheet rows are 1-indexed, +1 because header is row 1
    } else {
      seenIds[idVal] = true;
    }
  }

  // Delete rows from the BOTTOM UP so indices stay valid
  rowsToDelete.sort(function(a, b) { return b - a; });
  for (var k = 0; k < rowsToDelete.length; k++) {
    sheet.deleteRow(rowsToDelete[k]);
  }

  var remaining = sheet.getLastRow() - 1; // minus header
  return jsonOut({
    ok: true,
    removed: rowsToDelete.length,
    fixed_categories: categoryFixes,
    remaining: remaining
  });
}

/**
 * Full sheet cleanup — runs dedupe + fixes category typos + removes
 * completely empty rows (no id, no name, no image).
 *
 * Called via: ?action=cleanup
 */
function doCleanupSheet() {
  var sheet = ensureProductsSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut({ ok: true, removed: 0, remaining: 0 });

  var header = values[0];
  var idCol = 0;
  var nameCol = header.indexOf('name');
  var imageCol = header.indexOf('image');
  var categoryCol = header.indexOf('category');

  // Fix "Meubes" → "Meubles"
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

  // Find rows to delete: duplicates OR completely empty
  var seenIds = {};
  var rowsToDelete = [];
  for (var j = 1; j < values.length; j++) {
    var idVal = String(values[j][idCol] || '').trim();
    var nameVal = nameCol >= 0 ? String(values[j][nameCol] || '').trim() : '';
    var imgVal = imageCol >= 0 ? String(values[j][imageCol] || '').trim() : '';

    // Skip guidance rows (emoji/Arabic in ID) — but DON'T delete them
    // (they're in row 2 and provide admin guidance)
    if (/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(idVal)) continue;

    // Delete completely empty rows (no id, no name, no image)
    if (!idVal && !nameVal && !imgVal) {
      rowsToDelete.push(j + 1);
      continue;
    }

    // Delete duplicate IDs (keep first)
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
