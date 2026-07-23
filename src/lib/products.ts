// Product type, seed data, localStorage helpers
// Supports multi-image (up to ~8 images), variations, and Arabic descriptions.

import { BRAND } from "./brand-config";

export type Variation = {
  /** Variation name — e.g. "اللون", "الحجم", "السعة" */
  name: string;
  /** Options — e.g. ["أبيض", "أسود", "ذهبي"] */
  options: string[];
};

/** Simpler per-variant model — a single color or size entry with optional
 * price adjustment. Replaces the old generic `variations` editor in the admin. */
export type ProductVariant = {
  type: "color" | "size";
  name: string;
  /** Added to the base price (can be 0 or negative). Optional. */
  priceAdjustment?: number;
};

/** Quantity tier — a special offer when the customer buys a specific quantity.
 * A tier can combine a free-shipping benefit AND a discount amount (or just one, or both). */
export type QuantityTier = {
  /** The quantity that triggers this tier (e.g. 2, 3, 4) */
  qty: number;
  /** Free-shipping benefit. "none" = no free shipping, just discount. */
  freeShipping: "none" | "desk" | "home" | "both";
  /** Optional discount amount in DA (0 / undefined = no discount) */
  discountAmount?: number;
};

/** Old benefit values used by the previous tier format. Kept for backward-compat parsing. */
type LegacyTierBenefit = "free_desk" | "free_home" | "free_both" | "discount";

/** Map an old-format tier benefit to the new {freeShipping, discountAmount} shape. */
function migrateLegacyBenefit(
  benefit: LegacyTierBenefit,
  discountAmount?: number,
): { freeShipping: QuantityTier["freeShipping"]; discountAmount?: number } {
  switch (benefit) {
    case "free_desk":
      return { freeShipping: "desk" };
    case "free_home":
      return { freeShipping: "home" };
    case "free_both":
      return { freeShipping: "both" };
    case "discount":
    default:
      return { freeShipping: "none", discountAmount };
  }
}

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  /** Optional old price (shown with strikethrough, smaller, to show a discount). */
  oldPrice?: number | null;
  image: string;
  images?: string[];
  featured: boolean;
  inStock: boolean;
  /** Whether this product is shown in the "Special Offers" section on the home page. */
  isSpecialOffer?: boolean;
  /** Optional variations (color, size, etc.) — empty array if none. Kept for backward-compat. */
  variations?: Variation[];
  /** Simpler per-variant list (colors + sizes with optional price adjustments).
   * Replaces `variations` in the admin UI. */
  variants?: ProductVariant[];
  /** Optional stock count — null = unlimited/unknown, 0 = out of stock. */
  stock?: number | null;
  /** Optional bullet highlights (key selling points) shown on the product page. */
  highlights?: string[];
  /** Sort order — lower = appears first in catalog. Default 999 (bottom). */
  sortOrder?: number;
  /** Optional badge text (e.g. "عرض خاص") displayed on cards and product page. */
  badge?: string;
  /** Optional quantity tiers — special offers at specific quantities */
  quantityTiers?: QuantityTier[];
};

export const CATALOG_STORAGE_KEY = BRAND.storage.catalog; // e.g. "rokn_catalog_v2"
export const CART_STORAGE_KEY = BRAND.storage.cart;

/** Hard cap on the total images string length, to fit Google Sheets' 50K cell limit. */
export const IMAGES_TOTAL_CHAR_CAP = 47000;

/** Separator for multiple images in the sheet cell (triple tilde) */
export const IMAGE_SEPARATOR = "~~~";

/** Separator for variations in the sheet cell (double semicolon) */
export const VARIATIONS_SEPARATOR = ";;";

/** Separator between variation name and options (double colon) */
export const VARIATION_NAME_SEP = "::";

/** Separator between options within a variation (double comma) */
export const VARIATION_OPT_SEP = ",,";

/** Separator between variants in the sheet cell (single comma — names can't
 * contain commas in practice; if they do, swap for a different token). */
export const VARIANT_SEP = ",";

