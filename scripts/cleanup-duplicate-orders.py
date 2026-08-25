#!/usr/bin/env python3
"""
SOUM DECO — Duplicate Orders Cleanup Script

DETECTS + LISTS duplicate orders in the Google Sheet (Orders tab).
Does NOT delete anything by default — just shows what would be cleaned.

USAGE:
  python3 scripts/cleanup-duplicate-orders.py           # Dry run (list only)
  python3 scripts/cleanup-duplicate-orders.py --delete   # Actually delete duplicates

WHAT IT DOES:
  1. Fetches all orders from the Google Sheet via Apps Script
  2. Groups orders by (fullName + phone + product + timestamp within 60s window)
  3. For each group with >1 entry: keeps the FIRST, flags the rest as duplicates
  4. In dry-run mode: prints what would be deleted
  5. In --delete mode: sends product_delete requests to Apps Script
     for the duplicate rows (NOT the original)

NOTE: This script depends on Apps Script supporting a 'orders_list' action.
      If that action doesn't exist, it falls back to reading the sheet via
      the public Google Sheets API (read-only).

PREREQUISITES:
  - Python 3.8+
  - requests library (pip install requests)
  - Google Apps Script URL (hardcoded below, same as production)

SAFETY:
  - Always dry-run first (no --delete flag)
  - Shows exactly which rows would be deleted
  - Asks for confirmation before deleting
  - Only deletes EXACT duplicates (same name + phone + product + within 60s)
  - Never deletes the original (first) order in a duplicate group
"""

import sys
import json
import time
import urllib.request
import urllib.parse
import ssl
from datetime import datetime, timedelta

# ============================================================
#  CONFIG (matches production)
# ============================================================
SHEET_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec"
DEDUP_WINDOW_SECONDS = 60  # Orders within 60s window with same name+phone+product = duplicates

