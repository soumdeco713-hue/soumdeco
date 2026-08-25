// Test the user's exact scenario:
// - Product name has commas: "Cocotte minute 06, 08, 10, 12 litres Ref 01"
// - Order has color (infinite, no Stock tab row) + size (with stock)
// - Variant column was empty, but variant is in notes
// - Admin sets status to Confirmed
// Expected: trigger finds the SIZE variant row in Stock tab, decrements it

// Mirror of splitStockKey_ + decrementStockByKey_ logic
function splitStockKey(stockKeyStr) {
  if (!stockKeyStr) return [];
  var s = String(stockKeyStr).trim();
  if (s.indexOf(';') >= 0) return s.split(';');
  return s.split(',');
}

function buildStockKey(bareName, variantStr) {
  var cleanProductName = String(bareName || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
  var variantValues = String(variantStr || '').split(' - ');
  var keys = [];
  for (var k = 0; k < variantValues.length; k++) {
    var v = variantValues[k].trim();
    if (v) keys.push(cleanProductName + ' - ' + v);
  }
  return keys.join(';'); // NEW: semicolon separator
}

// Simulate the trigger's decrement logic
function simulateTrigger(stockTab, stockKeyStr, qty) {
  var keys = splitStockKey(stockKeyStr);
  console.log('  Parsed keys (' + keys.length + '):');
  keys.forEach((k, i) => console.log('    [' + i + '] "' + k.trim() + '"'));

  for (var k = 0; k < keys.length; k++) {
    var key = keys[k].trim();
    if (!key) continue;
    // Look for matching row in Stock tab
    for (var i = 0; i < stockTab.length; i++) {
      if (String(stockTab[i].name || '').trim() === key) {
        var current = stockTab[i].count;
        var currentNum = (current === '' || current === null || current === undefined) ? null : Number(current);
        if (currentNum === null || isNaN(currentNum)) {
          console.log('  → "' + key + '" found but EMPTY (infinite) → skip');
          break; // try next key
        }
        var next = Math.max(0, currentNum - qty);
        stockTab[i].count = next;
        console.log('  → "' + key + '" FOUND ✓ decremented ' + qty + ' → ' + next);
        return true;
      }
    }
    if (i === stockTab.length) {
      console.log('  → "' + key + '" NOT FOUND in Stock tab → skip');
    }
  }
  return false;
}

// ============================================================
// TEST: User's exact scenario
// ============================================================
console.log('=== TEST: Cocotte with commas in name + color+size variants ===\n');

const productName = 'Cocotte minute 06, 08, 10, 12 litres Ref 01';
const variantStr = 'Red - 06L'; // color + size combo

// Build stockKey with NEW ";" separator
const stockKey = buildStockKey(productName, variantStr);
console.log('Variant:  "' + variantStr + '"');
console.log('StockKey: "' + stockKey + '"');
console.log('');

// Stock tab: color is INFINITE (no row), size has stock
const stockTab = [
  { name: 'Cocotte minute 06, 08, 10, 12 litres Ref 01 - 06L', count: 5 },
  { name: 'Cocotte minute 06, 08, 10, 12 litres Ref 01 - 08L', count: 3 },
  { name: 'Cocotte minute 06, 08, 10, 12 litres Ref 01 - 10L', count: 0 },
  // Note: NO row for "Cocotte minute 06, 08, 10, 12 litres Ref 01 - Red" (color is infinite)
];

console.log('Stock tab BEFORE decrement:');
stockTab.forEach(r => console.log('  "' + r.name + '" → ' + r.count));
console.log('');

console.log('Trigger fires (qty=1):');
const result = simulateTrigger(stockTab, stockKey, 1);
console.log('');
console.log('Result: ' + (result ? '✅ DECREMENTED' : '❌ NO MATCH'));
console.log('');

console.log('Stock tab AFTER decrement:');
stockTab.forEach(r => console.log('  "' + r.name + '" → ' + r.count));
console.log('');

// Verify: 06L should be decremented from 5 to 4
const sizeRow = stockTab.find(r => r.name.endsWith(' - 06L'));
if (sizeRow.count === 4) {
  console.log('✅ PASS: "06L" was decremented 5 → 4');
} else {
  console.log('❌ FAIL: "06L" should be 4 but is ' + sizeRow.count);
}

// ============================================================
// TEST 2: OLD comma format (legacy stockKey) — should still work via smart split
// ============================================================
console.log('\n=== TEST 2: Legacy comma format (product name has NO commas) ===\n');

const productName2 = 'Simple Product';
const variantStr2 = 'Red - Large';
const stockKey2Legacy = 'Simple Product - Red,Simple Product - Large'; // comma
console.log('StockKey (legacy): "' + stockKey2Legacy + '"');

const stockTab2 = [
  { name: 'Simple Product - Red', count: '' },    // infinite
  { name: 'Simple Product - Large', count: 2 },
];

console.log('Trigger fires (qty=1):');
const result2 = simulateTrigger(stockTab2, stockKey2Legacy, 1);
console.log('Result: ' + (result2 ? '✅ DECREMENTED' : '❌ NO MATCH'));
console.log('Final "Large" count: ' + stockTab2[1].count);
if (stockTab2[1].count === 1) {
  console.log('✅ PASS: "Large" was decremented 2 → 1');
} else {
  console.log('❌ FAIL: "Large" should be 1 but is ' + stockTab2[1].count);
}
