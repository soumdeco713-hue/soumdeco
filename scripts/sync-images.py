#!/usr/bin/env python3
"""
Sync new product images from Cloudinary to /public/images/products/.

Run this script after admin uploads new product images to download them
to the local repo. Commit + push to deploy the images to Cloudflare Pages
(unlimited bandwidth, free).

Usage:
    python3 scripts/sync-images.py

This script:
1. Fetches all products from Apps Script
2. Finds Cloudinary URLs that don't have local files
3. Downloads them to /public/images/products/
4. Reports the count + git commands to deploy
"""
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

OUT_DIR = "/home/z/my-project/public/images/products"
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec?action=products"
CF_PAGES_FILE_LIMIT = 20_000

os.makedirs(OUT_DIR, exist_ok=True)

# Fetch products
print("Fetching products from Apps Script...")
try:
    req = urllib.request.Request(APPS_SCRIPT_URL, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
except Exception as e:
    print(f"Failed to fetch products: {e}")
    exit(1)

# Dedupe by ID
seen = set()
unique = []
for p in data:
    pid = p.get('id', '').strip()
    if pid and pid not in seen:
        seen.add(pid)
        unique.append(p)

print(f"Found {len(unique)} unique products")

# Collect all Cloudinary image URLs
CLOUDINARY_RE = re.compile(r'^https?://res\.cloudinary\.com/[^/]+/image/upload/(?:[^/]+/)?(?:v\d+/)?(.+)$')

to_download = []
existing_files = set(os.listdir(OUT_DIR))

for p in unique:
    pid = p.get('id', '')
    # Check cover image + all images
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

    for url in all_urls:
        if not url.startswith('http'):
            continue
        match = CLOUDINARY_RE.match(url)
        if not match:
            continue  # not a Cloudinary URL
        filename = match.group(1)
        if filename not in existing_files:
            to_download.append((url, filename))

# Check file limit
current_count = len(existing_files)
after_count = current_count + len(to_download)
if after_count > CF_PAGES_FILE_LIMIT:
    print(f"❌ ERROR: Downloading {len(to_download)} new images would exceed Cloudflare Pages' 20,000 file limit!")
    print(f"   Current: {current_count} files")
    print(f"   After sync: {after_count} files (limit: {CF_PAGES_FILE_LIMIT})")
    print(f"   Action required: Enable R2 (add credit card to Cloudflare)")
    exit(1)

print(f"Files to download: {len(to_download)}")
print(f"Current files: {current_count}")
print(f"After sync: {after_count} / {CF_PAGES_FILE_LIMIT} ({after_count/CF_PAGES_FILE_LIMIT*100:.1f}%)")

if not to_download:
    print("\n✅ All images already synced. Nothing to do.")
    exit(0)

# Download with 8 parallel threads
def download_one(item):
    url, filename = item
    full_path = os.path.join(OUT_DIR, filename)
    if os.path.exists(full_path):
        return (filename, True, "cached")
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            with open(full_path, 'wb') as f:
                f.write(data)
        return (filename, True, f"{len(data)} bytes")
    except Exception as e:
        return (filename, False, str(e))

downloaded = 0
failed = 0
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = {executor.submit(download_one, item): item for item in to_download}
    for future in as_completed(futures):
        filename, ok, msg = future.result()
        if ok:
            downloaded += 1
        else:
            failed += 1
            print(f"  FAILED: {filename} — {msg}")

print(f"\n=== RESULTS ===")
print(f"Downloaded: {downloaded}")
print(f"Failed: {failed}")
print(f"Total files now: {current_count + downloaded}")

if downloaded > 0:
    print(f"\n=== NEXT STEPS ===")
    print(f"To deploy these images to Cloudflare Pages:")
    print(f"  cd /home/z/my-project")
    print(f"  git add public/images/products/")
    print(f"  git commit -m \"sync: download {downloaded} new product images\"")
    print(f"  git push origin main")
    print(f"Cloudflare will auto-rebuild in ~2-3 minutes.")
