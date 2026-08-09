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

// Cloudflare edge runtime + KV cache (3 minutes)
export const runtime = "edge";

// Simple KV-backed cache (falls back to no-cache if KV not available)
async function getCachedProducts(env?: any): Promise<SheetProduct[] | null> {
  if (!env?.CATALOG_KV) return null;
  try {
    const cached = await env.CATALOG_KV.get("products", "json");
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch {}
  return null;
}

async function setCachedProducts(products: SheetProduct[], env?: any): Promise<void> {
  if (!env?.CATALOG_KV) return;
  try {
    await env.CATALOG_KV.put("products", JSON.stringify(products), { expirationTtl: 180 });
  } catch {}
}

async function invalidateCache(env?: any): Promise<void> {
  if (!env?.CATALOG_KV) return;
  try {
    await env.CATALOG_KV.delete("products");
  } catch {}
}

// GET /api/products → list all products
// Tries KV cache (3 min) → Google Sheet → SEED_PRODUCTS fallback
export async function GET(req: NextRequest) {
  const env = (req as any).env || (globalThis as any).env;

  // 1. Check KV cache
  const cached = await getCachedProducts(env);
  if (cached) {
    return NextResponse.json(
      { ok: true, products: cached, source: "kv" },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  }

  // 2. Cache miss — fetch from Google Sheet
  const sheetUrl = getSheetBaseUrl();
  let products: SheetProduct[] = [];
  let usedSeed = false;

  if (sheetUrl) {
    try {
      const fetched = await sheetListProducts();
      if (Array.isArray(fetched) && fetched.length > 0) {
        products = fetched;
        await setCachedProducts(products, env);
      } else {
        products = SEED_PRODUCTS;
        usedSeed = true;
      }
    } catch {
      // Sheet unreachable — try stale cache, then seed
      const stale = await getCachedProducts(env);
      products = stale || SEED_PRODUCTS;
      usedSeed = !stale;
    }
  } else {
    products = SEED_PRODUCTS;
    usedSeed = true;
  }

  return NextResponse.json(
    { ok: true, products, seed: usedSeed },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}

// POST /api/products → create or update product (uploads images to Cloudinary/R2 first)
export async function POST(req: NextRequest) {
  const env = (req as any).env || (globalThis as any).env;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "reset") {
    const sheetUrl = getSheetBaseUrl();
    let ok = true;
    if (sheetUrl) ok = await sheetResetProducts();
    await invalidateCache(env);
    return NextResponse.json({ ok });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body?.id ?? "").trim();
  const name = String(body?.name ?? "").trim();
  if (!id || !name) {
    return NextResponse.json({ ok: false, error: "Missing id or name" }, { status: 400 });
  }

  let imagesArray: string[] = [];
  if (Array.isArray(body.images)) {
    imagesArray = body.images.filter((s: any) => String(s).trim() !== "");
  } else if (typeof body.images === "string" && body.images.trim()) {
    imagesArray = body.images.split("~~~").filter((s) => s.trim() !== "");
  }

  try {
    imagesArray = await uploadImagesToDrive(imagesArray, id);
  } catch {}

  const imagesStr = joinImageStrings(imagesArray);
  const coverImage = imagesArray[0] || String(body.image ?? "");

  let variationsStr = "";
  if (Array.isArray(body.variations)) variationsStr = joinVariations(body.variations);
  else if (typeof body.variations === "string") variationsStr = body.variations;

  let variantsStr = "";
  if (Array.isArray(body.variants)) variantsStr = joinVariants(body.variants);
  else if (typeof body.variants === "string") variantsStr = body.variants;

  let highlightsStr = "";
  if (Array.isArray(body.highlights)) highlightsStr = joinHighlights(body.highlights);
  else if (typeof body.highlights === "string") highlightsStr = body.highlights;

  const product: SheetProduct = {
    id, name,
    description: String(body.description ?? ""),
    category: String(body.category ?? ""),
    price: body.price === null || body.price === undefined || body.price === "" ? null : Number(body.price),
    image: coverImage,
    images: imagesStr,
    featured: Boolean(body.featured),
    isSpecialOffer: Boolean(body.isSpecialOffer),
    variations: variationsStr,
    variants: variantsStr,
    stock: body.stock === null || body.stock === undefined || body.stock === "" ? null : Number(body.stock),
    highlights: highlightsStr,
    sortOrder: body.sortOrder === null || body.sortOrder === undefined ? 999 : Number(body.sortOrder),
    badge: String(body.badge ?? ""),
    oldPrice: body.oldPrice === null || body.oldPrice === undefined || body.oldPrice === "" ? null : Number(body.oldPrice),
    quantityTiers: Array.isArray(body.quantityTiers)
      ? body.quantityTiers.filter((t: any) => t && typeof t.qty === "number").map((t: any) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}`).join(",")
      : String(body.quantityTiers ?? ""),
  };

  const sheetUrl = getSheetBaseUrl();
  let ok = true;
  if (sheetUrl) ok = await sheetUpsertProduct(product);

  // Invalidate KV cache so admin sees the change
  await invalidateCache(env);

  return NextResponse.json({ ok, product });
}

// DELETE /api/products?id=... → delete by id
export async function DELETE(req: NextRequest) {
  const env = (req as any).env || (globalThis as any).env;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const sheetUrl = getSheetBaseUrl();
  let ok = true;
  if (sheetUrl) ok = await sheetDeleteProduct(id);

  await invalidateCache(env);

  return NextResponse.json({ ok });
}
