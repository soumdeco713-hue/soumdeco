// ============================================================
//  R2 IMAGE STORAGE — Server-side helper (Cloudflare Pages)
// ============================================================
//  Uploads images to Cloudflare R2 (10 GB free tier, no egress fees).
//  Falls back to Cloudinary if R2 is not configured.
//
//  Setup:
//    1. Create R2 bucket: npx wrangler r2 bucket create soumdeco-images
//    2. Add binding in wrangler.toml (already done)
//    3. Set R2_PUBLIC_BASE_URL env var (e.g. https://images.soumdeco.pages.dev)
//    4. Or use the dev URL: http://localhost:8788/r2/{filename}
//
//  The public URL format is:
//    {R2_PUBLIC_BASE_URL}/{productId}-{imageIndex}.webp
//
//  Images are served directly from R2 (no transformation).
//  For production, add a Cloudflare Worker in front for:
//    - On-the-fly resizing (image resizing)
//    - Caching at the edge
//    - Custom domain (images.soumdeco.com)
// ============================================================

/**
 * Upload a base64 image to R2.
 * Returns the public URL on success, empty string on failure.
 *
 * This function is intended to run on the Cloudflare edge (API route).
 * It requires the R2 binding `PRODUCT_IMAGES` in wrangler.toml.
 */
export async function uploadImageToR2(
  env: any,
  dataUrl: string,
  filename: string,
): Promise<string> {
  if (!env?.PRODUCT_IMAGES) {
    return ""; // R2 not configured
  }

  // Parse the data URL
  const match = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/);
  if (!match) {
    console.error("[R2] Invalid data URL format");
    return "";
  }

  const [, mimeType, ext, base64Data] = match;
  if (!mimeType || !ext || !base64Data) {
    console.error("[R2] Malformed data URL");
    return "";
  }

  // Convert base64 to bytes
  let bytes: Uint8Array;
  try {
    const binaryString = atob(base64Data);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch (err) {
    console.error("[R2] Base64 decode failed:", err);
    return "";
  }

  // Determine the file extension from the MIME type
  const extension = mimeType === "image/webp" ? "webp"
    : mimeType === "image/png" ? "png"
    : mimeType === "image/jpeg" ? "jpg"
    : mimeType === "image/gif" ? "gif"
    : "webp";

  const key = `${filename}.${extension}`;

  try {
    await env.PRODUCT_IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    // Build the public URL
    const baseUrl = env.R2_PUBLIC_BASE_URL || "";
    if (baseUrl) {
      return `${baseUrl}/${key}`;
    }

    // Fallback: use the API route itself to serve the image
    return `/api/r2-image/${key}`;
  } catch (err) {
    console.error("[R2] Upload failed:", err);
    return "";
  }
}

/**
 * Upload multiple images to R2 in parallel.
 * Returns an array of public URLs (failed uploads are filtered out).
 */
export async function uploadImagesToR2(
  env: any,
  images: string[],
  productId: string,
): Promise<string[]> {
  const results = await Promise.all(
    images.map((img, i) => {
      if (!img.startsWith("data:")) return Promise.resolve(img);
      return uploadImageToR2(env, img, `${productId}-${i + 1}`);
    }),
  );
  return results.filter((url) => url && url.trim() !== "");
}

/**
 * Check if R2 is configured (binding exists in env).
 */
export function isR2Configured(env: any): boolean {
  return Boolean(env?.PRODUCT_IMAGES);
}
