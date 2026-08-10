#!/usr/bin/env python3
"""
Build the image manifest — a JSON file listing all local image files.
The frontend uses this to decide which Cloudinary URLs to serve locally.
"""
import json
import os
from datetime import datetime, timezone

IMAGES_DIR = "/home/z/my-project/public/images/products"
MANIFEST_PATH = "/home/z/my-project/public/image-manifest.json"

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

    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f)

    print(f"=== Image Manifest Built ===")
    print(f"Files: {len(files)}")
    print(f"Output: {MANIFEST_PATH}")
    print(f"Cloudflare Pages limit: 20,000 files")
    print(f"Usage: {len(files) / 20000 * 100:.1f}%")

if __name__ == "__main__":
    main()
