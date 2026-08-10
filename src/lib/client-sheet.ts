// ============================================================
//  CLIENT-SIDE SHEET API
// ============================================================
//  Direct browser → Google Apps Script communication.
//  This bypasses the Cloudflare Pages edge API routes entirely,
//  which have been returning 500 errors on Cloudflare's edge
//  runtime (Next.js 16 edge runtime is deprecated and has issues
//  with @cloudflare/next-on-pages v1).
//
//  All public read/write operations go directly from the browser
//  to the Apps Script web app. This is:
//   - Faster (one less network hop)
//   - More reliable (no edge runtime issues)
//   - Simpler (no API route middleware)
//   - Safe (Apps Script is the source of truth, public for reads)
//
//  Admin operations (create/update/delete) also go directly,
//  with image uploads to Cloudinary (unsigned) done client-side.
// ============================================================

import { getClientSheetBaseUrl, type SheetProduct } from "./sheet";

/**
 * Fetch all products directly from Google Apps Script.
 * Returns an array of SheetProduct (already normalized).
 * Falls back to an empty array on error.
 */
export async function clientListProducts(): Promise<SheetProduct[]> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=products`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(normalizeSheetProduct);
  } catch {
    return [];
  }
}

/**
 * Fetch the Stock tab as CSV directly from Google Apps Script.
 */
export async function clientGetStockCsv(): Promise<string> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=stock`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Create or update a product directly via Apps Script POST.
 * The body is JSON-encoded and sent as text/plain (Apps Script
 * requirement to avoid CORS preflight).
 */
export async function clientUpsertProduct(
  product: SheetProduct,
): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=product_create`;
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(product),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a product directly via Apps Script GET.
 */
export async function clientDeleteProduct(id: string): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=product_delete&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reset all products directly via Apps Script GET.
 */
export async function clientResetProducts(): Promise<boolean> {
  const base = getClientSheetBaseUrl();
  try {
    const url = `${base}?action=product_reset`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload a single base64 image to Cloudinary (unsigned upload).
 * Non-data URLs (already-uploaded Cloudinary URLs) are returned as-is.
 */
export async function clientUploadImage(
  dataUrl: string,
  filename: string,
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl;

  const CLOUD_NAME =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) ||
    "anhvhy4j";
  const UPLOAD_PRESET =
    (typeof process !== "undefined" &&
      process.env &&
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) ||
    "soumdeco";

  if (!CLOUD_NAME) return dataUrl;

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
    if (data.secure_url) return data.secure_url;

    return dataUrl;
  } catch {
    return dataUrl;
  }
}

/**
 * Upload multiple images to Cloudinary client-side.
 * Replaces base64 data URLs with Cloudinary URLs.
 */
export async function clientUploadImages(
  images: string[],
  productId: string,
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.startsWith("data:")) {
      const url = await clientUploadImage(img, `${productId}-${i + 1}`);
      results.push(url);
    } else {
      results.push(img);
    }
  }
  return results;
}

// ---------- internal ----------

function normalizeSheetProduct(p: any): SheetProduct {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    description: String(p.description ?? ""),
    category: String(p.category ?? ""),
    price:
      p.price === null ||
      p.price === undefined ||
      p.price === "" ||
      (typeof p.price === "object" && p.price !== null)
        ? null
        : Number(p.price),
    image: String(p.image ?? ""),
    images: String(p.images ?? ""),
    featured: (p.featured === true ||
               p.featured === 1 ||
               p.featured === "1" ||
               (typeof p.featured === "string" &&
                p.featured.toLowerCase() === "true")),
    isSpecialOffer: (p.isSpecialOffer === true ||
                     p.isSpecialOffer === 1 ||
                     p.isSpecialOffer === "1" ||
                     (typeof p.isSpecialOffer === "string" &&
                      p.isSpecialOffer.toLowerCase() === "true")),
    variations: String(p.variations ?? ""),
    variants: String(p.variants ?? ""),
    stock:
      p.stock === null ||
      p.stock === undefined ||
      p.stock === "" ||
      (typeof p.stock === "object" && p.stock !== null)
        ? null
        : Number(p.stock),
    highlights: String(p.highlights ?? ""),
    sortOrder: p.sortOrder === null || p.sortOrder === undefined ? 999 : Number(p.sortOrder),
    badge: String(p.badge ?? ""),
    oldPrice: p.oldPrice === null || p.oldPrice === undefined || p.oldPrice === "" ? null : Number(p.oldPrice),
    quantityTiers: String(p.quantityTiers ?? ""),
  };
}
