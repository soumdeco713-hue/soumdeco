// Test the server-side variant extraction logic from apps-script.gs.
// Simulates: doCreateOrderFromParams receives a product name + empty
// variant + empty stockKey, and must populate Variant + Stock Key columns.

// Mirror of the extraction logic in apps-script.gs doCreateOrderFromParams
function extractVariantAndKey(productStr, sentVariant, sentStockKey) {
  var variantStr = String(sentVariant || '');
  var stockKeyStr = String(sentStockKey || '');

  // Strip trailing " ×N" to get bare product name
  var bareName = productStr.replace(/\s*[×x]\s*\d+\s*$/, '').trim();

  // If variant wasn't sent, try to extract from product name
  if (!variantStr) {
    var variantMatch = bareName.match(/\(([^)]+)\)\s*$/);
    if (variantMatch) {
      var variantContent = variantMatch[1].trim();
      var variantParts = variantContent.split('·');
      var extractedValues = [];
      for (var i = 0; i < variantParts.length; i++) {
        var part = variantParts[i].trim();
        if (!part) continue;
        var colonIdx = part.lastIndexOf(':');
        if (colonIdx >= 0) {
          var value = part.substring(colonIdx + 1).trim();
          if (value) extractedValues.push(value);
        } else if (part) {
          extractedValues.push(part);
        }
      }
      variantStr = extractedValues.join(' - ');
    }
  }

  // If stockKey wasn't sent, build it from bareName + variant
  if (!stockKeyStr && variantStr) {
    var cleanProductName = bareName.replace(/\s*\([^)]+\)\s*$/, '').trim();
    var variantValues = variantStr.split(' - ');
    var keys = [];
    for (var k = 0; k < variantValues.length; k++) {
      var v = variantValues[k].trim();
      if (v) keys.push(cleanProductName + ' - ' + v);
    }
    stockKeyStr = keys.join(',');
  }

  return { variant: variantStr, stockKey: stockKeyStr };
}

const tests = [
  {
    name: "Cocotte 06L — frontend sent variant, no stockKey",
    input: {
      product: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 06L) ×1",
      variant: "06L",
      stockKey: "",
    },
    expect: {
      variant: "06L",
      stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L",
    },
  },
  {
    name: "Cocotte 06L — frontend sent NOTHING (old frontend)",
    input: {
      product: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 06L) ×1",
      variant: "",
      stockKey: "",
    },
    expect: {
      variant: "06L",
      stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L",
    },
  },
  {
    name: "Cocotte 08L — bare name with commas (edge case)",
    input: {
      product: "Cocotte minute 06, 08, 10, 12 litres Ref 01 (المقاس: 08L) ×2",
      variant: "",
      stockKey: "",
    },
    expect: {
      variant: "08L",
      stockKey: "Cocotte minute 06, 08, 10, 12 litres Ref 01 - 08L",
    },
  },
  {
    name: "Color + Size combo — bare name with no commas",
    input: {
      product: "Service a table 24p vert (اللون: Blue · المقاس: Large) ×1",
      variant: "",
      stockKey: "",
    },
    expect: {
      variant: "Blue - Large",
      stockKey: "Service a table 24p vert - Blue,Service a table 24p vert - Large",
    },
  },
  {
    name: "No variant in product name — plain order",
    input: {
      product: "Cocotte minute 06, 08, 10, 12 litres Ref 01 ×1",
      variant: "",
      stockKey: "",
    },
    expect: {
      variant: "",
      stockKey: "",
    },
  },
  {
    name: "Frontend sent full info — server preserves as-is",
    input: {
      product: "Some Product (المقاس: 10L) ×1",
      variant: "10L",
      stockKey: "Some Product - 10L",
    },
    expect: {
      variant: "10L",
      stockKey: "Some Product - 10L",
    },
  },
];

let pass = 0, fail = 0;
for (const test of tests) {
  const result = extractVariantAndKey(test.input.product, test.input.variant, test.input.stockKey);
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
