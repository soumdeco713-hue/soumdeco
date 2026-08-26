// Test the cart checkout out-of-stock prevention.
// Mirrors the logic in checkout-modal.tsx.

// Extract variant from cart item name (format: "Product (variant info)")
// NOTE: Cart items do NOT have the " ×N" suffix — that's added by the order form.
function extractVariantFromName(itemName) {
  const variantMatch = itemName.match(/\(([^)]+)\)\s*$/);
  if (!variantMatch) return { bareName: itemName.trim(), variantName: "" };
  const content = variantMatch[1].trim();
  const parts = content.split("·");
  const values = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const colonIdx = trimmed.lastIndexOf(":");
    if (colonIdx >= 0) {
      const value = trimmed.substring(colonIdx + 1).trim();
      if (value) values.push(value);
    } else if (trimmed) {
      values.push(trimmed);
    }
  }
  const variantName = values.join(" - ");
  const bareName = itemName.replace(/\s*\([^)]+\)\s*$/, "").trim();
  return { bareName, variantName };
}

// Check if a cart item is out of stock
function isCartItemRupture(itemName, isVariantRuptureFn) {
  const { bareName, variantName } = extractVariantFromName(itemName);
  if (!variantName) return false; // no variant info → can't check → assume available
  return isVariantRuptureFn(bareName, variantName);
}

// Simulated isVariantRupture (from page.tsx)
function makeIsVariantRupture(stockMap) {
  return (productName, variantName) => {
    // Try combined key first: "ProductName - Red - 06L"
    const combinedKey = `${productName} - ${variantName}`;
    if (combinedKey in stockMap) return stockMap[combinedKey] === 0;
    // Try individual parts: "ProductName - Red", "ProductName - 06L"
    const parts = variantName.split(" - ").map((s) => s.trim());
    for (const part of parts) {
      const partKey = `${productName} - ${part}`;
      if (partKey in stockMap && stockMap[partKey] === 0) return true;
    }
    return false;
  };
}

