// Server-side helpers for talking to the Google Apps Script web app.
// Products + Orders both go through the sheet. Images go to Google Drive.
// ALL operations use GET with URL params for products/orders.
// Image uploads use POST (the only thing doPost handles).

export function getSheetBaseUrl(): string | null {
  // On Cloudflare Pages, NEXT_PUBLIC_ vars are inlined at build time.
  // But as a bulletproof fallback, we also hardcode the live URL.
  // This ensures the sheet is ALWAYS connected, even if env vars fail to inline.
  const FALLBACK_SHEET_URL = "https://script.google.com/macros/s/AKfycbxWVBZDsyfrqSBsRC_RPSwTyaXXkSaL4amjwRvcFIk3o_CASzw0TG5s_EF3B_BS44rV/exec";
  return (
    process.env.NEXT_PUBLIC_SHEET_URL ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    FALLBACK_SHEET_URL
  );
}

export type SheetProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  image: string;
  images: string;
  featured: boolean;
  /** Whether this product is shown in the "Special Offers" section on the home page. */
  isSpecialOffer?: boolean;
  /** Optional variations string (encoded — see joinVariations/parseVariations).
   *  Kept for backward compat; the admin no longer writes to it. */
  variations?: string;
  /** Optional variants string — encoded colors/sizes with price adjustments. */
  variants?: string;
  /** Optional stock count (null = unlimited, 0 = out of stock). */
  stock?: number | null;
  /** Optional highlights string (newline-separated bullet points). */
  highlights?: string;
  /** Sort order — lower = appears first. Default 999. */
  sortOrder?: number;
  /** Optional badge text (e.g. "عرض خاص"). */
  badge?: string;
  /** Optional old price (for showing a discount with strikethrough). */
  oldPrice?: number | null;
  /** Optional quantity tiers (encoded string for sheet storage) */
  quantityTiers?: string;
};

/**
 * GET ?action=products → list all products from the sheet
 */
export async function sheetListProducts(): Promise<SheetProduct[]> {
  const base = getSheetBaseUrl();
  if (!base) return [];
  try {
    const url = `${base}?action=products`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SheetProduct[];
    if (!Array.isArray(data)) return [];
    return data.map(normalizeSheetProduct);
  } catch {
    return [];
  }
}

/**
 * Create or update a product (UPSERT) via POST with JSON body.
 * POST avoids URL length limits (base64 images can be 20-50KB).
 */
export async function sheetUpsertProduct(
  product: SheetProduct,
): Promise<boolean> {
  const base = getSheetBaseUrl();
  if (!base) return false;
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
 * Delete a product by id via GET.
 */
export async function sheetDeleteProduct(id: string): Promise<boolean> {
  const base = getSheetBaseUrl();
  if (!base) return false;
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
 * Reset products (wipe all) via GET.
 */
export async function sheetResetProducts(): Promise<boolean> {
  const base = getSheetBaseUrl();
  if (!base) return false;
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
 * Submit an order to the sheet via GET with URL parameters.
 */
export async function sheetSubmitOrder(payload: {
  product: string;
  quantity: string;
  price: number | null;
  shippingPrice: number;
  grandTotal: number;
  shippingCompanyLabel: string;
  fullName: string;
  phone: string;
  wilaya: string;
  commune: string;
  deliveryLabel: string;
  notes: string;
}): Promise<boolean> {
  const base = getSheetBaseUrl();
  if (!base) return false;
  try {
    // Use GET with URL params — Google Apps Script doGet handles this.
    // Truncate long fields to keep URL under 2000 chars (Cloudflare edge safe).
    const params = new URLSearchParams();
    params.set("action", "order");
    params.set("product", (payload.product || "").substring(0, 200));
    params.set("quantity", String(payload.quantity || "1"));
    params.set(
      "price",
      payload.price === null || payload.price === undefined
        ? ""
        : String(payload.price),
    );
    params.set("shippingPrice", String(payload.shippingPrice ?? 0));
    params.set("grandTotal", String(payload.grandTotal ?? 0));
    params.set("shippingCompanyLabel", (payload.shippingCompanyLabel || "").substring(0, 50));
    params.set("fullName", (payload.fullName || "").substring(0, 100));
    params.set("phone", (payload.phone || "").substring(0, 20));
    params.set("wilaya", (payload.wilaya || "").substring(0, 50));
    params.set("commune", (payload.commune || "").substring(0, 50));
    params.set("deliveryLabel", (payload.deliveryLabel || "").substring(0, 50));
    params.set("notes", (payload.notes || "").substring(0, 200));

    const url = `${base}?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });

    // Google Apps Script returns 200 with JSON {ok:true} after redirect.
    // Check both status and body for reliability on Cloudflare edge.
    if (res.ok) return true;
    // Some edge cases: res might not be ok but order still went through
    // (Google returns 302 → 200, but edge might see 302 as not ok)
    const text = await res.text().catch(() => "");
    return text.includes('"ok"') || text.includes("true");
  } catch {
    return false;
  }
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
