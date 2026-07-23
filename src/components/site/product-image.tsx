"use client";

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

export function ProductImage({
  src,
  alt,
  className = "",
  fit = "cover",
  priority = false,
}: ProductImageProps) {
  const isDataUrl = src.startsWith("data:");
  const isExternalUrl = src.startsWith("http");
  const objectClass = fit === "contain" ? "object-contain" : "object-cover";

  // Skip Next.js Image optimization for data URLs and external URLs
  // (Cloudinary URLs may have redirect issues with the optimizer)
  const unoptimized = isDataUrl || isExternalUrl;

  // Optimize Cloudinary URLs (auto format + quality)
  const optimizedSrc = optimizeImageUrl(src);

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
        unoptimized={unoptimized}
        priority={priority}
      />
    </div>
  );
}