export const SEED_PRODUCTS: Product[] = [
  {
    id: "mizallat-shams-sayyara",
    featured: true,
    sortOrder: 1,
    badge: "عرض خاص",
    category: "إكسسوارات السيارة",
    name: "مظلّة واقٍ من الشمس للسيارة — قابلة للطيّ",
    description:
      "مظلّة سيارة سوداء بتصميم المظلة القابلة للطيّ، تركب على الزجاج الأمامي لحماية المقصورة من أشعّة الشمس. تأتي مع غلاف أسود أنيق للحمْل والتخزين. تركب في ثوانٍ وتُطوى بسهولة بعد الاستعمال. اللون الأسود يعكس الحرارة ويحافظ على برودة المقصورة، ويحمي لوحة القيادة وجلد المقاعد من بهتان الشمس.\n\nأبرز المميّزات: لون أسود يعكس الحرارة ويحافظ على برودة المقصورة. تصميم مظلة قابل للطيّ يفتح ويُغلق بسهولة. غلاف أسود أنيق للحمْل والتخزين في السيارة. يحمي لوحة القيادة من أشعّة الشمس. تركيب على الزجاج الأمامي في ثوانٍ. قابل للطيّ بعد الاستعمال لا يحتلّ مساحة.",
    price: 1950,
    oldPrice: 2500,
    image: "/products/parasol-voiture-1.png",
    images: ["/products/parasol-voiture-1.png", "/products/parasol-voiture-2.png"],
    highlights: [],
    variations: [],
    variants: [],
    stock: null,
  },
  {
    id: "misbah-saiq-baoud-kahraba",
    featured: true,
    sortOrder: 2,
    badge: "عرض خاص",
    category: "أجهزة منزلية",
    name: "مصباح صاعق البعوض الكهربائي",
    description:
      "مصباح أبيض اللون بضوء بنفسجيّ يجذب البعوض، يعمل بالكهرباء عبر منفذ USB. يصعق الحشرات بشبكة كهربائية داخلية دون مبيدات ولا روائح. يأتي مع علبة سوداء أنيقة تحتوي المصباح وكابل USB. لا يحتوي على بطارية قابلة للشحن — يعمل بالوصلة المباشرة. آمن للاستعمال في غرفة النوم والصالون.\n\nأبرز المميّزات: لون أبيض بضوء بنفسجيّ يجذب البعوض. شبكة كهربائية تقتل الحشرة فوراً دون رائحة. يعمل بالوصلة المباشرة عبر منفذ USB. لا يحتوي على بطارية قابلة للشحن. علبة سوداء أنيقة تحتوي المصباح وكابل USB. آمن للاستعمال في غرفة النوم — لا مبيدات كيميائية.",
    price: 1450,
    oldPrice: 1800,
    image: "/products/lampe-anti-moustique.jpeg",
    images: ["/products/lampe-anti-moustique.jpeg"],
    highlights: [],
    variations: [],
    variants: [],
    stock: null,
  },
  {
    id: "shabak-nawafidh-filkro",
    featured: true,
    sortOrder: 3,
    badge: "عرض خاص",
    category: "أدوات المنزل",
    name: "شبك نوافذ ذاتيّ اللصق — ضدّ الحشرات",
    description:
      "شبك أبيض اللون بحدود سوداء، يُثبَّت على إطار النافذة بواسطة شريط لاصق (فيلكرو) قويّ. شبك رفيع يسمح بدخول الهواء والضوء ويمنع دخول البعوض والحشرات. يُقصّ بسهولة ليناسب أيّ مقاس نافذة. التركيب لا يحتاج أدوات — الصق الشريط على الإطار ثمّ ثبّت الشبك.\n\nأبرز المميّزات: شبك أبيض اللون بحدود سوداء أنيقة. شريط فيلكرو لاصق قويّ — تركيب بلا أدوات. شبك رفيع يسمح بدخول الهواء والضوء. يمنع دخول البعوض والحشرات. قابل للقصّ حسب مقاس النافذة. مناسب للنوافذ وأبواب الشرفات.",
    price: 750,
    oldPrice: 950,
    image: "/products/moustiquaire-filkro.jpeg",
    images: ["/products/moustiquaire-filkro.jpeg"],
    highlights: [],
    variations: [],
    variants: [],
    stock: null,
  },
];

