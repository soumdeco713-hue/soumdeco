import { NextRequest, NextResponse } from "next/server";
import {
  joinImageStrings,
  joinVariations,
  joinVariants,
  joinHighlights,
} from "@/lib/products";
import { uploadImagesToDrive } from "@/lib/drive-upload";
import {
  sheetListProducts,
  sheetUpsertProduct,
  sheetDeleteProduct,
  sheetResetProducts,
  getSheetBaseUrl,
  type SheetProduct,
} from "@/lib/sheet";
import { SEED_PRODUCTS } from "@/lib/seed-products";

// Cache this route's GET response at the server/CDN level for 30 minutes.
// Thousands of visitors share 1 single function invocation (Netlify ISR).
export const revalidate = 1800;

// GET /api/products → list all products
// Tries the configured Google Sheet first. Falls back to SEED_PRODUCTS
// (29 Soum Deco reference products) when the sheet is unreachable or
// no sheet URL is configured (offline / demo mode).
export async function GET() {
  const sheetUrl = getSheetBaseUrl();
  let products: SheetProduct[] = [];
  let usedSeed = false;

  if (sheetUrl) {
    try {
      const fetched = await sheetListProducts();
      // If the sheet returns at least one product, use it.
      if (Array.isArray(fetched) && fetched.length > 0) {
        products = fetched;
      } else {
        products = SEED_PRODUCTS;
        usedSeed = true;
      }
    } catch {
      // Sheet unreachable (network error, timeout, etc.) → fall back to seed
      products = SEED_PRODUCTS;
      usedSeed = true;
    }
  } else {
    // No sheet configured → demo / offline mode
    products = SEED_PRODUCTS;
    usedSeed = true;
  }

  return NextResponse.json(
    { ok: true, products, seed: usedSeed },
    {
      headers: {
        // Browser caches for 60s, then serves stale while revalidating.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

// POST /api/products → create or update product (uploads images to Drive first)
// POST /api/products?action=reset → wipe all products
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "reset") {
    // Dev mode: no sheet configured → accept (handled locally)
    const sheetUrl = getSheetBaseUrl();
    let ok = true;
    if (sheetUrl) {
      ok = await sheetResetProducts();
    }
    return NextResponse.json({ ok });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!id || !name) {
    return NextResponse.json(
      { ok: false, error: "Missing id or name" },
      { status: 400 },
    );
  }

  // Normalize images: accept array or string
  let imagesArray: string[] = [];
  if (Array.isArray(body.images)) {
    imagesArray = body.images.filter((s: any) => String(s).trim() !== "");
  } else if (typeof body.images === "string" && body.images.trim()) {
    imagesArray = body.images.split("~~~").filter((s) => s.trim() !== "");
  }

  // Upload images to Cloudinary (falls back to base64 if Cloudinary fails)
  try {
    imagesArray = await uploadImagesToDrive(imagesArray, id);
  } catch {
    // If Cloudinary upload fails entirely, keep the original base64 images
  }

  const imagesStr = joinImageStrings(imagesArray);
  const coverImage = imagesArray[0] || String(body.image ?? "");

  // Encode variations (array → string) — kept for backward compat with old sheets.
  let variationsStr = "";
  if (Array.isArray(body.variations)) {
    variationsStr = joinVariations(body.variations);
  } else if (typeof body.variations === "string") {
    variationsStr = body.variations;
  }

  // Encode variants (array → string) — new color/size model with price adjustments.
  let variantsStr = "";
  if (Array.isArray(body.variants)) {
    variantsStr = joinVariants(body.variants);
  } else if (typeof body.variants === "string") {
    variantsStr = body.variants;
  }

  // Encode highlights (array → newline-separated string)
  let highlightsStr = "";
  if (Array.isArray(body.highlights)) {
    highlightsStr = joinHighlights(body.highlights);
  } else if (typeof body.highlights === "string") {
    highlightsStr = body.highlights;
  }

  const product: SheetProduct = {
    id,
    name,
    description: String(body.description ?? ""),
    category: String(body.category ?? ""),
    price:
      body.price === null ||
      body.price === undefined ||
      body.price === ""
        ? null
        : Number(body.price),
    image: coverImage,
    images: imagesStr,
    featured: Boolean(body.featured),
    isSpecialOffer: Boolean(body.isSpecialOffer),
    variations: variationsStr,
    variants: variantsStr,
    stock:
      body.stock === null ||
      body.stock === undefined ||
      body.stock === ""
        ? null
        : Number(body.stock),
    highlights: highlightsStr,
    sortOrder: body.sortOrder === null || body.sortOrder === undefined ? 999 : Number(body.sortOrder),
    badge: String(body.badge ?? ""),
    oldPrice: body.oldPrice === null || body.oldPrice === undefined || body.oldPrice === "" ? null : Number(body.oldPrice),
    quantityTiers: Array.isArray(body.quantityTiers)
      ? body.quantityTiers
          .filter((t: any) => t && typeof t.qty === "number")
          .map((t: any) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}`)
          .join(",")
      : String(body.quantityTiers ?? ""),
  };

  // If no sheet URL is configured (dev mode), accept the product (stored in localStorage only).
  // If the sheet IS configured, sync to it and report the result.
  const sheetUrl = getSheetBaseUrl();
  let ok = true;
  if (sheetUrl) {
    ok = await sheetUpsertProduct(product);
  }
  return NextResponse.json({ ok, product });
}

// DELETE /api/products?id=... → delete by id
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 },
    );
  }
  // Dev mode: no sheet configured → accept (handled locally)
  const sheetUrl = getSheetBaseUrl();
  let ok = true;
  if (sheetUrl) {
    ok = await sheetDeleteProduct(id);
  }
  return NextResponse.json({ ok });
}