let pass = 0, fail = 0;
function assertEqual(actual, expected, name) {
  const equal = JSON.stringify(actual) === JSON.stringify(expected);
  if (equal) { pass++; console.log(`✅ ${name}`); }
  else {
    fail++;
    console.error(`❌ ${name}`);
    console.error(`   got:      ${JSON.stringify(actual)}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== TEST 1: Cart with no out-of-stock items ===");
const cart1 = [
  { name: "Cocotte (المقاس: 06L)", price: 15000, quantity: 1 },
  { name: "Service (اللون: Blue)", price: 5000, quantity: 2 },
];
const stockMap1 = {
  "Cocotte - 06L": 5,
  "Service - Blue": 3,
};
const isRupture1 = makeIsVariantRupture(stockMap1);
const ruptures1 = cart1.map(i => isCartItemRupture(i.name, isRupture1));
assertEqual(ruptures1, [false, false], "1.1 No ruptures");
assertEqual(ruptures1.some(r => r), false, "1.2 hasRuptureItem = false");

console.log("\n=== TEST 2: Cart with one out-of-stock variant ===");
const cart2 = [
  { name: "Cocotte (المقاس: 06L)", price: 15000, quantity: 1 },
  { name: "Cocotte (المقاس: 10L)", price: 17000, quantity: 1 }, // 10L is out of stock
];
const stockMap2 = {
  "Cocotte - 06L": 5,
  "Cocotte - 10L": 0, // OUT OF STOCK
};
const isRupture2 = makeIsVariantRupture(stockMap2);
const ruptures2 = cart2.map(i => isCartItemRupture(i.name, isRupture2));
assertEqual(ruptures2, [false, true], "2.1 06L available, 10L rupture");
assertEqual(ruptures2.some(r => r), true, "2.2 hasRuptureItem = true");

console.log("\n=== TEST 3: Cart with color+size variant ===");
const cart3 = [
  { name: "Service (اللون: Red · المقاس: Large)", price: 5000, quantity: 1 },
];
const stockMap3 = {
  "Service - Red": 2,
  "Service - Large": 0, // Large is out of stock
};
const isRupture3 = makeIsVariantRupture(stockMap3);
const ruptures3 = cart3.map(i => isCartItemRupture(i.name, isRupture3));
assertEqual(ruptures3, [true], "3.1 Large out of stock → rupture");

console.log("\n=== TEST 4: Cart item with no variant info ===");
const cart4 = [
  { name: "Plain Product", price: 1000, quantity: 1 },
];
const stockMap4 = { "Plain Product": 5 };
const isRupture4 = makeIsVariantRupture(stockMap4);
const ruptures4 = cart4.map(i => isCartItemRupture(i.name, isRupture4));
assertEqual(ruptures4, [false], "4.1 No variant info → not rupture (can't check)");

console.log("\n=== TEST 5: Cart item with variant but no Stock tab entry (infinite) ===");
const cart5 = [
  { name: "Cocotte (اللون: Red)", price: 15000, quantity: 1 },
];
const stockMap5 = {}; // no CSV entry for Red → infinite
const isRupture5 = makeIsVariantRupture(stockMap5);
const ruptures5 = cart5.map(i => isCartItemRupture(i.name, isRupture5));
assertEqual(ruptures5, [false], "5.1 No CSV entry → not rupture (infinite)");

console.log("\n=== TEST 6: Comma-in-product-name variant in cart ===");
const commaName = "Cocotte minute 06, 08, 10, 12 litres Ref 01";
const cart6 = [
  { name: `${commaName} (المقاس: 06L)`, price: 15000, quantity: 1 },
];
const stockMap6 = {
  [`${commaName} - 06L`]: 0, // OUT OF STOCK
};
const isRupture6 = makeIsVariantRupture(stockMap6);
const ruptures6 = cart6.map(i => isCartItemRupture(i.name, isRupture6));
assertEqual(ruptures6, [true], "6.1 Comma product variant out of stock → rupture");

console.log("\n=== TEST 7: Variant extraction from cart item name ===");
const { bareName, variantName } = extractVariantFromName("Cocotte (المقاس: 06L)");
assertEqual(bareName, "Cocotte", "7.1 bareName extracted");
assertEqual(variantName, "06L", "7.2 variantName extracted");

const { bareName: bn2, variantName: vn2 } = extractVariantFromName("Plain Product");
assertEqual(bn2, "Plain Product", "7.3 no parens → bareName = full name");
assertEqual(vn2, "", "7.4 no parens → variantName empty");

const { bareName: bn3, variantName: vn3 } = extractVariantFromName("Service (اللون: Red · المقاس: Large)");
assertEqual(bn3, "Service", "7.5 multi-variant bareName");
assertEqual(vn3, "Red - Large", "7.6 multi-variant variantName");

console.log("\n=== TEST 8: Multiple cart items, mixed stock states ===");
const cart8 = [
  { name: "A (المقاس: S)", price: 1000, quantity: 1 },     // S in stock
  { name: "B (المقاس: M)", price: 2000, quantity: 1 },     // M out of stock
  { name: "C (اللون: Red)", price: 3000, quantity: 1 },   // Red infinite (no CSV)
  { name: "D", price: 4000, quantity: 1 },                 // no variant
];
const stockMap8 = {
  "A - S": 5,
  "B - M": 0, // OUT OF STOCK
};
const isRupture8 = makeIsVariantRupture(stockMap8);
const ruptures8 = cart8.map(i => isCartItemRupture(i.name, isRupture8));
assertEqual(ruptures8, [false, true, false, false], "8.1 Only B-M is rupture");
assertEqual(ruptures8.some(r => r), true, "8.2 hasRuptureItem = true");
const ruptureItems8 = cart8.filter((_, i) => ruptures8[i]);
assertEqual(ruptureItems8.length, 1, "8.3 Only 1 rupture item");
assertEqual(ruptureItems8[0].name, "B (المقاس: M)", "8.4 Correct rupture item");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