export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "السعر عند الطلب";
  return `${price.toLocaleString("fr-FR")} دج`;
}

/**
 * Get all images for a product (always returns at least one entry,
 * or an empty array if the product has no image at all).
 */
export function getProductImages(p: Product): string[] {
  if (Array.isArray(p.images) && p.images.length > 0) {
    return p.images.filter((i) => i && i.trim() !== "");
  }
  if (p.image && p.image.trim() !== "") return [p.image];
  return [];
}

/**
 * Split the `images` string from the sheet into an array of image URLs.
 * Handles triple-tilde (new), triple-pipe (legacy), and comma-separated formats.
 */
function splitImageStrings(s: string): string[] {
  if (!s) return [];
  const trimmed = s.trim();
  if (!trimmed) return [];

  if (trimmed.includes("~~~")) {
    return trimmed.split("~~~").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("|||")) {
    return trimmed.split("|||").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("|")) {
    return trimmed.split("|").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("data:")) {
    return trimmed.split(/,(?=data:)/).map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((x) => x.trim()).filter((x) => x !== "");
  }
  return [trimmed];
}

/**
 * Join an array of image URLs into a single string for sheet storage.
 * Uses ~~~ (triple tilde) — safe in base64 content and URLs.
 */
export function joinImageStrings(images: string[]): string {
  return images.filter((s) => s && s.trim() !== "").join("~~~");
}

/** Parse the variations string from the sheet into an array of Variation objects. */
export function parseVariations(s: string | undefined | null): Variation[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  try {
    const parts = trimmed.split(VARIATIONS_SEPARATOR).map((x) => x.trim()).filter(Boolean);
    const out: Variation[] = [];
    for (const part of parts) {
      const [name, optsStr] = part.split(VARIATION_NAME_SEP);
      if (!name || !optsStr) continue;
      const options = optsStr.split(VARIATION_OPT_SEP).map((o) => o.trim()).filter(Boolean);
      if (options.length > 0) out.push({ name: name.trim(), options });
    }
    return out;
  } catch {
    return [];
  }
}

/** Join an array of Variation objects into a single string for sheet storage. */
export function joinVariations(vars: Variation[] | undefined | null): string {
  if (!Array.isArray(vars) || vars.length === 0) return "";
  return vars
    .filter((v) => v && v.name && Array.isArray(v.options) && v.options.length > 0)
    .map((v) => `${v.name}${VARIATION_NAME_SEP}${v.options.join(VARIATION_OPT_SEP)}`)
    .join(VARIATIONS_SEPARATOR);
}

/** Parse the `variants` string from the sheet into a `ProductVariant[]`.
 * Format: `type:name:priceAdjustment,type:name:priceAdjustment` (comma-separated).
 * The priceAdjustment is optional (defaults to 0). Type must be "color" or "size".
 * Names containing commas are NOT supported (would need a different separator). */
export function parseVariants(s: string | undefined | null): ProductVariant[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  const out: ProductVariant[] = [];
  for (const part of trimmed.split(VARIANT_SEP)) {
    const clean = part.trim();
    if (!clean) continue;
    // Split from the LEFT into at most 3 parts: type, name, priceAdjustment.
    // Names CAN contain colons (rare but possible); the priceAdjustment is the
    // LAST segment.
    const firstColon = clean.indexOf(":");
    if (firstColon < 0) continue;
    const type = clean.slice(0, firstColon).trim().toLowerCase();
    if (type !== "color" && type !== "size") continue;
    const rest = clean.slice(firstColon + 1);
    const lastColon = rest.lastIndexOf(":");
    let name: string;
    let adjustment = 0;
    if (lastColon < 0) {
      name = rest.trim();
    } else {
      const maybeNum = Number(rest.slice(lastColon + 1));
      if (isNaN(maybeNum)) {
        name = rest.trim();
      } else {
        name = rest.slice(0, lastColon).trim();
        adjustment = maybeNum;
      }
    }
    if (!name) continue;
    out.push({
      type: type as "color" | "size",
      name,
      priceAdjustment: adjustment,
    });
  }
  return out;
}

