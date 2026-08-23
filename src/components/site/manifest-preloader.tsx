"use client";

import { useEffect } from "react";
import { preloadImageManifest } from "@/lib/image-manifest";

/**
 * ManifestPreloader — loads the image manifest on app startup.
 *
 * The manifest lists which images are LOCAL (on Cloudflare Pages).
 * Once loaded, ProductImage uses getLocalPathSync() to serve images
 * from Pages (unlimited bandwidth, no throttling) instead of Cloudinary.
 *
 * This component renders nothing — it's just for the side effect.
 */
export function ManifestPreloader() {
  useEffect(() => {
    preloadImageManifest().catch(() => {});
  }, []);

  // Render nothing — this is a side-effect-only component
  return null;
}
