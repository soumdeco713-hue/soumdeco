// Test the variant extraction logic for the user's exact scenario:
// Product = "Cocotte minute 06, 08, 10, 12 litres Ref 01"
// User selects "06L" variant on product page
// variantSummary = "المقاس: 06L"

// Mirror of cod-order-form.tsx extractVariant + stockKey builder
function extractVariant(itemName) {
  const match = itemName.match(/\(([^)]+)\)\s*$/);
  if (!match) return "";
  const content = match[1].trim();
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
  return values.join(" - ");
}

// Simulated product-page.tsx orderItems builder
function buildOrderItems(productName, variantSummary) {
  return [{
    name: variantSummary ? `${productName} (${variantSummary})` : productName,
  }];
}

// Simulated cod-order-form.tsx allProducts + stockKey builder
function buildOrderPayload(items, productName) {
  const allProducts = items.map(it => `${it.name} ×1`).join(" + ");
  const orderVariant = items.length === 1 ? extractVariant(items[0].name) : "";

  // stockKey builder
  let stockKey = "";
  if (items.length === 1) {
    const item = items[0];
    const prodName = item.name.replace(/\s*\([^)]+\)\s*$/, "").trim();
    const variantMatch = item.name.match(/\(([^)]+)\)\s*$/);
    if (variantMatch) {
      const variantContent = variantMatch[1].trim();
      const variantParts = variantContent.split("·");
      const selectedValues = [];
      for (const part of variantParts) {
        const trimmed = part.trim();
        const colonIdx = trimmed.lastIndexOf(":");
        if (colonIdx >= 0) {
          const value = trimmed.substring(colonIdx + 1).trim();
          if (value) selectedValues.push(value);
        } else if (trimmed) {
          selectedValues.push(trimmed);
        }
      }
      if (selectedValues.length > 0) {
        stockKey = selectedValues.map(v => `${prodName} - ${v}`).join(",");
      }
    }
  }
  return { allProducts, orderVariant, stockKey };
}

// Test scenarios
const tests = [
  {
    name: "Cocotte 06L variant selected",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01",
    variantSummary: "المقاس: 06L",
    expect: {
      allProducts: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 06L) ×1",
      orderVariant: "06L",
      stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L",
    },
  },
  {
    name: "Cocotte 08L variant selected",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01",
    variantSummary: "المقاس: 08L",
    expect: {
      allProducts: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 08L) ×1",
      orderVariant: "08L",
      stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 08L",
    },
  },
  {
    name: "Color + Size variant selected",
    productName: "Service a table 24p vert",
    variantSummary: "اللون: Blue · المقاس: Large",
    expect: {
      allProducts: "Service a table 24p vert (اللون: Blue · المقاس: Large) ×1",
      orderVariant: "Blue - Large",
      stockKey: "Service a table 24p vert - Blue,Service a table 24p vert - Large",
    },
  },
  {
    name: "No variant selected",
    productName: "Cocotte minute 06, 08, 10, 12 litres Ref 01",
    variantSummary: "",
    expect: {
      allProducts: "Cocotte minute 06, 08, 10, 12 litres Ref 01 ×1",
      orderVariant: "",
      stockKey: "",
    },
  },
];

let pass = 0, fail = 0;
for (const test of tests) {
  const items = buildOrderItems(test.productName, test.variantSummary);
  const result = buildOrderPayload(items, test.productName);

  const allMatch = result.allProducts === test.expect.allProducts;
  const variantMatch = result.orderVariant === test.expect.orderVariant;
  const stockKeyMatch = result.stockKey === test.expect.stockKey;

  if (allMatch && variantMatch && stockKeyMatch) {
    console.log(`✅ ${test.name}`);
    console.log(`   allProducts: ${result.allProducts}`);
    console.log(`   variant:     ${result.orderVariant}`);
    console.log(`   stockKey:    ${result.stockKey}`);
    pass++;
  } else {
    console.error(`❌ ${test.name}`);
    if (!allMatch) console.error(`   allProducts: got "${result.allProducts}" expected "${test.expect.allProducts}"`);
    if (!variantMatch) console.error(`   variant:     got "${result.orderVariant}" expected "${test.expect.orderVariant}"`);
    if (!stockKeyMatch) console.error(`   stockKey:    got "${result.stockKey}" expected "${test.expect.stockKey}"`);
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