/** Join a `ProductVariant[]` into a single string for sheet storage. */
export function joinVariants(variants: ProductVariant[] | undefined | null): string {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  return variants
    .filter((v) => v && v.type && v.name)
    .map((v) => `${v.type}:${v.name}:${Number(v.priceAdjustment ?? 0)}`)
    .join(VARIANT_SEP);
}

/** Normalize a raw variants value (array from localStorage / sheet JSON or
 * encoded string) into a clean `ProductVariant[]`. */
export function normalizeVariants(raw: unknown): ProductVariant[] {
  if (Array.isArray(raw)) {
    return (raw as any[])
      .filter((v) => v && typeof v === "object" && v.name)
      .map((v) => {
        const type: "color" | "size" = v.type === "size" ? "size" : "color";
        const adj =
          v.priceAdjustment == null
            ? undefined
            : Number(v.priceAdjustment);
        return {
          type,
          name: String(v.name),
          priceAdjustment: typeof adj === "number" && !isNaN(adj) ? adj : undefined,
        };
      })
      .filter((v) => v.name.trim() !== "");
  }
  if (typeof raw === "string") {
    return parseVariants(raw);
  }
  return [];
}

/** Parse the highlights string from the sheet (newline-separated). */
export function parseHighlights(s: string | undefined | null): string[] {
  if (!s || typeof s !== "string") return [];
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Join an array of highlight strings into a single string for sheet storage. */
export function joinHighlights(items: string[] | undefined | null): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.filter((x) => x && x.trim()).join("\n");
}

/** Parse the quantityTiers string from the sheet into an array of QuantityTier objects.
 * New format: "2:both:200,3:desk:0" (qty:freeShipping:discountAmount)
 * Legacy format (still supported for back-compat with existing sheet rows):
 *   "2:free_both:0,3:discount:200" (qty:benefit:discountAmount) */
export function parseQuantityTiers(s: string | undefined | null): QuantityTier[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(",").map((x) => x.trim()).filter(Boolean);
  const out: QuantityTier[] = [];
  const newShippingTokens: QuantityTier["freeShipping"][] = ["none", "desk", "home", "both"];
  const legacyBenefits: LegacyTierBenefit[] = ["free_desk", "free_home", "free_both", "discount"];
  for (const part of parts) {
    const [qtyStr, middle, discountStr] = part.split(":");
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty < 1) continue;
    const discount = Number(discountStr) || 0;
    if (newShippingTokens.includes(middle as QuantityTier["freeShipping"])) {
      out.push({
        qty,
        freeShipping: middle as QuantityTier["freeShipping"],
        discountAmount: discount > 0 ? discount : undefined,
      });
    } else if (legacyBenefits.includes(middle as LegacyTierBenefit)) {
      const migrated = migrateLegacyBenefit(middle as LegacyTierBenefit, discount > 0 ? discount : undefined);
      out.push({
        qty,
        freeShipping: migrated.freeShipping,
        discountAmount: migrated.discountAmount,
      });
    } else {
      // Unknown token — default to no benefit so the tier is still preserved.
      out.push({
        qty,
        freeShipping: "none",
        discountAmount: discount > 0 ? discount : undefined,
      });
    }
  }
  return out;
}

/** Normalize a raw quantityTiers value (from localStorage, sheet JSON, or the API)
 * into the new QuantityTier shape. Handles:
 *  - arrays already in the new format ({qty, freeShipping, discountAmount?})
 *  - arrays in the legacy format ({qty, benefit, discountAmount?}) → migrate
 *  - string in new or legacy sheet format → parseQuantityTiers
 */
