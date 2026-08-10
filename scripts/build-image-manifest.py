#!/usr/bin/env python3
"""
Build the image manifest — a JSON file listing all local image files.

This script scans /public/images/products/ and writes /public/image-manifest.json.
The frontend uses this manifest to decide which Cloudinary URLs to rewrite
to local paths (hot tier = Cloudflare Pages, unlimited bandwidth).

Run this script:
  - After downloading new images (scripts/sync-images.py)
  - After deleting images (scripts/cleanup-images.py)
  - Before every deploy (it runs automatically via the build)

Output format:
  {
    "localFiles": ["nouveau-5bzz3-1.jpg", "nouveau-5bzz3-2.jpg", ...],
    "builtAt": "2026-08-10T12:34:56.789Z",
    "count": 109
  }
"""
import json
import os
from datetime import datetime, timezone

IMAGES_DIR = "/home/z/my-project/public/images/products"
MANIFEST_PATH = "/home/z/my-project/public/image-manifest.json"

def main():
    if not os.path.isdir(IMAGES_DIR):
        print(f"Images directory not found: {IMAGES_DIR}")
        # Write empty manifest so the frontend doesn't break
        with open(MANIFEST_PATH, "w") as f:
            json.dump({
                "localFiles": [],
                "builtAt": datetime.now(timezone.utc).isoformat(),
                "count": 0,
            }, f)
        print("Wrote empty manifest.")
        return

    files = sorted([
        f for f in os.listdir(IMAGES_DIR)
        if os.path.isfile(os.path.join(IMAGES_DIR, f))
    ])

    manifest = {
        "localFiles": files,
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "count": len(files),
    }

    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f)

    print(f"=== Image Manifest Built ===")
    print(f"Files: {len(files)}")
    print(f"Output: {MANIFEST_PATH}")
    print(f"Size: {os.path.getsize(MANIFEST_PATH) / 1024:.1f} KB")
    print(f"Cloudflare Pages limit: 20,000 files")
    print(f"Usage: {len(files) / 20000 * 100:.1f}%")
    if len(files) > 19000:
        print(f"⚠️  WARNING: Approaching file limit ({len(files)}/20000)")
    elif len(files) > 20000:
        print(f"❌ CRITICAL: Over file limit! Deploy will fail.")

if __name__ == "__main__":
    main()
