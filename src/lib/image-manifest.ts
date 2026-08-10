// ============================================================
//  IMAGE MANIFEST — Adaptive Hot/Cold Tier Strategy
// ============================================================
//  Tracks which product images are LOCAL (Cloudflare Pages, hot tier)
//  vs REMOTE (Cloudinary, cold tier).
//
//  THE PROBLEM:
//    9,500 products × 5 images = 47,500 images
//    Cloudflare Pages: 20,000 file limit (free)
//    Cloudinary: 25 GB bandwidth/month (free)
//
//  THE SOLUTION:
//    HOT TIER (Cloudflare Pages, max ~19,000 files = 3,800 products × 5):
//      - Most-viewed products, served with unlimited bandwidth
//      - Auto-promoted from cold tier when view count crosses threshold
//      - Auto-demoted when views drop (frees slot for new hot products)
//
//    COLD TIER (Cloudinary, remaining ~5,700 products):
//      - Less-viewed products, served with optimization (c_limit,w_800,q_auto,f_auto)
//      - Bandwidth stays low because unpopular products get few views
//      - 25 GB/mo covers ~24 GB of cold-tier traffic (realistic for unpopular products)
//
//  ADMIN DELETE = FREE SLOT:
//    When admin deletes a product, its local files are deleted too.
//    This frees file slots in Cloudflare Pages for new hot products.
//
//  The manifest is built at build time (scripts/build-image-manifest.py)
//  and shipped as /public/image-manifest.json. The frontend reads it to
//  decide which URLs to rewrite to local paths.
// ============================================================

const MANIFEST_URL = "/image-manifest.json";

type ImageManifest = {
  /** Set of local filenames (e.g. "nouveau-5bzz3-1.jpg") available in /images/products/ */
  localFiles: string[];
  /** Build timestamp (for cache busting) */
  builtAt: string;
  /** Total file count (for monitoring) */
  count: number;
};

let manifestCache: ImageManifest | null = null;
let manifestFetchPromise: Promise<ImageManifest | null> | null = null;

/**
 * Load the image manifest (built at deploy time).
 * Returns null if the manifest can't be loaded (e.g., first build before
 * the script runs, or network error).
 */
export async function loadImageManifest(): Promise<ImageManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestFetchPromise) return manifestFetchPromise;

  manifestFetchPromise = (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "force-cache" });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.localFiles)) return null;
      manifestCache = data as ImageManifest;
      return manifestCache;
    } catch {
      return null;
    }
  })();

  return manifestFetchPromise;
}

/**
 * Check if a Cloudinary URL has a local copy (hot tier).
 * Returns the local path if available, null otherwise.
 *
 * This is ASYNC because the manifest is loaded from /public/image-manifest.json.
 * For sync usage (in the render path), use the synchronous version below
 * which checks a pre-loaded manifest.
 */
export async function getLocalPath(cloudinaryUrl: string): Promise<string | null> {
  const manifest = await loadImageManifest();
  if (!manifest) return null;

  const filename = extractFilename(cloudinaryUrl);
  if (!filename) return null;

  if (manifest.localFiles.includes(filename)) {
    return `/images/products/${filename}`;
  }
  return null;
}

/**
 * Extract the filename from a Cloudinary URL.
 * Example: https://res.cloudinary.com/anhvhy4j/image/upload/v1234567890/nouveau-5bzz3-1.jpg
 *       → nouveau-5bzz3-1.jpg
 */
export function extractFilename(cloudinaryUrl: string): string | null {
  const CLOUDINARY_RE = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)?(?:v\d+\/)?(.+)$/;
  const match = cloudinaryUrl.match(CLOUDINARY_RE);
  return match ? match[1] : null;
}

/**
 * Synchronous check — uses the cached manifest.
 * Returns the local path if the manifest is loaded AND the file is local,
 * null otherwise (caller should use the Cloudinary URL).
 *
 * IMPORTANT: Call loadImageManifest() on app startup to populate the cache.
 * This sync function will return null until the manifest loads.
 */
export function getLocalPathSync(cloudinaryUrl: string): string | null {
  if (!manifestCache) return null;

  const filename = extractFilename(cloudinaryUrl);
  if (!filename) return null;

  // Use Set for O(1) lookup (manifest can have 19,000 entries)
  if (localFilesSet.has(filename)) {
    return `/images/products/${filename}`;
  }
  return null;
}

// Build a Set from the manifest for O(1) lookups
let localFilesSet: Set<string> = new Set();

function rebuildSet() {
  if (manifestCache) {
    localFilesSet = new Set(manifestCache.localFiles);
  }
}

/**
 * Preload the manifest on app startup.
 * Call this once in the root layout or page component.
 */
export async function preloadImageManifest(): Promise<void> {
  const manifest = await loadImageManifest();
  if (manifest) {
    rebuildSet();
  }
}

/**
 * Get the manifest's file count (for monitoring/debugging).
 */
export function getManifestCount(): number {
  return manifestCache?.count ?? 0;
}
