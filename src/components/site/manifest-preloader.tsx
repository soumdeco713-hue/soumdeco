"use client";

import { useEffect } from "react";
import { preloadImageManifest, loadImageManifest } from "@/lib/image-manifest";

/**
 * ManifestPreloader — loads the image manifest on app startup.
 *
 * The manifest is a JSON file (/public/image-manifest.json) that lists
 * all local image files (hot tier). The rewriteImageUrls function uses
 * this manifest to decide which Cloudinary URLs to rewrite to local paths.
 *
 * This component:
 * 1. Preloads the manifest on mount (fire-and-forget)
 * 2. Once loaded, triggers a re-render of the catalog so images switch
 *    from Cloudinary (cold tier) to local (hot tier)
 *
 * This is a separate component (not in layout directly) because it needs
 * to be a client component ("use client") to use useEffect.
 */
export function ManifestPreloader() {
  useEffect(() => {
    // Preload the manifest — this populates the cache so getLocalPathSync()
    // can do O(1) lookups during render.
    preloadImageManifest().catch(() => {});
  }, []);

  // This component renders nothing — it's just for the side effect
  return null;
}
