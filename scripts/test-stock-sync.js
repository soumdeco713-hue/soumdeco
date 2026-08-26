// Test the admin panel stock sync logic (CSV is source of truth).
// Mirrors the useEffect logic in admin-panel.tsx EditForm.

function syncStockFromCsv(product, getStockCount) {
  const csvStock = getStockCount(product.name ?? "");
  const csvHasStock = csvStock !== null && csvStock !== undefined;

  let baseDraft;
  if (csvHasStock) {
    // CSV has a value — use it (sheet is source of truth)
    baseDraft = { ...product, stock: csvStock };
  } else {
    // No CSV entry — keep Products tab value
    baseDraft = { ...product };
  }

  // Sync per-variant stock from CSV
  if (baseDraft.variants && baseDraft.variants.length > 0) {
    const syncedVariants = baseDraft.variants.map((v) => {
      if (!v.name) return v;
      const csvVariantStock = getStockCount(`${product.name} - ${v.name}`);
      if (csvVariantStock !== null && csvVariantStock !== undefined) {
        return { ...v, stock: csvVariantStock };
      }
      return v;
    });
    baseDraft = { ...baseDraft, variants: syncedVariants };
  }

  return baseDraft;
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, name) {
  const equal = JSON.stringify(actual) === JSON.stringify(expected);
  if (equal) {
    pass++;
    console.log(`✅ ${name}`);
  } else {
    fail++;
    console.error(`❌ ${name}`);
    console.error(`   got:      ${JSON.stringify(actual)}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== TEST 1: CSV has value, Products tab has stale value ===");
// Scenario: admin set stock to 5 long ago, 3 orders confirmed → CSV says 2
// Expected: panel shows 2 (CSV is source of truth)
const product1 = { name: "Cocotte", stock: 5, variants: [] };
const csv1 = (k) => (k === "Cocotte" ? 2 : null);
const result1 = syncStockFromCsv(product1, csv1);
assertEqual(result1.stock, 2, "1.1 CSV value (2) overrides Products tab (5)");

console.log("\n=== TEST 2: CSV has no entry (infinite), Products tab has value ===");
// Scenario: admin set stock to 5, but no CSV entry (variant never saved to Stock tab)
// Expected: panel shows 5 (keep Products tab value, since CSV has no opinion)
const product2 = { name: "Product", stock: 5, variants: [] };
const csv2 = (k) => null;
const result2 = syncStockFromCsv(product2, csv2);
assertEqual(result2.stock, 5, "2.1 Products tab value (5) preserved when CSV empty");

console.log("\n=== TEST 3: CSV has 0 (out of stock), Products tab has 10 ===");
// Scenario: stock auto-decremented to 0 in sheet, Products tab still says 10
// Expected: panel shows 0 (CSV is source of truth)
const product3 = { name: "Product", stock: 10, variants: [] };
const csv3 = (k) => (k === "Product" ? 0 : null);
const result3 = syncStockFromCsv(product3, csv3);
assertEqual(result3.stock, 0, "3.1 CSV value (0) overrides Products tab (10)");

console.log("\n=== TEST 4: Per-variant CSV sync ===");
// Scenario: product has 2 variants, CSV has values for both
const product4 = {
  name: "Cocotte",
  stock: null,
  variants: [
    { type: "size", name: "06L", priceAdjustment: 0, stock: 5 },  // stale Products tab
    { type: "size", name: "08L", priceAdjustment: 0, stock: 3 },  // stale Products tab
  ],
};
const csv4 = (k) => {
  if (k === "Cocotte - 06L") return 2;  // auto-decremented
  if (k === "Cocotte - 08L") return 1;  // auto-decremented
  return null;
};
const result4 = syncStockFromCsv(product4, csv4);
assertEqual(result4.variants[0].stock, 2, "4.1 06L CSV (2) overrides Products tab (5)");
assertEqual(result4.variants[1].stock, 1, "4.2 08L CSV (1) overrides Products tab (3)");

console.log("\n=== TEST 5: Mixed CSV presence (some variants in CSV, some not) ===");
// Scenario: 3 variants, only 2 have CSV entries
const product5 = {
  name: "Cocotte",
  stock: null,
  variants: [
    { type: "color", name: "Red", priceAdjustment: 0, stock: null },    // infinite (no CSV)
    { type: "size", name: "06L", priceAdjustment: 0, stock: 5 },        // CSV says 3
    { type: "size", name: "08L", priceAdjustment: 0, stock: 2 },        // no CSV → keep
  ],
};
const csv5 = (k) => {
  if (k === "Cocotte - 06L") return 3;
  return null;
};
const result5 = syncStockFromCsv(product5, csv5);
assertEqual(result5.variants[0].stock, null, "5.1 Red stays infinite (no CSV)");
assertEqual(result5.variants[1].stock, 3, "5.2 06L from CSV (3)");
assertEqual(result5.variants[2].stock, 2, "5.3 08L keeps Products tab (2)");

console.log("\n=== TEST 6: User's exact scenario — panel shows 5, sheet shows 8 ===");
// Before fix: panel showed 5 (stale Products tab), sheet had 8
// After fix: panel should show 8 (CSV is source of truth)
const product6 = { name: "Cocotte minute 06, 08, 10, 12 litres Ref 01", stock: 5, variants: [] };
const csv6 = (k) => {
  if (k === "Cocotte minute 06, 08, 10, 12 litres Ref 01") return 8;
  return null;
};
const result6 = syncStockFromCsv(product6, csv6);
assertEqual(result6.stock, 8, "6.1 Panel now shows 8 (CSV is source of truth)");

console.log("\n=== TEST 7: After admin saves 10, CSV is stale (still 8) ===");
// This is handled by forceRefresh — the parent calls onRefreshStock after save,
// which fetches directly from Apps Script (bypassing cache).
// Here we just verify that when CSV is fresh (= 10), panel shows 10.
const product7 = { name: "Cocotte", stock: 10, variants: [] };  // Products tab = 10 (just saved)
const csv7 = (k) => (k === "Cocotte" ? 10 : null);  // CSV also = 10 (after forceRefresh)
const result7 = syncStockFromCsv(product7, csv7);
assertEqual(result7.stock, 10, "7.1 After save + refresh, both agree on 10");

console.log("\n=== TEST 8: Variant with commas in product name ===");
const product8 = {
  name: "Cocotte minute 06, 08, 10, 12 litres Ref 01",
  stock: null,
  variants: [
    { type: "size", name: "06L", priceAdjustment: 0, stock: 5 },
  ],
};
const csv8 = (k) => {
  if (k === "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L") return 3;
  return null;
};
const result8 = syncStockFromCsv(product8, csv8);
assertEqual(result8.variants[0].stock, 3, "8.1 Variant stock from CSV (commas in name)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
