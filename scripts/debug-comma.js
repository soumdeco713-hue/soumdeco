// Debug the comma product test failure
const commaName = "Cocotte minute 06, 08, 10, 12 litres Ref 01";
const productName = commaName + " ×1";
const notes = "المقاس: 06L";

console.log("productName:", JSON.stringify(productName));
console.log("notes:", JSON.stringify(notes));

// Strip ×N
const bareName = productName.replace(/\s*[×x]\s*\d+\s*$/, "").trim();
console.log("bareName:", JSON.stringify(bareName));

// Check for multi-item
console.log("has '+'?", productName.indexOf("+") >= 0);

// Notes extraction
function extractVariantFromNotes(notes) {
  var notesStr = String(notes || "").trim();
  if (!notesStr) return "";
  var labels = [
    "المقاس", "اللون", "الحجم", "الوزن", "النوع", "النموذج",
    "Taille", "Couleur", "Modèle", "Size", "Color",
  ];
  var parts = notesStr.split("·");
  var values = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var colonIdx = part.lastIndexOf(":");
    if (colonIdx < 0) continue;
    var label = part.substring(0, colonIdx).trim().toLowerCase();
    var value = part.substring(colonIdx + 1).trim();
    if (!value) continue;
    var isVariant = false;
    for (var l = 0; l < labels.length; l++) {
      if (label === labels[l].toLowerCase()) { isVariant = true; break; }
    }
    if (isVariant) {
      value = value.replace(/\s+[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u, "").trim();
      if (value) values.push(value);
    }
  }
  return values.join(" - ");
}

const variant = extractVariantFromNotes(notes);
console.log("extracted variant:", JSON.stringify(variant));

// Build stockKey
const cleanProductName = bareName.replace(/\s*\([^)]+\)\s*$/, "").trim();
const stockKey = cleanProductName + " - " + variant;
console.log("stockKey:", JSON.stringify(stockKey));

// Stock row
const stockRowName = commaName + " - 06L";
console.log("stockRowName:", JSON.stringify(stockRowName));
console.log("strings equal?", stockKey === stockRowName);
console.log("stockKey length:", stockKey.length);
console.log("stockRowName length:", stockRowName.length);

// Split
function splitStockKey(s) {
  if (!s) return [];
  s = String(s).trim();
  if (s.indexOf(";") >= 0) return s.split(";");
  return s.split(",");
}
const keys = splitStockKey(stockKey);
console.log("split keys:", JSON.stringify(keys));
console.log("keys length:", keys.length);

// Decrement
const stock = [{ name: stockRowName, count: 5 }];
function decrementByKey(stockTab, key, qty) {
  for (var i = 0; i < stockTab.length; i++) {
    console.log(`  comparing "${stockTab[i].name}" with "${key}" → ${stockTab[i].name === key}`);
    if (String(stockTab[i].name || "").trim() === key.trim()) {
      var current = stockTab[i].count;
      var currentNum = (current === "" || current === null || current === undefined) ? null : Number(current);
      if (currentNum === null || isNaN(currentNum)) return false;
      stockTab[i].count = Math.max(0, currentNum - qty);
      return true;
    }
  }
  return false;
}
const result = decrementByKey(stock, keys[0], 1);
console.log("decrement result:", result);
console.log("stock after:", JSON.stringify(stock));
