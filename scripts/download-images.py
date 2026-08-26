#!/usr/bin/env python3
"""
Download all product images from Cloudinary and save them locally.
This migrates images to Cloudflare Pages (unlimited bandwidth) for the
bulletproof spike-handling strategy.
"""
import json
import os
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

OUT_DIR = "/home/z/my-project/public/images/products"
os.makedirs(OUT_DIR, exist_ok=True)

# Load products
with open('/tmp/products_all.json') as f:
    data = json.load(f)

# Dedupe by ID
seen = set()
unique = []
for p in data:
    pid = p.get('id', '').strip()
    if pid and pid not in seen:
        seen.add(pid)
        unique.append(p)

# Collect all image URLs with their local filenames
# We use the format: {productId}-{index}.ext
# Extract the extension from the Cloudinary URL (after the last /)
to_download = []
for p in unique:
    pid = p.get('id', '')
    # Cover image (index 1)
    img = p.get('image', '')
    if img and img.startswith('http'):
        # Get extension from URL
        # URL format: https://res.cloudinary.com/.../v123/nouveau-xxx-1.jpg
        # Extract extension from the filename part
        ext = 'jpg'  # default
        match = re.search(r'\.(jpg|jpeg|png|webp|gif)(\?|$)', img, re.I)
        if match:
            ext = match.group(1).lower()
            if ext == 'jpeg':
                ext = 'jpg'
        local_path = f"{pid}-1.{ext}"
        to_download.append((img, local_path, pid, 1))

    # Additional images
    imgs = p.get('images', '')
    if imgs:
        urls = [u.strip() for u in imgs.split('~~~') if u.strip().startswith('http')]
        for idx, url in enumerate(urls, start=1):
            ext = 'jpg'
            match = re.search(r'\.(jpg|jpeg|png|webp|gif)(\?|$)', url, re.I)
            if match:
                ext = match.group(1).lower()
                if ext == 'jpeg':
                    ext = 'jpg'
            local_path = f"{pid}-{idx}.{ext}"
            # Skip if it's the cover image (already added)
            if url != img:
                to_download.append((url, local_path, pid, idx))

# Dedupe by local_path (keep first occurrence)
seen_paths = set()
final = []
for url, path, pid, idx in to_download:
    if path not in seen_paths:
        seen_paths.add(path)
        final.append((url, path, pid, idx))

print(f"Total images to download: {len(final)}")

# Download with 8 parallel threads
def download_one(item):
    url, local_path, pid, idx = item
    full_path = os.path.join(OUT_DIR, local_path)
    if os.path.exists(full_path) and os.path.getsize(full_path) > 1000:
        return (local_path, True, "cached")
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            with open(full_path, 'wb') as f:
                f.write(data)
        return (local_path, True, f"{len(data)} bytes")
    except Exception as e:
        return (local_path, False, str(e))

downloaded = 0
failed = 0
with ThreadPoolExecutor(max_workers=8) as executor:
    futures = {executor.submit(download_one, item): item for item in final}
    for future in as_completed(futures):
        local_path, ok, msg = future.result()
        if ok:
            downloaded += 1
        else:
            failed += 1
            print(f"  FAILED: {local_path} — {msg}")

print(f"\n=== RESULTS ===")
print(f"Downloaded: {downloaded}")
print(f"Failed: {failed}")
print(f"Output dir: {OUT_DIR}")

# Calculate total size
total_size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR) if os.path.isfile(os.path.join(OUT_DIR, f)))
print(f"Total size: {total_size / 1024 / 1024:.1f} MB")
print(f"File count: {len(os.listdir(OUT_DIR))}")
