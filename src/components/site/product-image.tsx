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
 * For LOCAL paths (/images/products/...): returned as-is (already optimized
 * on the repo — served from Cloudflare Pages with unlimited bandwidth).
 *
 * For CLOUDINARY URLs: apply transformation params:
 *   "card" (default) → c_limit,w_400,q_auto,f_auto (~10 KB)
 *   "full" → c_limit,w_800,q_auto,f_auto (~21 KB)
 */
function optimizeImageUrl(src: string, size: "card" | "full" = "card"): string {
  // Local paths (Cloudflare Pages) — serve as-is, no transformation needed
  if (src.startsWith("/images/products/") || src.startsWith("/")) {
    return src;
  }
  // Cloudinary URLs — apply optimization
  if (src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
    if (!src.includes("c_limit") && !src.includes("q_auto") && !src.includes("f_auto")) {
      const width = size === "full" ? "w_800" : "w_400";
      return src.replace("/image/upload/", `/image/upload/c_limit,${width},q_auto,f_auto/`);
    }
  }
  return src;
}

/**
 * Build the Cloudinary fallback URL for a local /images/products/ path.
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
  // Track whether the image has finished loading (for fade-in)
  const [loaded, setLoaded] = useState(false);

  // Reset error + loaded state when src changes
  useEffect(() => {
    setUseFallback(false);
    setLoaded(false);
  }, [src]);

  const isDataUrl = src.startsWith("data:");
  const isExternalUrl = src.startsWith("http");
  const objectClass = fit === "contain" ? "object-contain" : "object-cover";

  // If the local path failed, fall back to Cloudinary
  const cloudinaryFallback = buildCloudinaryFallback(src);
  const effectiveSrc = useFallback && cloudinaryFallback ? cloudinaryFallback : src;

  // Skip Next.js Image optimizer for data URLs and external URLs
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
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{
        // Warm cream background — prevents the "white flash" while images load.
        // Matches the site's background color (#FAF8F4) so it's invisible.
        backgroundColor: "#FAF8F4",
      }}
    >
      <Image
        src={optimizedSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={`${objectClass} transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        unoptimized={unoptimized}
        priority={priority}
        // AGGRESSIVE LAZY LOADING:
        // - priority=true  → eager load (above-the-fold only, LCP image)
        // - priority=false → lazy load (below-the-fold, loads on scroll into view)
        loading={priority ? "eager" : "lazy"}
        // NO placeholder — we use our own fade-in + background color instead.
        // The "empty" placeholder was causing white flashes.
        onError={() => {
          if (!useFallback) setUseFallback(true);
        }}
        onLoad={() => {
          setLoaded(true);
        }}
      />
    </div>
  );
}
