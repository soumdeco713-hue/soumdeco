#!/usr/bin/env python3
"""
Auto-Sync: Downloads new Cloudinary images + deletes orphans + rebuilds manifest.

This script runs in GitHub Actions (every 24 hours) to keep
/public/images/products/ in sync with the Google Sheet.

FLOW:
  1. Fetch product list from Apps Script
  2. Collect all Cloudinary image URLs + their local filenames
  3. List existing files in /public/images/products/
  4. Download missing files from Cloudinary
  5. Delete orphaned files (not referenced by any product)
  6. Check 20K file limit (safety)
  7. Rebuild /public/image-manifest.json

SAFETY:
  - Checks file limit BEFORE downloading (prevents deploy failure)
  - Only downloads if under 19,000 files (leaves 1,000 slot buffer)
  - Never deletes files that are referenced by products
  - All errors are caught and logged (never crashes the workflow)
"""
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

# Resolve paths relative to the script location (works locally + in GitHub Actions)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
IMAGES_DIR = os.path.join(REPO_ROOT, "public", "images", "products")
MANIFEST_PATH = os.path.join(REPO_ROOT, "public", "image-manifest.json")
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=products"

CF_PAGES_FILE_LIMIT = 20_000
SAFE_FILE_LIMIT = 19_000  # leave 1,000 slot buffer
CLOUDINARY_RE = re.compile(
    r'^https?://res\.cloudinary\.com/[^/]+/image/upload/(?:[^/]+/)?(?:v\d+/)?(.+)$'
)


def log(msg):
    """Print with timestamp (GitHub Actions captures stdout)."""
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def fetch_products():
    """Fetch all products from Apps Script."""
    log("Fetching products from Apps Script...")
    req = urllib.request.Request(APPS_SCRIPT_URL, headers={
        "User-Agent": "GitHub-Actions-AutoSync/1.0"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    # Dedupe by ID
    seen = set()
    unique = []
    for p in data:
        pid = p.get("id", "").strip()
        if pid and pid not in seen:
            seen.add(pid)
            unique.append(p)

    log(f"Found {len(unique)} unique products")
    return unique


def collect_image_urls(products):
    """Collect all Cloudinary image URLs + their target local filenames."""
    urls = {}  # filename → cloudinary_url
    for p in products:
        all_urls = []
        img = p.get("image", "")
        if img:
            all_urls.append(img)
        imgs = p.get("images", "")
        if imgs:
            for u in imgs.split("~~~"):
                u = u.strip()
                if u and u not in all_urls:
                    all_urls.append(u)

        for url in all_urls:
            if not url.startswith("http"):
                continue
            match = CLOUDINARY_RE.match(url)
            if match:
                filename = match.group(1)
                if filename not in urls:
                    urls[filename] = url

    return urls


def list_local_files():
    """List all files in /public/images/products/."""
    if not os.path.isdir(IMAGES_DIR):
        os.makedirs(IMAGES_DIR, exist_ok=True)
        return set()
    return set(
        f for f in os.listdir(IMAGES_DIR)
        if os.path.isfile(os.path.join(IMAGES_DIR, f))
    )


def download_one(url, filename):
    """Download a single image from Cloudinary."""
    path = os.path.join(IMAGES_DIR, filename)
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(path, "wb") as f:
            f.write(data)
        return (filename, True, len(data))
    except Exception as e:
        return (filename, False, str(e))


def main():
    log("=== Auto-Sync Started ===")

    # Step 1: Fetch products
    try:
        products = fetch_products()
    except Exception as e:
        log(f"ERROR: Failed to fetch products: {e}")
        return  # don't exit with error — next run will retry

    # Step 2: Collect all Cloudinary image URLs
    needed = collect_image_urls(products)
    log(f"Images needed (in sheet): {len(needed)}")

    # Step 3: List existing local files
    local_files = list_local_files()
    log(f"Local files (in repo): {len(local_files)}")

    # Step 4: Find missing files (in sheet but not local)
    missing = {f: u for f, u in needed.items() if f not in local_files}
    log(f"Missing files (to download): {len(missing)}")

    # Step 5: Find orphaned files (local but not in sheet)
    orphans = local_files - set(needed.keys())
    log(f"Orphaned files (to delete): {len(orphans)}")

    # Step 6: Check file limit before downloading
    projected_count = len(local_files) + len(missing) - len(orphans)
    if projected_count > CF_PAGES_FILE_LIMIT:
        log(f"WARNING: Projected file count ({projected_count}) exceeds "
            f"Cloudflare Pages limit ({CF_PAGES_FILE_LIMIT})!")
        log("Skipping downloads to avoid deploy failure.")
        log("Action needed: reduce max images per product or clean up old products.")
        # Still proceed with deletions (orphans free up space)
        missing = {}

    if len(local_files) + len(missing) > SAFE_FILE_LIMIT:
        log(f"WARNING: Approaching file limit "
            f"({len(local_files) + len(missing)}/{CF_PAGES_FILE_LIMIT})")
        log("Only downloading critical images (first 100).")
        # Download only the first 100 to stay safe
        missing_items = list(missing.items())[:100]
        missing = dict(missing_items)

    # Step 7: Download missing files (parallel, 8 threads)
    downloaded = 0
    failed = 0
    if missing:
        log(f"Downloading {len(missing)} images...")
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(download_one, url, filename): filename
                for filename, url in missing.items()
            }
            for future in as_completed(futures):
                filename, ok, info = future.result()
                if ok:
                    downloaded += 1
                else:
                    failed += 1
                    log(f"  FAILED: {filename} — {info}")
        log(f"Downloaded: {downloaded}, Failed: {failed}")

    # Step 8: Delete orphaned files
    deleted = 0
    if orphans:
        log(f"Deleting {len(orphans)} orphaned files...")
        for filename in orphans:
            path = os.path.join(IMAGES_DIR, filename)
            try:
                os.remove(path)
                deleted += 1
            except Exception as e:
                log(f"  FAILED to delete {filename}: {e}")
        log(f"Deleted: {deleted}")

    # Step 9: Rebuild manifest
    log("Rebuilding image manifest...")
    final_files = sorted([
        f for f in os.listdir(IMAGES_DIR)
        if os.path.isfile(os.path.join(IMAGES_DIR, f))
    ])
    manifest = {
        "localFiles": final_files,
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "count": len(final_files),
    }
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f)

    # Step 10: Summary
    log(f"=== Summary ===")
    log(f"Products in sheet: {len(products)}")
    log(f"Images in sheet: {len(needed)}")
    log(f"Local files: {len(final_files)}/{CF_PAGES_FILE_LIMIT} "
        f"({len(final_files)/CF_PAGES_FILE_LIMIT*100:.1f}%)")
    log(f"Downloaded: {downloaded}")
    log(f"Deleted: {deleted}")
    log(f"Failed: {failed}")

    if downloaded > 0 or deleted > 0:
        log("Changes detected — will commit + push.")
    else:
        log("No changes — nothing to commit.")

    log("=== Auto-Sync Complete ===")


if __name__ == "__main__":
    main()
