"use client";

import { useState, useEffect } from "react";

type AdminImagePreviewProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Admin image preview with Cloudinary fallback.
 *
 * The use-catalog hook rewrites Cloudinary URLs to local paths
 * (/images/products/...) for unlimited Cloudflare Pages bandwidth.
 * But NEW admin uploads won't have local files yet — they 404.
 *
 * This component:
 * 1. Tries the local path first (fast, free bandwidth)
 * 2. On 404, falls back to the original Cloudinary URL
 * 3. Resets the error state when `src` changes (fixes P1-10 leak)
 */
export function AdminImagePreview({
  src,
  alt,
  className = "h-full w-full object-contain",
}: AdminImagePreviewProps) {
  const [useFallback, setUseFallback] = useState(false);

  // Reset error state when src changes (prevents the leak where one 404
  // causes ALL subsequent images to use Cloudinary)
  useEffect(() => {
    setUseFallback(false);
  }, [src]);

  // Build the Cloudinary fallback URL from a local path
  const cloudinaryUrl = (() => {
    if (!src.startsWith("/images/products/")) return src;
    const filename = src.replace("/images/products/", "");
    const CLOUD_NAME =
      (typeof process !== "undefined" &&
        process.env &&
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ||
      "anhvhy4j";
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${filename}`;
  })();

  const effectiveSrc = useFallback ? cloudinaryUrl : src;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}