export function normalizeTiers(raw: unknown): QuantityTier[] {
  if (Array.isArray(raw)) {
    const newShippingTokens: QuantityTier["freeShipping"][] = ["none", "desk", "home", "both"];
    const legacyBenefits: LegacyTierBenefit[] = ["free_desk", "free_home", "free_both", "discount"];
    return (raw as any[])
      .filter((t) => t && typeof t.qty === "number")
      .map((t) => {
        const qty = Number(t.qty);
        const discount = t.discountAmount == null ? undefined : Number(t.discountAmount);
        if (typeof t.freeShipping === "string" && newShippingTokens.includes(t.freeShipping)) {
          return { qty, freeShipping: t.freeShipping, discountAmount: discount } as QuantityTier;
        }
        if (typeof t.benefit === "string" && legacyBenefits.includes(t.benefit)) {
          const migrated = migrateLegacyBenefit(t.benefit as LegacyTierBenefit, discount);
          return { qty, ...migrated } as QuantityTier;
        }
        // Unknown shape — preserve qty + discount, no shipping benefit.
        return { qty, freeShipping: "none" as const, discountAmount: discount } as QuantityTier;
      });
  }
  if (typeof raw === "string" && raw.trim()) {
    return parseQuantityTiers(raw);
  }
  return [];
}

export function loadCatalog(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const products = parsed.map(normalizeProduct).filter(Boolean) as Product[];
    const seen = new Set<string>();
    return products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch {
    return [];
  }
}

function normalizeProduct(p: any): Product | null {
  if (!p || typeof p !== "object") return null;
  const toStr = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && "fr" in v) return String(v.fr ?? "");
    if (typeof v === "object" && "ar" in v) return String(v.ar ?? "");
    return String(v);
  };
  const image = toStr(p.image);
  let images: string[] = [];
  if (Array.isArray(p.images)) {
    images = p.images.map(toStr).filter((s) => s.trim() !== "");
  } else if (typeof p.images === "string" && p.images.trim() !== "") {
    images = splitImageStrings(p.images);
  }
  images = Array.from(new Set(images));
  if (image && images[0] !== image) {
    images = [image, ...images.filter((i) => i !== image)];
  }

  let variations: Variation[] = [];
  if (Array.isArray(p.variations)) {
    variations = p.variations
      .filter((v: any) => v && typeof v === "object" && v.name)
      .map((v: any) => ({
        name: String(v.name),
        options: Array.isArray(v.options)
          ? v.options.map((o: any) => String(o)).filter(Boolean)
          : [],
      }))
      .filter((v: Variation) => v.options.length > 0);
  } else if (typeof p.variations === "string" && p.variations.trim()) {
    variations = parseVariations(p.variations);
  }

  const variants = normalizeVariants(p.variants);

  let highlights: string[] = [];
  if (Array.isArray(p.highlights)) {
    highlights = p.highlights.map((h: any) => String(h)).filter((h) => h.trim() !== "");
  } else if (typeof p.highlights === "string" && p.highlights.trim()) {
    highlights = parseHighlights(p.highlights);
  }

  return {
    id: String(p.id ?? ""),
    name: toStr(p.name),
    description: toStr(p.description ?? ""),
    category: toStr(p.category),
    price:
      p.price === null || p.price === undefined
        ? null
        : typeof p.price === "object" && p.price !== null
        ? null
        : Number(p.price),
    oldPrice:
      p.oldPrice === null || p.oldPrice === undefined || p.oldPrice === ""
        ? null
        : typeof p.oldPrice === "object" && p.oldPrice !== null
        ? null
        : Number(p.oldPrice),
    image,
    images,
    variations,
    variants,
    stock:
      p.stock === null || p.stock === undefined || p.stock === ""
        ? null
        : typeof p.stock === "object" && p.stock !== null
        ? null
        : Number(p.stock),
    highlights,
    sortOrder:
      p.sortOrder === null || p.sortOrder === undefined
        ? 999
        : Number(p.sortOrder),
    badge:
      p.badge === null || p.badge === undefined
        ? ""
        : String(p.badge),
    quantityTiers: normalizeTiers(p.quantityTiers),
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
  };
}

export function saveCatalog(products: Product[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch (e) {
    console.error("[saveCatalog] localStorage write failed:", e);
    return false;
  }
}

export function resetCatalog(): Product[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        CATALOG_STORAGE_KEY,
        JSON.stringify(SEED_PRODUCTS),
      );
    } catch {
      // ignore
    }
  }
  return SEED_PRODUCTS;
}

export function generateId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product";
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}
