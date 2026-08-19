#!/usr/bin/env python3
"""
Build the image manifest — a JSON file listing all local image files.
The frontend uses this to decide which Cloudinary URLs to serve locally.

CRITICAL: Uses SCRIPT_DIR/REPO_ROOT pattern (not hardcoded paths) so it
works in both local dev and GitHub Actions CI.
"""
import json
import os
import sys
from datetime import datetime, timezone

# Resolve paths relative to the script location (works locally + in CI)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
IMAGES_DIR = os.path.join(REPO_ROOT, "public", "images", "products")
MANIFEST_PATH = os.path.join(REPO_ROOT, "public", "image-manifest.json")

CF_PAGES_FILE_LIMIT = 20_000

def main():
    if not os.path.isdir(IMAGES_DIR):
        os.makedirs(IMAGES_DIR, exist_ok=True)
        files = []
    else:
        files = sorted([
            f for f in os.listdir(IMAGES_DIR)
            if os.path.isfile(os.path.join(IMAGES_DIR, f))
        ])

    manifest = {
        "localFiles": files,
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "count": len(files),
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)

    print(f"=== Image Manifest Built ===")
    print(f"Files: {len(files)}")
    print(f"Output: {MANIFEST_PATH}")
    print(f"Cloudflare Pages limit: {CF_PAGES_FILE_LIMIT} files")
    print(f"Usage: {len(files) / CF_PAGES_FILE_LIMIT * 100:.1f}%")

    # FAIL-LOUD: if manifest is empty, exit with error (prevents deploy with broken images)
    if len(files) == 0:
        print("ERROR: Manifest is empty! No images found in", IMAGES_DIR)
        print("This will break ALL product images on the deployed site.")
        sys.exit(1)

if __name__ == "__main__":
    main()
