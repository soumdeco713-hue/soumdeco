"use client";

import { useState } from "react";
import Image from "next/image";

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Contain (show full image) vs Cover (crop). Default cover. */
  fit?: "contain" | "cover";
  priority?: boolean;
};

/**
 * Optimize Cloudinary URLs for delivery (NOT storage).
 *
 * Cloudinary stores the original high-res image and serves TRANSFORMED
 * versions via URL parameters. We apply three transformations:
 *
 *   c_limit,w_800  — cap width at 800px but NEVER upscale (c_limit =
 *                    "only scale down"). 800px is sharp on Retina screens
 *                    for product cards. Images smaller than 800px stay
 *                    at their native size (no wasted bandwidth).
 *   q_auto         — Cloudinary auto-picks optimal JPEG quality (70-80%
 *                    visually lossless) based on image content.
 *   f_auto         — Cloudinary auto-selects format (WebP/AVIF on modern
 *                    browsers, 30-50% smaller than JPEG).
 *
 * Non-Cloudinary URLs (data:, /local/, other hosts) are returned as-is.
 *
 * Why c_limit (not w_800 alone)? Plain w_800 FORCES the image to 800px
 * even if the original is smaller — Cloudinary upscales it, which makes
 * the file BIGGER (e.g. 18KB → 41KB for the Veilleuse OVNI image).
 * c_limit,w_800 means "max 800px, never upscale" — pure savings.
 */
function optimizeImageUrl(src: string): string {
  if (src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
    // Don't double-transform
    if (!src.includes("c_limit") && !src.includes("q_auto") && !src.includes("f_auto")) {
      return src.replace("/image/upload/", "/image/upload/c_limit,w_800,q_auto,f_auto/");
    }
  }
  return src;
}

/**
 * Build the Cloudinary fallback URL for a local /images/products/ path.
 *
 * The use-catalog hook rewrites Cloudinary URLs to local paths so images
 * are served from Cloudflare Pages (unlimited bandwidth). But NEW admin
 * uploads won't have a local file yet — they 404. This function builds
 * the original Cloudinary URL so we can fall back to it on error.
 *
 * Local path format: /images/products/{filename}
 * Cloudinary URL:    https://res.cloudinary.com/{cloud}/image/upload/{filename}
 *
 * Note: This is a BEST-EFFORT fallback. It doesn't include the Cloudinary
 * transformation params (c_limit, q_auto, f_auto) because we don't know
 * the original transformation. Cloudinary serves the raw original.
 */
function buildCloudinaryFallback(localPath: string): string | null {
  if (!localPath.startsWith("/images/products/")) return null;
  const filename = localPath.replace("/images/products/", "");
  // Reconstruct the Cloudinary URL (without transformation — raw original)
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
}: ProductImageProps) {
  // Track image load errors so we can fall back to Cloudinary
  // (handles the case where a local file doesn't exist yet — e.g.,
  // a new admin upload that hasn't been synced to the repo)
  const [errorSrc, setErrorSrc] = useState<string | null>(null);

  const isDataUrl = src.startsWith("data:");
  const isExternalUrl = src.startsWith("http");
  const objectClass = fit === "contain" ? "object-contain" : "object-cover";

  // Skip Next.js Image optimization for data URLs and external URLs
  const unoptimized = isDataUrl || isExternalUrl;

  // If the local path failed, fall back to Cloudinary
  const effectiveSrc = errorSrc && src.startsWith("/images/products/")
    ? buildCloudinaryFallback(src) || src
    : src;

  // Optimize Cloudinary URLs (auto format + quality)
  const optimizedSrc = optimizeImageUrl(effectiveSrc);

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
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={objectClass}
        unoptimized={unoptimized || (effectiveSrc !== src)}
        priority={priority}
        onError={() => {
          // Only fall back once (avoid infinite loop if Cloudinary also fails)
          if (!errorSrc) setErrorSrc(src);
        }}
      />
    </div>
  );
}
