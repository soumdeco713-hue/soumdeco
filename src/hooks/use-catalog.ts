"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Product,
  Variation,
  ProductVariant,
  CATALOG_STORAGE_KEY,
  saveCatalog,
  loadCatalog,
  generateId,
  parseVariations,
  parseHighlights,
  normalizeTiers,
  normalizeVariants,
  SEED_PRODUCTS,
} from "@/lib/products";
import {
  clientListProducts,
  clientUpsertProduct,
  clientDeleteProduct,
  clientResetProducts,
  clientUploadImages,
} from "@/lib/client-sheet";
import {
  joinImageStrings,
  joinVariations,
  joinVariants,
  joinHighlights,
} from "@/lib/products";
import type { SheetProduct } from "@/lib/sheet";

const POLL_MS = 330_000; // poll every 5.5 minutes when visible
const HIDDEN_POLL_MS = 1_100_000; // ~18 min when tab is hidden

export function useCatalog() {
  // Initialize empty on both server and client (hydration-safe)
  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  // Always-current snapshot of products — used by callbacks that need
  // the latest products without re-creating the callback (e.g. addBlankProduct).
  const productsRef = useRef<Product[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // ---- Fetch DIRECTLY from Google Apps Script (bypasses broken edge API) ----
  // The Cloudflare Pages edge API routes return 500 errors due to a
  // Next.js 16 + @cloudflare/next-on-pages v1 incompatibility. To make the
  // site work reliably, we fetch products directly from the Apps Script
  // web app in the browser. This is faster AND more reliable.
  const refresh = useCallback(async () => {
    try {
      // 1. Try fetching directly from Google Apps Script
      const fetched = await clientListProducts();

      if (fetched.length > 0) {
        // ── SHEET MODE (real Google Sheet data) ──
        // Deduplicate by ID (the sheet sometimes has duplicate rows).
        const seen = new Set<string>();
        const unique: SheetProduct[] = [];
        for (const p of fetched) {
          const id = String(p.id || "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          unique.push(p);
        }

        let next: Product[] = unique.map(normalizeProduct);

        // Fix common typos in category names
        next = next.map(fixCategoryTypos);

        // Sort by sortOrder (lower first)
        next.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

        // Sheet is the source of truth — always save to localStorage
        saveCatalog(next);
        setProducts(next);
        setLoading(false);
        return;
      }

      // 2. Sheet returned empty or failed — use localStorage cache, then seed
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem(CATALOG_STORAGE_KEY)
        : null;
      if (raw !== null) {
        const cached = loadCatalog();
        if (cached.length > 0) {
          const sorted = [...cached].sort(
            (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
          );
          setProducts(sorted);
          setLoading(false);
          return;
        }
      }
      // First visit ever — seed with the 29 demo products
      const seeded = [...SEED_PRODUCTS].sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
      );
      saveCatalog(seeded);
      setProducts(seeded);
      setLoading(false);
    } catch {
      // Network error — keep current state, but if empty, use cache/seed
      setProducts((prev) => {
        if (prev.length === 0) {
          const raw = typeof window !== "undefined"
            ? window.localStorage.getItem(CATALOG_STORAGE_KEY)
            : null;
          if (raw === null) {
            saveCatalog(SEED_PRODUCTS);
            const seeded = [...SEED_PRODUCTS];
            seeded.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
            return seeded;
          }
          const cached = loadCatalog();
          const sorted = [...cached];
          sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
          return sorted;
        }
        return prev;
      });
      setLoading(false);
    }
  }, []);

  // Schedule the next poll based on current visibility
  const scheduleNext = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const delay = isVisibleRef.current ? POLL_MS : HIDDEN_POLL_MS;
    pollRef.current = setInterval(refresh, delay);
  }, [refresh]);

  // Initial load + polling
  useEffect(() => {
    // First load from localStorage cache (instant), then refresh from sheet.
    // Only seed with SEED_PRODUCTS on the VERY FIRST visit (when the
    // catalog key was never set). After that, respect the user's catalog
    // even if it's empty — they may have deleted all products intentionally.
    let cached: Product[];
    const raw = typeof window !== "undefined"
      ? window.localStorage.getItem(CATALOG_STORAGE_KEY)
      : null;
    if (raw === null) {
      cached = SEED_PRODUCTS;
      saveCatalog(SEED_PRODUCTS);
    } else {
      cached = loadCatalog();
    }
    // Sort by sortOrder (lower first)
    const sorted = [...cached];
    sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    setProducts(sorted);
    setHydrated(true);
    // Immediately refresh from sheet — don't wait for the cached data to show
    refresh();
    scheduleNext();

    // Pause/slow polling when tab hidden, refresh immediately when visible again
    const onVisibility = () => {
      const wasHidden = !isVisibleRef.current;
      isVisibleRef.current = !document.hidden;
      if (!document.hidden && wasHidden) refresh();
      scheduleNext();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, scheduleNext]);

  // ---- UPSERT (admin) ----
  // Uploads images to Cloudinary (client-side unsigned upload), then
  // POSTs the product directly to Google Apps Script.
  const upsertProduct = useCallback(
    async (product: Product) => {
      // Optimistic local update
      setProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === product.id);
        let next: Product[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = product;
        } else {
          next = [product, ...prev];
        }
        // Sort by sortOrder
        next.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        saveCatalog(next);
        return next;
      });

      // Sync directly to Apps Script (with Cloudinary image upload)
      setSyncing(true);
      try {
        // 1. Upload any base64 images to Cloudinary
        const imagesToUpload = product.images || (product.image ? [product.image] : []);
        const uploadedUrls = await clientUploadImages(imagesToUpload, product.id);
        const coverImage = uploadedUrls[0] || product.image || "";

        // 2. Build the SheetProduct payload
        const sheetProduct: SheetProduct = {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          price: product.price,
          image: coverImage,
          images: joinImageStrings(uploadedUrls),
          featured: product.featured,
          isSpecialOffer: product.isSpecialOffer ?? false,
          variations: joinVariations(product.variations),
          variants: joinVariants(product.variants),
          stock: product.stock ?? null,
          highlights: joinHighlights(product.highlights),
          sortOrder: product.sortOrder ?? 999,
          badge: product.badge || "",
          oldPrice: product.oldPrice ?? null,
          quantityTiers: Array.isArray(product.quantityTiers)
            ? (product.quantityTiers as any[])
                .filter((t) => t && typeof t.qty === "number")
                .map((t) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}`)
                .join(",")
            : String((product as any).quantityTiers ?? ""),
        };

        // 3. POST to Apps Script
        const ok = await clientUpsertProduct(sheetProduct);
        if (!ok) {
          console.error("[upsertProduct] Apps Script POST failed");
        }
        // Refresh to get the canonical state from the sheet
        if (ok) await refresh();
      } catch (e) {
        console.error("[upsertProduct] error:", e);
      } finally {
        setSyncing(false);
      }
    },
    [refresh],
  );

  // ---- DELETE (admin) ----
  const deleteProduct = useCallback(
    async (id: string) => {
      setProducts((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveCatalog(next);
        return next;
      });
      setSyncing(true);
      try {
        await clientDeleteProduct(id);
        await refresh();
      } finally {
        setSyncing(false);
      }
    },
    [refresh],
  );

  // ---- ADD BLANK (admin) ----
  const addBlankProduct = useCallback(() => {
    // New products appear at the bottom of the list by default.
    const maxSort = productsRef.current.reduce(
      (max, p) => Math.max(max, p.sortOrder ?? 0),
      0,
    );
    const newProduct: Product = {
      id: generateId("nouveau"),
      name: "",
      description: "",
      category: "",
      price: null,
      oldPrice: null,
      image: "",
      images: [],
      featured: false,
      inStock: true,
      isSpecialOffer: false,
      variations: [],
      variants: [],
      stock: null,
      highlights: [],
      sortOrder: maxSort + 1,
      badge: "",
      quantityTiers: [],
    };
    return newProduct;
  }, []);

  // ---- REORDER (admin) ----
  // Move a product up (toward the front of the list) or down (toward the back).
  // Swaps its sortOrder with the adjacent product, persists to localStorage,
  // re-sorts the visible list immediately, and syncs both products to the sheet.
  const moveProduct = useCallback(
    (id: string, direction: "up" | "down") => {
      let toSync: Product[] = [];
      setProducts((prev) => {
        if (prev.length < 2) return prev;
        // Ensure sorted by sortOrder before swap
        const sorted = [...prev].sort(
          (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
        );
        const idx = sorted.findIndex((p) => p.id === id);
        if (idx < 0) return prev;
        const swapWith = direction === "up" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= sorted.length) return prev;
        // Swap sortOrder values — create NEW objects (don't mutate)
        const aOrder = sorted[idx].sortOrder ?? 999;
        const bOrder = sorted[swapWith].sortOrder ?? 999;
        const newA = { ...sorted[idx], sortOrder: bOrder };
        const newB = { ...sorted[swapWith], sortOrder: aOrder };
        sorted[idx] = newA;
        sorted[swapWith] = newB;
        // Re-sort
        sorted.sort((x, y) => (x.sortOrder ?? 999) - (y.sortOrder ?? 999));
        saveCatalog(sorted);
        // Collect the 2 products to sync to the sheet
        toSync = [newA, newB];
        return sorted;
      });
      // Sync both swapped products directly to Apps Script (fire and forget)
      if (toSync.length === 2) {
        for (const p of toSync) {
          const sheetProduct: SheetProduct = {
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            image: p.image,
            images: joinImageStrings(p.images || []),
            featured: p.featured,
            isSpecialOffer: p.isSpecialOffer ?? false,
            variations: joinVariations(p.variations),
            variants: joinVariants(p.variants),
            stock: p.stock ?? null,
            highlights: joinHighlights(p.highlights),
            sortOrder: p.sortOrder ?? 999,
            badge: p.badge || "",
            oldPrice: p.oldPrice ?? null,
            quantityTiers: Array.isArray(p.quantityTiers)
              ? (p.quantityTiers as any[])
                  .filter((t) => t && typeof t.qty === "number")
                  .map((t) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}`)
                  .join(",")
              : "",
          };
          clientUpsertProduct(sheetProduct).catch(() => {});
        }
      }
    },
    [],
  );

  // ---- RESET (admin) ----
  const resetCatalog = useCallback(async () => {
    setSyncing(true);
    try {
      // Reset localStorage to SEED_PRODUCTS FIRST (so the UI updates immediately)
      saveCatalog(SEED_PRODUCTS);
      const sorted = [...SEED_PRODUCTS].sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
      );
      setProducts(sorted);
      // Then reset the sheet directly via Apps Script
      await clientResetProducts();
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    products,
    hydrated,
    loading,
    syncing,
    upsertProduct,
    deleteProduct,
    addBlankProduct,
    moveProduct,
    resetCatalog,
    refresh,
  };
}

