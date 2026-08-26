// Logic test for the apps-script stock decrement rules.
// Verifies:
//   1. Empty stock cell → INFINITE (no decrement, no revert)
//   2. Variant stockKey with no match in Stock tab → DON'T fall back to whole-product
//   3. Whole-product order (no stockKey) → decrement product-level stock
//   4. Cancel after confirm → revert (preserves infinite)
//   5. Multi-item orders (contain "+") → skipped

const tests = [
  {
    name: "Empty stock = INFINITE (no decrement)",
    setup: { stock: [{ name: "Cocotte", count: "" }] },
    order: { product: "Cocotte ×1", stockKey: "", status: "Confirmed", synced: "" },
    assert: (stockTab) => {
      const row = stockTab[0];
      return row.count === "" || row.count === null || row.count === undefined;
    },
  },
  {
    name: "Variant stockKey with match → decrement variant",
    setup: {
      stock: [
        { name: "Cocotte", count: 10 },
        { name: "Cocotte - 10L", count: 5 },
      ],
    },
    order: { product: "Cocotte (المقاس: 10L) ×1", stockKey: "Cocotte - 10L", status: "Confirmed", synced: "" },
    assert: (stockTab) => {
      const variant = stockTab.find((r) => r.name === "Cocotte - 10L");
      const product = stockTab.find((r) => r.name === "Cocotte");
      return variant.count === 4 && product.count === 10; // variant decremented, product untouched
    },
  },
  {
    name: "Variant stockKey with NO match → no decrement (infinite), no whole-product fallback",
    setup: {
      stock: [{ name: "Cocotte", count: 10 }], // no "Cocotte - 10L" row
    },
    order: { product: "Cocotte (المقاس: 10L) ×1", stockKey: "Cocotte - 10L", status: "Confirmed", synced: "" },
    assert: (stockTab) => {
      const product = stockTab.find((r) => r.name === "Cocotte");
      return product.count === 10; // unchanged — variant treated as infinite
    },
  },
  {
    name: "Whole-product order (no stockKey) → decrement product-level stock",
    setup: { stock: [{ name: "Cocotte", count: 10 }] },
    order: { product: "Cocotte ×1", stockKey: "", status: "Confirmed", synced: "" },
    assert: (stockTab) => stockTab.find((r) => r.name === "Cocotte").count === 9,
  },
  {
    name: "Cancel after confirm → revert (preserves infinite)",
    setup: { stock: [{ name: "Cocotte", count: "" }] }, // infinite
    order: { product: "Cocotte ×1", stockKey: "", status: "Cancelled", synced: "Y" },
    assert: (stockTab) => {
      const row = stockTab.find((r) => r.name === "Cocotte");
      return row.count === "" || row.count === null || row.count === undefined; // still infinite
    },
  },
  {
    name: "Cancel after confirm with finite stock → +qty reverted",
    setup: { stock: [{ name: "Cocotte", count: 9 }] },
    order: { product: "Cocotte ×1", stockKey: "", status: "Cancelled", synced: "Y" },
    assert: (stockTab) => stockTab.find((r) => r.name === "Cocotte").count === 10,
  },
  {
    name: "Multi-item order (contains '+') → skipped",
    setup: { stock: [{ name: "A", count: 5 }, { name: "B", count: 5 }] },
    order: { product: "A ×1 + B ×2", stockKey: "", status: "Confirmed", synced: "" },
    assert: (stockTab) => stockTab.every((r) => r.count === 5), // nothing touched
  },
];

// ---- Simulated trigger logic (mirror of apps-script.gs) ----
function applyOrder(stockTab, order) {
  const STOCK_DECREMENTED = ["confirmed", "shipped", "delivered"];
  const productName = order.product.trim();
  const qty = parseInt(productName.match(/×\s*(\d+)/)?.[1] || "1", 10) || 1;
  const bareName = productName.replace(/\s*[×x]\s*\d+\s*$/, "").trim();
  const stockKeyStr = (order.stockKey || "").trim();
  const newStatus = (order.status || "").toLowerCase();
  const alreadySynced = (order.synced || "").toLowerCase();

  // Multi-item orders skipped
  if (productName.includes("+")) return stockTab;

  if (STOCK_DECREMENTED.includes(newStatus)) {
    if (alreadySynced === "y") return stockTab;

    if (stockKeyStr) {
      const keys = stockKeyStr.split(",");
      for (const k of keys) {
        const key = k.trim();
        if (!key) continue;
        const row = stockTab.find((r) => r.name.trim() === key);
        if (row) {
          const current = row.count;
          const currentNum = (current === "" || current === null || current === undefined) ? null : Number(current);
          if (currentNum === null || isNaN(currentNum)) {
            // INFINITE → no decrement, but treat as "applied"
          } else {
            row.count = Math.max(0, currentNum - qty);
          }
          break;
        }
      }
      // IMPORTANT: no fallback to whole-product
    } else {
      const row = stockTab.find((r) => r.name.trim() === bareName);
      if (row) {
        const current = row.count;
        const currentNum = (current === "" || current === null || current === undefined) ? null : Number(current);
        if (currentNum !== null && !isNaN(currentNum)) {
          row.count = Math.max(0, currentNum - qty);
        }
      }
    }
    order.synced = "y";
    return stockTab;
  }

  if (newStatus === "cancelled") {
    if (alreadySynced !== "y") return stockTab;

    if (stockKeyStr) {
      const keys = stockKeyStr.split(",");
      for (const k of keys) {
        const key = k.trim();
        if (!key) continue;
        const row = stockTab.find((r) => r.name.trim() === key);
        if (row) {
          const current = row.count;
          const currentNum = (current === "" || current === null || current === undefined) ? null : Number(current);
          if (currentNum !== null && !isNaN(currentNum)) {
            row.count = currentNum + qty;
          }
          // INFINITE → preserve empty
          break;
        }
      }
    } else {
      const row = stockTab.find((r) => r.name.trim() === bareName);
      if (row) {
        const current = row.count;
        const currentNum = (current === "" || current === null || current === undefined) ? null : Number(current);
        if (currentNum !== null && !isNaN(currentNum)) {
          row.count = currentNum + qty;
        }
      }
    }
    order.synced = "n";
    return stockTab;
  }

  return stockTab;
}

// ---- Run tests ----
let pass = 0, fail = 0;
for (const test of tests) {
  const stock = JSON.parse(JSON.stringify(test.setup.stock)); // deep clone
  const order = { ...test.order };
  applyOrder(stock, order);
  const ok = test.assert(stock);
  if (ok) {
    console.log(`✅ ${test.name}`);
    pass++;
  } else {
    console.error(`❌ ${test.name}`);
    console.error("   Final stock state:", JSON.stringify(stock, null, 2));
    fail++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
