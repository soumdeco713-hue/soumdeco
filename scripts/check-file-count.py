#!/usr/bin/env python3
"""
Count image files in /public/images/products/ and check against
Cloudflare Pages' 20,000 file limit.
"""
import os
import sys

IMAGES_DIR = "/home/z/my-project/public/images/products"
CF_PAGES_FILE_LIMIT = 20_000
WARN_THRESHOLD = 15_000  # 75% of limit

def count_images():
    if not os.path.isdir(IMAGES_DIR):
        return 0
    return len([f for f in os.listdir(IMAGES_DIR) if os.path.isfile(os.path.join(IMAGES_DIR, f))])

def main():
    count = count_images()
    products_est = count // 8  # estimate ~8 images per product
    pct = (count / CF_PAGES_FILE_LIMIT) * 100

    print(f"=== Image File Count Check ===")
    print(f"Total image files: {count}")
    print(f"Estimated products: ~{products_est}")
    print(f"Cloudflare Pages limit: {CF_PAGES_FILE_LIMIT}")
    print(f"Usage: {pct:.1f}%")
    print()

    if count >= CF_PAGES_FILE_LIMIT:
        print("❌ CRITICAL: At Cloudflare Pages file limit!")
        print("   The next deploy will FAIL. Action required:")
        print("   1. Add a credit card to Cloudflare")
        print("   2. Enable R2 (uncomment [[r2_buckets]] in wrangler.toml)")
        print("   3. Run: npx wrangler r2 bucket create soumdeco-images")
        print("   4. Set R2_PUBLIC_BASE_URL env var")
        print("   5. New uploads go to R2; old images stay on Pages")
        sys.exit(1)
    elif count >= WARN_THRESHOLD:
        print(f"⚠️  WARNING: Approaching file limit ({count}/{CF_PAGES_FILE_LIMIT})")
        print(f"   {CF_PAGES_FILE_LIMIT - count} file slots remaining.")
        print(f"   At ~8 images/product, that's ~{(CF_PAGES_FILE_LIMIT - count) // 8} more products.")
        print(f"   Plan migration to R2 before hitting the limit.")
        sys.exit(0)
    else:
        print(f"✅ OK: {count}/{CF_PAGES_FILE_LIMIT} files ({pct:.1f}%)")
        print(f"   Room for ~{(CF_PAGES_FILE_LIMIT - count) // 8} more products.")
        sys.exit(0)

if __name__ == "__main__":
    main()
