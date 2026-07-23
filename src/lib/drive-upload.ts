// Server-side helper to upload images to Cloudinary.
// Uses unsigned upload (no API secret needed in the website).
// Falls back to base64 if the upload fails — nothing breaks.
//
// Cloudinary free tier:
// - 25GB storage
// - 25GB bandwidth/month
// - Automatic image optimization + CDN delivery
// - Permanent URLs (https://res.cloudinary.com/{cloud}/image/upload/...)

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "soumdeco";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "soumdeco";

/**
 * Upload a single base64 image to Cloudinary.
 * Returns the Cloudinary URL on success, or the original base64 on failure.
 */
export async function uploadImageToDrive(
  dataUrl: string,
  filename: string,
): Promise<string> {
  // Only upload data: URLs (base64). Leave http URLs and local paths as-is.
  if (!dataUrl.startsWith("data:")) return dataUrl;

  if (!CLOUD_NAME) return dataUrl; // No cloud name → keep base64

  try {
    const formData = new FormData();
    formData.append("file", dataUrl);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("public_id", filename);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!res.ok) return dataUrl;

    const data = await res.json();
    if (data.secure_url) {
      return data.secure_url;
    }

    return dataUrl; // Upload failed → keep base64
  } catch {
    return dataUrl; // Network error → keep base64
  }
}

/**
 * Upload multiple images to Cloudinary. Replaces base64 data URLs with
 * Cloudinary URLs in the images array. Non-data URLs are kept as-is.
 */
export async function uploadImagesToDrive(
  images: string[],
  productId: string,
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.startsWith("data:")) {
      const url = await uploadImageToDrive(img, `${productId}-${i + 1}`);
      results.push(url);
    } else {
      results.push(img); // Already a URL, keep as-is
    }
  }
  return results;
}
