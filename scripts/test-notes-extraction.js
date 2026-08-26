// Test the new notes-based extraction logic.
// Mirrors the apps-script.gs extractVariantFromRow_ + extractVariantFromNotes_ helpers.

function parseVariantContent(content) {
  var parts = String(content || '').split('·');
  var values = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var colonIdx = part.lastIndexOf(':');
    if (colonIdx >= 0) {
      var value = part.substring(colonIdx + 1).trim();
      if (value) values.push(value);
    } else if (part) {
      values.push(part);
    }
  }
  return values.join(' - ');
}

function extractVariantFromNotes(notes) {
  var notesStr = String(notes || '').trim();
  if (!notesStr) return '';
  var labels = ['المقاس', 'اللون', 'الحجم', 'الوزن', 'النوع', 'النموذج'];
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
      value = value.replace(/\s+[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u, '').trim();
      if (value) values.push(value);
    }
  }
  return values.join(' - ');
}

function buildStockKey(bareName, variantStr) {
  var cleanProductName = String(bareName || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
  var variantValues = String(variantStr || '').split(' - ');
  var keys = [];
  for (var k = 0; k < variantValues.length; k++) {
    var v = variantValues[k].trim();
    if (v) keys.push(cleanProductName + ' - ' + v);
  }
  return { variant: variantStr, stockKey: keys.join(',') };
}

function extractVariantFromRow(productName, notes, existingVariant, existingStockKey) {
  var variantStr = String(existingVariant || '').trim();
  var stockKeyStr = String(existingStockKey || '').trim();
  if (stockKeyStr) return { variant: variantStr, stockKey: stockKeyStr };

  var bareName = String(productName || '').replace(/\s*[×x]\s*\d+\s*$/, '').trim();

  if (variantStr) return buildStockKey(bareName, variantStr);

  var variantMatch = bareName.match(/\(([^)]+)\)\s*$/);
  if (variantMatch) {
    var extractedVariant = parseVariantContent(variantMatch[1]);
    if (extractedVariant) return buildStockKey(bareName, extractedVariant);
  }

  if (notes) {
    var notesVariant = extractVariantFromNotes(notes);
    if (notesVariant) return buildStockKey(bareName, notesVariant);
  }

  return { variant: '', stockKey: '' };
}

// ===== TESTS =====
const tests = [
  {
    name: "Variant in product name (frontend fixed scenario)",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 06L) ×1",
    notes: "Stopdesk",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "06L", stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L" },
  },
  {
    name: "Variant in NOTES only (current live scenario)",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01 ×1",
    notes: "المقاس: 06L",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "06L", stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L" },
  },
  {
    name: "Variant in NOTES with other notes mixed in",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01 ×1",
    notes: "المقاس: 08L · Please deliver after 5pm · Stopdesk",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "08L", stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 08L" },
  },
  {
    name: "Color + Size in notes",
    productName: "Service a table 24p vert ×2",
    notes: "اللون: Blue · المقاس: Large · some user note",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "Blue - Large", stockKey: "Service a table 24p vert - Blue,Service a table 24p vert - Large" },
  },
  {
    name: "Variant already in column — preserved as-is",
    productName: "Some Product ×1",
    notes: "anything",
    existingVariant: "10L",
    existingStockKey: "Some Product - 10L",
    expect: { variant: "10L", stockKey: "Some Product - 10L" },
  },
  {
    name: "Variant in column but no stockKey — builds stockKey from column",
    productName: "Some Product ×1",
    notes: "anything",
    existingVariant: "10L",
    existingStockKey: "",
    expect: { variant: "10L", stockKey: "Some Product - 10L" },
  },
  {
    name: "No variant info anywhere — returns empty",
    productName: "Plain Product ×1",
    notes: "Just a customer note",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "", stockKey: "" },
  },
  {
    name: "Variant in notes with emoji after value",
    productName: "Cocotte ×1",
    notes: "المقاس: 10L 🚚",
    existingVariant: "",
    existingStockKey: "",
    expect: { variant: "10L", stockKey: "Cocotte - 10L" },
  },
];

let pass = 0, fail = 0;
for (const test of tests) {
  const result = extractVariantFromRow(test.productName, test.notes, test.existingVariant, test.existingStockKey);
  const ok = result.variant === test.expect.variant && result.stockKey === test.expect.stockKey;
  if (ok) {
    console.log(`✅ ${test.name}`);
    console.log(`   variant:  "${result.variant}"`);
    console.log(`   stockKey: "${result.stockKey}"`);
    pass++;
  } else {
    console.error(`❌ ${test.name}`);
    console.error(`   variant:  got "${result.variant}" expected "${test.expect.variant}"`);
    console.error(`   stockKey: got "${result.stockKey}" expected "${test.expect.stockKey}"`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
