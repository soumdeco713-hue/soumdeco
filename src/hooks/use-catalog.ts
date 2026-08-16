"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Product,
  Variation,
  ProductVariant,
  CATALOG_STORAGE_KEY,
  saveCatalog,
  saveCatalogAsync,
  loadCatalog,
  loadCatalogAsync,
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
import { getLocalPathSync, loadImageManifest } from "@/lib/image-manifest";
import {
  joinImageStrings,
  joinVariations,
  joinVariants,
  joinHighlights,
} from "@/lib/products";
import type { SheetProduct } from "@/lib/sheet";

// Polling intervals — optimized for variable traffic (10 to 800K visits/month).
// At 800K visits/month = 26K visits/day × 1 fetch = 26K exec/day.
// Polling every 2 hours = 12 polls/day per active user.
// Total: 26K + (100 active users × 12) = 27,200 exec/day → under 30K quota ✅
const POLL_MS = 7_200_000; // 2 hours when tab is visible
const HIDDEN_POLL_MS = 14_400_000; // 4 hours when tab is hidden

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

  // ---- STATIC-FIRST FETCH (no per-visitor Apps Script calls) ----
  // 1. Static JSON from Cloudflare CDN (50ms, NEVER crashes)
  // 2. Fallback: localStorage → IndexedDB → SEED_PRODUCTS
  //
  // CRITICAL: No per-visitor Apps Script calls. This ensures the site
  // can handle 50K+ visits/day without hitting Apps Script's 20K/day limit.
  // Admin's changes appear after the daily GitHub Actions sync (max 24h).
  //
  // For 5-minute updates, a standalone Cloudflare Worker is available
  // (see worker/data-sync.js). Deploy it to enable real-time KV updates.
  // The frontend will automatically use the Worker URL if configured.

  const WORKER_URL = "https://soumdeco-data-sync.iridescent-clematis.workers.dev";
  const USE_WORKER = false; // Set to true after claiming the Worker account

  const refresh = useCallback(async () => {
    try {
      // 0. INSTANTLY show cached data (for returning visitors — 0ms)
      const instantCached = loadCatalog();
      if (instantCached.length > 0) {
        let quick = instantCached.map(optimizeCloudinaryUrls).map(fixCategoryTypos);
        quick.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setProducts(quick);
        setLoading(false);
      }

      // 1. Fetch from Worker (if deployed) or static JSON (fallback)
      let fetched: SheetProduct[] = [];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const url = USE_WORKER
          ? `${WORKER_URL}/?action=products`
          : "/data/products.json";
        const res = await fetch(url, {
          cache: "no-cache",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            fetched = data.map(normalizeSheetProductInline);
          }
        }
      } catch {
        // Fetch failed — will fall through to cache/seed
      }

      if (fetched.length > 0) {
        const seen = new Set<string>();
        const unique: SheetProduct[] = [];
        for (const p of fetched) {
          const id = String(p.id || "").trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          unique.push(p);
        }

        let next: Product[] = unique.map(normalizeProduct);
        next = next.map(fixCategoryTypos);
        next = next.map(optimizeCloudinaryUrls);
        next.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

        saveCatalog(next);
        saveCatalogAsync(next).catch(() => {});
        setProducts(next);
        setLoading(false);
        return;
      }

      // 2. Static JSON failed — use cache, then seed
      const cached = await loadCatalogAsync();
      if (cached.length > 0) {
        let sorted = cached.map(optimizeCloudinaryUrls).map(fixCategoryTypos);
        sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setProducts(sorted);
        setLoading(false);
        return;
      }
      const seeded = [...SEED_PRODUCTS].sort(
        (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
      );
      saveCatalog(seeded);
      setProducts(seeded);
      setLoading(false);
    } catch {
      // Network error — keep current state, but if empty, use cache/seed
      const cachedSync = loadCatalog();
      if (cachedSync.length > 0) {
        const sorted = [...cachedSync].map(optimizeCloudinaryUrls).map(fixCategoryTypos);
        sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setProducts(sorted);
      } else {
        const seeded = [...SEED_PRODUCTS].sort(
          (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
        );
        saveCatalog(seeded);
        setProducts(seeded);
      }
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
    // First load from localStorage cache (instant sync load for fast paint).
    // Then refresh from sheet (async, uses adaptive storage for large catalogs).
    let cached: Product[] = loadCatalog();
    if (cached.length === 0) {
      // Check if this is the first visit (localStorage key was never set)
      const raw = typeof window !== "undefined"
        ? window.localStorage.getItem(CATALOG_STORAGE_KEY)
        : null;
      if (raw === null) {
        cached = SEED_PRODUCTS;
        saveCatalog(SEED_PRODUCTS);
      }
    }
    // Apply URL rewriting to cached products too — the cache may have
    // old Cloudinary URLs from before the local-image migration.
    cached = cached.map(optimizeCloudinaryUrls);
    cached = cached.map(fixCategoryTypos);
    // Sort by sortOrder (lower first)
    const sorted = [...cached];
    sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    setProducts(sorted);
    setHydrated(true);
    // CRITICAL: Set loading=false IMMEDIATELY if we have any data.
    // This prevents the "stuck at loading" issue — users see products
    // right away, even if the background fetch is still in progress.
    if (sorted.length > 0) {
      setLoading(false);
    }
    // If we have cached data, delay the refresh slightly (300ms) so the
    // page can paint first. This makes navigation feel instant.
    // If no cached data, fetch immediately (we need it to show anything).
    if (cached.length > 0) {
      setTimeout(() => refresh(), 300);
    } else {
      refresh();
    }
    scheduleNext();

    // Also try loading from IndexedDB (handles large catalogs that overflow
    // localStorage — the sync loadCatalog() above may have missed them)
    // ONLY use IndexedDB data if we DON'T have fresher data already loaded.
    // The refresh() call above fetches from the sheet (source of truth) —
    // if it completes before this IndexedDB check, we skip the stale data.
    loadCatalogAsync().then((asyncCached) => {
      // Only use IndexedDB data if:
      // 1. It has more products than the sync cache (localStorage overflow case)
      // 2. The sheet refresh hasn't already loaded fresher data
      // We check productsRef.current (latest state) instead of the stale `cached`
      const currentCount = productsRef.current.length;
      if (asyncCached.length > currentCount && currentCount <= cached.length) {
        let sorted = asyncCached.map(optimizeCloudinaryUrls).map(fixCategoryTypos);
        sorted.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setProducts(sorted);
      }
    }).catch(() => {});

    // Load the image manifest, then RE-APPLY optimizeCloudinaryUrls.
    // On initial render, the manifest isn't loaded yet, so URLs stay as
    // Cloudinary (which works but throttles under load). Once the manifest
    // loads (~200ms later), we rewrite to local Paths paths (unlimited bandwidth).
    loadImageManifest()
      .then(() => {
        const current = productsRef.current;
        if (current.length > 0) {
          const rewritten = current.map(optimizeCloudinaryUrls);
          setProducts(rewritten);
        }
      })
      .catch(() => {});

    // Retry any failed orders from the retry queue (background, non-blocking).
    // This runs on every page visit — if the previous order failed to submit,
    // it gets retried here silently.
    import("@/lib/failed-orders")
      .then(({ retryFailedOrders }) => retryFailedOrders())
      .catch(() => {});

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
  //
  // BULLETPROOF + FAST:
  //  - Images are uploaded on SELECT (in admin-panel handleFiles), so by
  //    the time Save is clicked, photos are already Cloudinary URLs.
  //  - clientUploadImages skips URLs (not data: URLs), so it's instant.
  //  - After a successful POST, we DON'T await a full refresh — the
  //    optimistic update already shows the change. A background refresh
  //    is scheduled (non-blocking) to sync any sheet-side changes.
  //  - On failure, rolls back the optimistic update + throws an error
  //    so the admin panel can show a failure toast.
  const upsertProduct = useCallback(
    async (product: Product) => {
      // Save the previous state for rollback
      const previousProducts = productsRef.current;

      // Optimistic local update (INSTANT — UI shows the change immediately)
      const idx = previousProducts.findIndex((p) => p.id === product.id);
      let optimisticNext: Product[];
      if (idx >= 0) {
        optimisticNext = [...previousProducts];
        optimisticNext[idx] = product;
      } else {
        optimisticNext = [product, ...previousProducts];
      }
      optimisticNext.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      setProducts(optimisticNext);
      saveCatalog(optimisticNext);

      // Sync to Apps Script
      setSyncing(true);
      try {
        // 1. Upload any base64 images to Cloudinary.
        //    Since images are now uploaded on SELECT (in handleFiles),
        //    this is typically a no-op — the photos are already URLs.
        //    This call only runs for the rare case of leftover base64 images.
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
                .map((t) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}:${t.mode || "exact"}`)
                .join(",")
            : String((product as any).quantityTiers ?? ""),
        };

        // 3. POST to Apps Script (the ONLY slow step — 1-3s)
        const ok = await clientUpsertProduct(sheetProduct);
        if (!ok) {
          // ROLLBACK — the product didn't save to the sheet.
          setProducts(previousProducts);
          saveCatalog(previousProducts);
          throw new Error("Apps Script POST failed — product not saved to sheet");
        }
        // 4. DO NOT await refresh() — that would re-fetch all 83 products (2-5s).
        //    The optimistic update already shows the change. Schedule a background
        //    refresh (non-blocking) so the catalog stays in sync with the sheet.
        //    This makes Save feel instant to the admin.
        setTimeout(() => { refresh().catch(() => {}); }, 100);
      } catch (e) {
        // If error happened AFTER the optimistic update, rollback
        console.error("[upsertProduct] error:", e);
        setProducts(previousProducts);
        saveCatalog(previousProducts);
        throw e; // re-throw so admin panel can show error toast
      } finally {
        setSyncing(false);
      }
    },
    [refresh],
  );

  // ---- DELETE (admin) ----
  // BULLETPROOF: On failure, restores the deleted product so the UI
  // stays consistent with the sheet. Throws on failure.
  const deleteProduct = useCallback(
    async (id: string) => {
      const previousProducts = productsRef.current;
      const deletedProduct = previousProducts.find((p) => p.id === id);

      // Optimistic: remove from state + localStorage
      const next = previousProducts.filter((p) => p.id !== id);
      setProducts(next);
      saveCatalog(next);

      setSyncing(true);
      try {
        const ok = await clientDeleteProduct(id);
        if (!ok) {
          // ROLLBACK — restore the deleted product
          if (deletedProduct) {
            const restored = [...previousProducts];
            restored.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
            setProducts(restored);
            saveCatalog(restored);
          }
          throw new Error("Apps Script delete failed — product not removed from sheet");
        }
        // Don't await refresh() — the optimistic update already removed
        // the product from the UI. Background refresh syncs the catalog.
        setTimeout(() => { refresh().catch(() => {}); }, 100);
      } catch (e) {
        console.error("[deleteProduct] error:", e);
        // Rollback if not already done
        if (deletedProduct) {
          const restored = [...previousProducts];
          restored.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
          setProducts(restored);
          saveCatalog(restored);
        }
        throw e;
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
                  .map((t) => `${t.qty}:${t.freeShipping || "none"}:${t.discountAmount || 0}:${t.mode || "exact"}`)
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

// Inline version of normalizeSheetProduct (from client-sheet.ts)
// Used to normalize the static JSON response (same format as Apps Script)
function normalizeSheetProductInline(p: any): SheetProduct {
  return {
    id: String(p.id ?? ""),
    name: String(p.name ?? ""),
    description: String(p.description ?? ""),
    category: String(p.category ?? ""),
    price:
      p.price === null || p.price === undefined || p.price === "" ||
      (typeof p.price === "object" && p.price !== null)
        ? null : Number(p.price),
    image: String(p.image ?? ""),
    images: String(p.images ?? ""),
    featured: (p.featured === true || p.featured === 1 || p.featured === "1" ||
               (typeof p.featured === "string" && p.featured.toLowerCase() === "true")),
    isSpecialOffer: (p.isSpecialOffer === true || p.isSpecialOffer === 1 ||
                     p.isSpecialOffer === "1" ||
                     (typeof p.isSpecialOffer === "string" &&
                      p.isSpecialOffer.toLowerCase() === "true")),
    variations: String(p.variations ?? ""),
    variants: String(p.variants ?? ""),
    stock:
      p.stock === null || p.stock === undefined || p.stock === "" ||
      (typeof p.stock === "object" && p.stock !== null)
        ? null : Number(p.stock),
    highlights: String(p.highlights ?? ""),
    sortOrder: p.sortOrder === null || p.sortOrder === undefined ? 999 : Number(p.sortOrder),
    badge: String(p.badge ?? ""),
    oldPrice: p.oldPrice === null || p.oldPrice === undefined || p.oldPrice === "" ? null : Number(p.oldPrice),
    quantityTiers: String(p.quantityTiers ?? ""),
  };
}

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

/**
 * Rewrite Cloudinary URLs to LOCAL Cloudflare Pages paths.
 *
 * WHY: Cloudinary throttles when 80+ images load simultaneously (causing
 * the "images don't show" bug). Cloudflare Pages has unlimited bandwidth
 * AND unlimited requests — zero throttling.
 *
 * HOW: The image manifest (/public/image-manifest.json) lists all local
 * files. We check if a Cloudinary URL's filename is in the manifest.
 * If yes → rewrite to /images/products/{filename} (served from Pages).
 * If no  → keep Cloudinary URL (image not yet synced, Cloudinary fallback).
 *
 * NEW uploads: Go to Cloudinary first (instant display). After the daily
 * sync runs (GitHub Actions), they're downloaded to /public/images/products/
 * and the manifest is rebuilt. On next deploy, they're served from Pages.
 *
 * This is the BULLETPROOF strategy:
 *  - All existing images: served from Pages (unlimited, no throttling)
 *  - New uploads: served from Cloudinary (instant, until next sync)
 *  - Cloudinary bandwidth: near zero (only new uploads use it)
 *  - Pages bandwidth: unlimited (handles 800K visits/month)
 */
function optimizeCloudinaryUrls(p: Product): Product {
  const CLOUDINARY_RE = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)?(?:v\d+\/)?(.+)$/;

  const rewriteOne = (url: string): string => {
    if (!url || typeof url !== "string") return url;
    if (!url.includes("res.cloudinary.com")) return url;
    const match = url.match(CLOUDINARY_RE);
    if (!match) return url;

    // Check if this image is in the local manifest (hot tier)
    const filename = match[1];
    const localPath = getLocalPathSync(url);
    if (localPath) {
      return localPath; // serve from Cloudflare Pages (unlimited bandwidth)
    }
    return url; // serve from Cloudinary (not yet synced)
  };

  const newImage = rewriteOne(p.image);
  let newImages: string[] | undefined = p.images;
  if (Array.isArray(p.images)) {
    newImages = p.images.map(rewriteOne);
  }

  if (newImage !== p.image || newImages !== p.images) {
    return { ...p, image: newImage, images: newImages };
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
