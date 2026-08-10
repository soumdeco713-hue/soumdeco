// ============================================================
//  IMAGE MANIFEST — Hot Tier (Cloudflare Pages)
// ============================================================
//  Lists which product images are LOCAL (served from Cloudflare Pages,
//  unlimited bandwidth + unlimited requests = no throttling).
//
//  WHY: Cloudinary throttles when 80+ images load simultaneously.
//  Cloudflare Pages serves unlimited images with zero throttling.
//  This manifest tells the frontend which images to serve locally.
//
//  The manifest is built at deploy time by scripts/build-image-manifest.py
//  and shipped as /public/image-manifest.json.
// ============================================================

const MANIFEST_URL = "/image-manifest.json";

type ImageManifest = {
  localFiles: string[];
  builtAt: string;
  count: number;
};

let manifestCache: ImageManifest | null = null;
let localFilesSet: Set<string> = new Set();
let manifestLoadPromise: Promise<ImageManifest | null> | null = null;

/**
 * Load the image manifest (built at deploy time).
 * Caches the result for O(1) lookups via getLocalPathSync().
 */
export async function loadImageManifest(): Promise<ImageManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestLoadPromise) return manifestLoadPromise;

  manifestLoadPromise = (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "force-cache" });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.localFiles)) return null;
      manifestCache = data as ImageManifest;
      localFilesSet = new Set(manifestCache.localFiles);
      return manifestCache;
    } catch {
      return null;
    }
  })();

  return manifestLoadPromise;
}

/**
 * Extract the filename from a Cloudinary URL.
 * Example: https://res.cloudinary.com/.../image/upload/v1234567890/nouveau-5bzz3-1.jpg
 *       → nouveau-5bzz3-1.jpg
 */
export function extractFilename(cloudinaryUrl: string): string | null {
  const CLOUDINARY_RE = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)?(?:v\d+\/)?(.+)$/;
  const match = cloudinaryUrl.match(CLOUDINARY_RE);
  return match ? match[1] : null;
}

/**
 * Synchronous check — uses the cached manifest.
 * Returns the local path if the image is in the manifest, null otherwise.
 *
 * IMPORTANT: Call loadImageManifest() on app startup to populate the cache.
 * This sync function returns null until the manifest loads.
 */
export function getLocalPathSync(cloudinaryUrl: string): string | null {
  if (localFilesSet.size === 0) return null;

  const filename = extractFilename(cloudinaryUrl);
  if (!filename) return null;

  if (localFilesSet.has(filename)) {
    return `/images/products/${filename}`;
  }
  return null;
}

/**
 * Preload the manifest on app startup.
 */
export async function preloadImageManifest(): Promise<void> {
  await loadImageManifest();
}

/**
 * Get the manifest's file count (for monitoring).
 */
export function getManifestCount(): number {
  return manifestCache?.count ?? 0;
}