// ---------- internal ----------

/**
 * Fix common category name typos that exist in the Google Sheet data.
 * - "Meubes" → "Meubles" (missing 'l')
 * - Trim whitespace
 * - Normalize case for known categories
 */
function fixCategoryTypos(p: Product): Product {
  let cat = (p.category || "").trim();
  if (cat === "Meubes") cat = "Meubles";
  if (cat !== p.category) {
    return { ...p, category: cat };
  }
  return p;
}

function normalizeProduct(p: any): Product {
  const toStr = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    return String(v);
  };
  const image = toStr(p.image);
  let images: string[] = [];
  if (Array.isArray(p.images)) {
    images = p.images.map(toStr).filter((s) => s.trim() !== "");
  } else if (typeof p.images === "string" && p.images.trim() !== "") {
    const s = p.images.trim();
    if (s.includes("~~~")) {
      images = s.split("~~~").map((x) => x.trim()).filter((x) => x !== "");
    } else if (s.includes("|||")) {
      images = s.split("|||").map((x) => x.trim()).filter((x) => x !== "");
    } else if (s.includes("|")) {
      images = s.split("|").map((x) => x.trim()).filter((x) => x !== "");
    } else if (s.includes("data:")) {
      images = s.split(/,(?=data:)/).map((x) => x.trim()).filter((x) => x !== "");
    } else {
      images = s.split(",").map((x) => x.trim()).filter((x) => x !== "");
    }
  }
  images = Array.from(new Set(images));
  if (image && images[0] !== image) {
    images = [image, ...images.filter((i) => i !== image)];
  }
  return {
    id: String(p.id ?? ""),
    name: toStr(p.name),
    description: toStr(p.description ?? ""),
    category: toStr(p.category),
    price:
      p.price === null ||
      p.price === undefined ||
      p.price === "" ||
      (typeof p.price === "object" && p.price !== null)
        ? null
        : Number(p.price),
    oldPrice:
      p.oldPrice === null ||
      p.oldPrice === undefined ||
      p.oldPrice === "" ||
      (typeof p.oldPrice === "object" && p.oldPrice !== null)
        ? null
        : Number(p.oldPrice),
    image,
    images,
    variations: Array.isArray(p.variations)
      ? (p.variations as Variation[]).filter(
          (v) => v && v.name && Array.isArray(v.options) && v.options.length > 0,
        )
      : parseVariations(typeof p.variations === "string" ? p.variations : ""),
    variants: normalizeVariants(p.variants) as ProductVariant[],
    stock:
      p.stock === null ||
      p.stock === undefined ||
      p.stock === "" ||
      (typeof p.stock === "object" && p.stock !== null)
        ? null
        : Number(p.stock),
    highlights: Array.isArray(p.highlights)
      ? (p.highlights as string[]).map((h) => String(h)).filter((h) => h.trim() !== "")
      : parseHighlights(typeof p.highlights === "string" ? p.highlights : ""),
    sortOrder:
      p.sortOrder === null || p.sortOrder === undefined
        ? 999
        : Number(p.sortOrder),
    badge:
      p.badge === null || p.badge === undefined ? "" : String(p.badge),
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
    inStock: p.inStock !== false,
  };
}
