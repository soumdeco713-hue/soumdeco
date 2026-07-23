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
 * Optimize Cloudinary URLs by adding auto format + quality.
 * Transforms: .../image/upload/v123/abc.jpg → .../image/upload/q_auto,f_auto/v123/abc.jpg
 * This makes Cloudinary serve WebP (smaller) and auto-adjust quality (faster load).
 * Non-Cloudinary URLs are returned as-is.
 */
function optimizeImageUrl(src: string): string {
  if (src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
    // Only add if not already present
    if (!src.includes("q_auto") && !src.includes("f_auto")) {
      return src.replace("/image/upload/", "/image/upload/q_auto,f_auto/");
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
