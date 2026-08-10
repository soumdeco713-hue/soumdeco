#!/usr/bin/env python3
"""
Cleanup orphaned images — removes local image files for products that
no longer exist in the Google Sheet.

Run this script:
  - After admin deletes products (frees Cloudflare Pages file slots)
  - Periodically to reclaim space from deleted products

This is the "admin delete = free slot" mechanism:
  When admin deletes a product, the Apps Script removes the row from the sheet.
  The product's local image files become orphaned.
  This script detects orphans and deletes them, freeing slots for new products.

Usage:
    python3 scripts/cleanup-images.py          # dry run (shows what would be deleted)
    python3 scripts/cleanup-images.py --delete # actually delete
"""
import json
import os
import re
import sys
import urllib.request

IMAGES_DIR = "/home/z/my-project/public/images/products"
MANIFEST_PATH = "/home/z/my-project/public/image-manifest.json"
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=products"
CLOUDINARY_RE = re.compile(r'^https?://res\.cloudinary\.com/[^/]+/image/upload/(?:[^/]+/)?(?:v\d+/)?(.+)$')

def fetch_products():
    print("Fetching products from Apps Script...")
    req = urllib.request.Request(APPS_SCRIPT_URL, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    # Dedupe by ID, collect all image filenames
    seen = set()
    used_files = set()
    for p in data:
        pid = p.get('id', '').strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        # Collect all image URLs for this product
        all_urls = []
        img = p.get('image', '')
        if img:
            all_urls.append(img)
        imgs = p.get('images', '')
        if imgs:
            for u in imgs.split('~~~'):
                u = u.strip()
                if u and u not in all_urls:
                    all_urls.append(u)
        # Extract filenames
        for url in all_urls:
            if not url.startswith('http'):
                continue
            match = CLOUDINARY_RE.match(url)
            if match:
                used_files.add(match.group(1))
    return used_files

def main():
    do_delete = '--delete' in sys.argv

    # Get all local files
    if not os.path.isdir(IMAGES_DIR):
        print(f"Images directory not found: {IMAGES_DIR}")
        return
    local_files = set(os.listdir(IMAGES_DIR))

    # Get all files referenced by products
    try:
        used_files = fetch_products()
    except Exception as e:
        print(f"Failed to fetch products: {e}")
        return

    # Find orphans (local files not referenced by any product)
    orphans = local_files - used_files

    print(f"\n=== Cleanup Report ===")
    print(f"Local files: {len(local_files)}")
    print(f"Used files (in sheet): {len(used_files)}")
    print(f"Orphaned files: {len(orphans)}")

    if not orphans:
        print("✅ No orphans. Nothing to clean up.")
        return

    print(f"\nOrphaned files (first 20):")
    for f in sorted(orphans)[:20]:
        print(f"  {f}")
    if len(orphans) > 20:
        print(f"  ... and {len(orphans) - 20} more")

    if not do_delete:
        print(f"\n--- DRY RUN ---")
        print(f"To actually delete {len(orphans)} orphaned files, run:")
        print(f"  python3 scripts/cleanup-images.py --delete")
    else:
        print(f"\n--- DELETING {len(orphans)} orphaned files ---")
        deleted = 0
        for f in orphans:
            path = os.path.join(IMAGES_DIR, f)
            try:
                os.remove(path)
                deleted += 1
            except Exception as e:
                print(f"  FAILED: {f} — {e}")
        print(f"Deleted: {deleted}")
        print(f"Files remaining: {len(local_files) - deleted}")

        # Rebuild manifest
        print("\nRebuilding manifest...")
        import subprocess
        subprocess.run(["python3", "/home/z/my-project/scripts/build-image-manifest.py"])

if __name__ == "__main__":
    main()
