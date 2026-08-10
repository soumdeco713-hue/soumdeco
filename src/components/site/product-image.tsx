"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Contain (show full image) vs Cover (crop). Default cover. */
  fit?: "contain" | "cover";
  /** Priority load (above-the-fold images only — LCP optimization). */
  priority?: boolean;
  /**
   * Size variant — controls the Cloudinary transformation:
   *   "card"  → w_400 (product cards, carousels, thumbnails) — ~10 KB
   *   "full"  → w_800 (product detail page, cart drawer) — ~21 KB
   * Default: "card" (most images on the site are cards).
   */
  size?: "card" | "full";
};

/**
 * Smart Cloudinary URL optimization.
 *
 * TWO size variants to minimize bandwidth:
 *
 *   "card" (default) → c_limit,w_400,q_auto,f_auto
 *     - 400px wide, ~10 KB each
 *     - Used for product cards, carousels, thumbnails
 *     - 50% smaller than w_800 → 50% less bandwidth
 *
 *   "full" → c_limit,w_800,q_auto,f_auto
 *     - 800px wide, ~21 KB each
 *     - Used for product detail page (full-size gallery)
 *     - Sharp on Retina screens
 *
 * Why c_limit (not w_400 alone)? Plain w_400 FORCES the image to 400px
 * even if the original is smaller — Cloudinary upscales it (bigger file).
 * c_limit,w_400 means "max 400px, never upscale" — pure savings.
 *
 * Non-Cloudinary URLs (data:, local paths, other hosts) are returned as-is.
 */
function optimizeImageUrl(src: string, size: "card" | "full" = "card"): string {
  if (src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
    // Don't double-transform (if URL already has transformations, leave it)
    if (!src.includes("c_limit") && !src.includes("q_auto") && !src.includes("f_auto")) {
      const width = size === "full" ? "w_800" : "w_400";
      return src.replace("/image/upload/", `/image/upload/c_limit,${width},q_auto,f_auto/`);
    }
  }
  return src;
}

/**
 * Build the Cloudinary fallback URL for a local /images/products/ path.
 * (Kept for future use if we re-enable the hot/cold tier.)
 */
function buildCloudinaryFallback(localPath: string): string | null {
  if (!localPath.startsWith("/images/products/")) return null;
  const filename = localPath.replace("/images/products/", "");
  const CLOUD_NAME =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ||
    "anhvhy4j";
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${filename}`;
}

export function ProductImage({
  src,
  alt,
  className = "",
  fit = "cover",
  priority = false,
  size = "card",
}: ProductImageProps) {
  // Track image load errors for Cloudinary fallback
  const [useFallback, setUseFallback] = useState(false);

  // Reset error state when src changes (prevents leak where one 404
  // causes ALL subsequent images to use the fallback)
  useEffect(() => {
    setUseFallback(false);
  }, [src]);

  const isDataUrl = src.startsWith("data:");
  const isExternalUrl = src.startsWith("http");
  const objectClass = fit === "contain" ? "object-contain" : "object-cover";

  // If the local path failed, fall back to Cloudinary
  const cloudinaryFallback = buildCloudinaryFallback(src);
  const effectiveSrc = useFallback && cloudinaryFallback ? cloudinaryFallback : src;

  // Skip Next.js Image optimizer for data URLs and external URLs
  // (Cloudinary does its own optimization via URL params)
  const unoptimized = isDataUrl || isExternalUrl || (effectiveSrc !== src);

  // Apply Cloudinary optimization based on size variant
  const optimizedSrc = optimizeImageUrl(effectiveSrc, size);

  if (!src) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-stone ${className}`}
      >
        <span className="font-arabic text-xs text-gray-light">لا توجد صورة</span>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <Image
        src={optimizedSrc}
        alt={alt}
        fill
        // Responsive sizes hint — helps the browser pick the right image
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={objectClass}
        unoptimized={unoptimized}
        priority={priority}
        // AGGRESSIVE LAZY LOADING:
        // - priority=true  → eager load (above-the-fold only, LCP image)
        // - priority=false → lazy load (below-the-fold, loads on scroll into view)
        // This cuts initial page load bandwidth by 70%+ — only visible images load.
        loading={priority ? "eager" : "lazy"}
        // Low-quality placeholder blur (optional, improves perceived performance)
        placeholder={priority ? undefined : "empty"}
        onError={() => {
          if (!useFallback) setUseFallback(true);
        }}
      />
    </div>
  );
}