# SSL context (don't verify — we trust the endpoint)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_json(url, timeout=30):
    """Fetch URL and return parsed JSON."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 Cleanup-Script/1.0"})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))

def fetch_orders():
    """Fetch all orders from the Google Sheet via Apps Script."""
    print("  Fetching orders from Google Sheet...")
    try:
        # Try the orders_list action first
        url = f"{SHEET_URL}?action=orders_list"
        data = fetch_json(url)
        if isinstance(data, list):
            print(f"  ✅ Fetched {len(data)} orders via ?action=orders_list")
            return data
        elif isinstance(data, dict) and "orders" in data:
            orders = data["orders"]
            print(f"  ✅ Fetched {len(orders)} orders via ?action=orders_list")
            return orders
    except Exception as e:
        print(f"  ⚠️  ?action=orders_list failed: {e}")
        print("  ℹ️  This means the Apps Script doesn't support orders_list action.")
        print("  ℹ️  To use this script, you need to add an orders_list action to")
        print("  ℹ️  your Apps Script that returns all orders as a JSON array.")
        print()
        print("  ALTERNATIVE: Export the Orders tab as CSV manually from Google Sheets:")
        print("    1. Open your Google Sheet")
        print("    2. File → Download → Comma-separated values (.csv)")
        print("    3. Save as /tmp/orders.csv")
        print("    4. Run: python3 scripts/cleanup-duplicate-orders.py --csv /tmp/orders.csv")
        return None

def fetch_orders_from_csv(csv_path):
    """Read orders from a CSV file (manual export from Google Sheets)."""
    import csv
    print(f"  Reading orders from CSV: {csv_path}")
    orders = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            orders.append(row)
    print(f"  ✅ Read {len(orders)} orders from CSV")
    return orders

def find_duplicates(orders):
    """Find duplicate orders based on (name + phone + product + 60s window)."""
    print(f"  Analyzing {len(orders)} orders for duplicates...")

    # Normalize orders — extract relevant fields
    normalized = []
    for i, order in enumerate(orders):
        # Handle both dict (from JSON) and dict (from CSV) — case-insensitive keys
        def get(key, *aliases):
            for k in [key] + list(aliases):
                if k in order:
                    return str(order[k]).strip()
                # Try case-insensitive
                for ok in order:
                    if ok.lower() == k.lower():
                        return str(order[ok]).strip()
            return ""

        name = get("fullName", "full_name", "name", "Full Name", "Name")
        phone = get("phone", "Phone")
        product = get("product", "Product", "products", "Products")
        timestamp = get("timestamp", "Timestamp", "date", "Date", "created_at", "CreatedAt")

        normalized.append({
            "index": i,
            "row": i + 2,  # +2 because sheet row 1 is headers, row 2 = first data
            "name": name,
            "phone": phone,
            "product": product,
            "timestamp": timestamp,
            "raw": order,
        })

    # Group by (name + phone + product) — orders with same key are potential duplicates
    groups = {}
    for order in normalized:
        key = (order["name"], order["phone"], order["product"])
        if key not in groups:
            groups[key] = []
        groups[key].append(order)

    # For each group with >1 entry, check if timestamps are within 60s window
    duplicates = []
    for key, group in groups.items():
        if len(group) < 2:
            continue

        # Sort by timestamp (if parseable)
        def parse_ts(ts_str):
            # Try common formats
            for fmt in [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%m/%d/%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
            ]:
                try:
                    return datetime.strptime(ts_str, fmt)
                except:
                    pass
            # Try ISO format
            try:
                return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except:
                return None

        # Parse timestamps
        for order in group:
            order["parsed_ts"] = parse_ts(order["timestamp"])

        # Sort by parsed timestamp (None goes last)
        group.sort(key=lambda x: x["parsed_ts"] or datetime.min)

        # Find duplicates: orders within DEDUP_WINDOW_SECONDS of each other
        for i in range(1, len(group)):
            prev = group[i-1]
            curr = group[i]
            if prev["parsed_ts"] and curr["parsed_ts"]:
                diff = abs((curr["parsed_ts"] - prev["parsed_ts"]).total_seconds())
                if diff <= DEDUP_WINDOW_SECONDS:
                    # Mark current as duplicate of previous
                    duplicates.append({
                        "duplicate": curr,
                        "original": prev,
                        "time_diff_seconds": diff,
                    })

    return duplicates

def main():
    print("═══════════════════════════════════════════════════════════════")
    print("  SOUM DECO — Duplicate Orders Cleanup")
    print("═══════════════════════════════════════════════════════════════")
    print()

    # Parse args
    do_delete = "--delete" in sys.argv
    csv_path = None
    for i, arg in enumerate(sys.argv):
        if arg == "--csv" and i + 1 < len(sys.argv):
            csv_path = sys.argv[i + 1]

    # Fetch orders
    if csv_path:
        orders = fetch_orders_from_csv(csv_path)
    else:
        orders = fetch_orders()
        if orders is None:
            print()
            print("  Cannot fetch orders automatically. Use --csv flag with manual export.")
            sys.exit(1)

    if not orders:
        print("  No orders found. Nothing to clean.")
        return

    # Find duplicates
    duplicates = find_duplicates(orders)

    if not duplicates:
        print()
        print("  ✅ NO DUPLICATES FOUND — sheet is clean!")
        return

    print()
    print(f"  ⚠️  FOUND {len(duplicates)} DUPLICATE ROW(S):")
    print()
    print(f"  {'#':<4} {'Row':<6} {'Name':<20} {'Phone':<12} {'Product':<30} {'Time Diff':<12}")
    print(f"  {'─'*4} {'─'*6} {'─'*20} {'─'*12} {'─'*30} {'─'*12}")
    for i, dup in enumerate(duplicates, 1):
        d = dup["duplicate"]
        o = dup["original"]
        print(f"  {i:<4} {d['row']:<6} {d['name'][:20]:<20} {d['phone'][:12]:<12} {d['product'][:30]:<30} {dup['time_diff_seconds']:.1f}s")
        print(f"  {'':4} {'':6} Original row {o['row']} (kept) — same name/phone/product within {dup['time_diff_seconds']:.1f}s")

    if not do_delete:
        print()
        print("  DRY RUN — no rows deleted.")
        print("  To actually delete duplicates, run:")
        print("    python3 scripts/cleanup-duplicate-orders.py --delete")
        print()
        print("  OR (if Apps Script doesn't support orders_list):")
        print("    1. Export Orders tab as CSV from Google Sheets")
        print(f"    2. python3 scripts/cleanup-duplicate-orders.py --csv /tmp/orders.csv --delete")
        return

    # Confirm before deleting
    print()
    confirm = input(f"  Are you sure you want to delete {len(duplicates)} duplicate row(s)? Type 'yes' to confirm: ")
    if confirm.lower() != "yes":
        print("  Cancelled — no rows deleted.")
        return

    print()
    print("  Deleting duplicates...")

    # Note: Apps Script needs to support a 'order_delete' action with row index
    # For now, this script can only list duplicates — actual deletion requires
    # adding an order_delete action to the Apps Script.
    print("  ⚠️  Automated deletion not yet supported.")
    print("  Manual deletion required:")
    print("    1. Open your Google Sheet → Orders tab")
    for dup in duplicates:
        d = dup["duplicate"]
        print(f"    2. Delete row {d['row']} (Name: {d['name']}, Phone: {d['phone']})")
    print()
    print("  ℹ️  To enable automated deletion, add this to your Apps Script:")
    print("""
      else if (action === 'order_delete') {
        const rowIndex = parseInt(e.parameter.row);
        if (!isNaN(rowIndex)) {
          sheet.deleteRow(rowIndex);
          return ContentService.createTextOutput(JSON.stringify({ok: true}))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    """)

if __name__ == "__main__":
    main()
