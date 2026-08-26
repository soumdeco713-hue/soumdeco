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

/**
 * Deduplicate products by ID — keep the FIRST occurrence.
 * The Google Sheet sometimes contains duplicate rows (same ID appearing
 * in multiple rows). We collapse them so the UI shows each product once.
 */
function dedupeProducts(products: SheetProduct[]): SheetProduct[] {
  const seen = new Set<string>();
  const result: SheetProduct[] = [];
  for (const p of products) {
    const id = String(p.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(p);
  }
  return result;
}

// GET /api/products → list all products
// Tries KV cache (3 min) → Google Sheet → SEED_PRODUCTS fallback
// Wrapped in try/catch so we NEVER return a bare 500 (which breaks the
// frontend's fallback logic). On any error we return seed products with
// seed:true so the client knows to use them as a last resort.
export async function GET(req: NextRequest) {
  try {
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
          // Deduplicate by ID (sheet sometimes has duplicate rows)
          products = dedupeProducts(fetched);
          await setCachedProducts(products, env);
        } else {
          products = SEED_PRODUCTS;
          usedSeed = true;
        }
      } catch (fetchErr) {
        // Sheet unreachable — try stale cache, then seed
        const stale = await getCachedProducts(env);
        if (stale && stale.length > 0) {
          products = stale;
        } else {
          products = SEED_PRODUCTS;
          usedSeed = true;
        }
      }
    } else {
      products = SEED_PRODUCTS;
      usedSeed = true;
    }

    return NextResponse.json(
      { ok: true, products, seed: usedSeed, count: products.length },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (outerErr) {
    // Absolute last-resort — never let the API return a bare 500
    return NextResponse.json(
      {
        ok: true,
        products: SEED_PRODUCTS,
        seed: true,
        count: SEED_PRODUCTS.length,
        error: String(outerErr),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

// POST /api/products → DISABLED (security: use /api/admin for writes)
// This route previously allowed unauthenticated product writes. It is now
// locked down. All admin writes go through /api/admin (which validates
// session + admin token). Returns 403 to alert any caller of the change.
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "forbidden", message: "Use /api/admin for product writes" },
    { status: 403 },
  );
}

// DELETE /api/products → DISABLED (security: use /api/admin for writes)
export async function DELETE() {
  return NextResponse.json(
    { ok: false, error: "forbidden", message: "Use /api/admin for product deletes" },
    { status: 403 },
  );
}
