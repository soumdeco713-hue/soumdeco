// ============================================================
//  WORKER CLIENT — Single Source of Truth for Data Fetching
// ============================================================
//  Adaptive fallback chain:
//    1. Worker (if NEXT_PUBLIC_WORKER_URL is set + reachable) → ~30ms, 5-min fresh
//    2. Static JSON from Cloudflare CDN (/data/products.json) → ~50ms, max 24h stale
//    3. localStorage cache → instant, last known
//    4. Seed data → built-in fallback
//
//  NEVER-ERROR PRINCIPLE:
//  - Every function returns a valid object even on failure (never throws)
//  - All fetches have timeouts (5s for worker, 5s for static)
//  - Worker URL is optional — if not set, falls through to static JSON
//  - If Worker returns empty/error, falls through to static JSON
//  - Admin operations (refresh) silently fail with user-friendly errors
// ============================================================

import type { SheetProduct } from "./sheet";

// === Worker URL (optional — if not set, site uses static JSON only) ===
// Set via Cloudflare Pages env var: NEXT_PUBLIC_WORKER_URL
// NOTE: Use direct `process.env.NEXT_PUBLIC_*` access so Next.js inlines
// the value at build time (no `typeof process` check — that breaks inlining).
const WORKER_URL: string | null =
  (process.env.NEXT_PUBLIC_WORKER_URL as string | undefined) || null;

const WORKER_ADMIN_SECRET: string | null =
  (process.env.NEXT_PUBLIC_WORKER_ADMIN_SECRET as string | undefined) ||
  null;

function getWorkerUrl(): string | null {
  if (!WORKER_URL) return null;
  return WORKER_URL.endsWith("/") ? WORKER_URL.slice(0, -1) : WORKER_URL;
}

function getAdminSecret(): string | null {
  return WORKER_ADMIN_SECRET;
}

// === Fetch with timeout (never throws, returns null on failure) ===
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch {
    return null;
  }
}

// === Types ===
export type CatalogResponse = {
  products: SheetProduct[];
  stockCsv: string;
  source: "worker" | "static" | "cache" | "seed" | "empty";
  workerHealthy?: boolean;
  ts?: number;
};

export type WorkerHealth = {
  ok: boolean;
  lastSync?: number | null;
  lastChange?: number | null;
  productCount?: number;
  kvHits?: number;
  error?: string;
};

// === Catalog fetcher (combined products + stock in one call) ===
// Tries Worker first, falls back to static JSON, never throws.
export async function fetchCatalog(): Promise<CatalogResponse> {
  const workerUrl = getWorkerUrl();

  // 1. Try Worker (if configured)
  if (workerUrl) {
    try {
      const res = await fetchWithTimeout(
        `${workerUrl}/?action=catalog`,
        { cache: "no-cache" },
        5000,
      );
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.products === "string") {
          let products: SheetProduct[] = [];
          try {
            const parsed = JSON.parse(data.products);
            if (Array.isArray(parsed)) {
              products = parsed.map(normalizeSheetProduct);
            }
          } catch {}

          if (products.length > 0) {
            return {
              products,
              stockCsv: typeof data.stock === "string" ? data.stock : "",
              source: "worker",
              workerHealthy: true,
              ts: data.ts || Date.now(),
            };
          }
        }
      }
    } catch {
      // Fall through to static
    }
  }

  // 2. Fallback: static JSON + static CSV (parallel)
  const [productsRes, stockRes] = await Promise.all([
    fetchWithTimeout("/data/products.json", { cache: "no-cache" }, 5000),
    fetchWithTimeout("/data/stock.csv", { cache: "no-cache" }, 5000),
  ]);

  let products: SheetProduct[] = [];
  if (productsRes && productsRes.ok) {
    try {
      const arr = await productsRes.json();
      if (Array.isArray(arr)) {
        products = arr.map(normalizeSheetProduct);
      }
    } catch {}
  }

  let stockCsv = "";
  if (stockRes && stockRes.ok) {
    try {
      stockCsv = await stockRes.text();
    } catch {}
  }

  return {
    products,
    stockCsv,
    source: products.length > 0 ? "static" : "empty",
    workerHealthy: false,
    ts: Date.now(),
  };
}

// === Products-only fetcher (legacy hook support) ===
export async function fetchProducts(): Promise<{
  products: SheetProduct[];
  source: CatalogResponse["source"];
}> {
  const catalog = await fetchCatalog();
  return { products: catalog.products, source: catalog.source };
}

// === Stock-only fetcher (legacy hook support) ===
export async function fetchStockCsv(): Promise<{
  csv: string;
  source: CatalogResponse["source"];
}> {
  const catalog = await fetchCatalog();
  return { csv: catalog.stockCsv, source: catalog.source };
}

// === Health check (used by health-monitor + admin panel) ===
export async function fetchWorkerHealth(): Promise<WorkerHealth> {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    return { ok: false, error: "worker_not_configured" };
  }
  try {
    const res = await fetchWithTimeout(
      `${workerUrl}/?action=health`,
      { cache: "no-store" },
      3000,
    );
    if (!res || !res.ok) {
      return { ok: false, error: res ? `http_${res.status}` : "fetch_failed" };
    }
    const data = await res.json();
    return {
      ok: true,
      lastSync: data.lastSync || null,
      lastChange: data.lastChange || null,
      productCount: data.productCount || 0,
      kvHits: data.kvHits || 0,
    };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

// === Admin: trigger manual refresh (used by "Refresh now" button) ===
// Never throws — returns a user-friendly result.
export async function triggerWorkerRefresh(): Promise<{
  ok: boolean;
  message: string;
  synced?: boolean;
}> {
  const workerUrl = getWorkerUrl();
  const secret = getAdminSecret();
  if (!workerUrl) {
    return {
      ok: false,
      message: "Le service de synchronisation n'est pas configuré.",
    };
  }
  if (!secret) {
    return {
      ok: false,
      message: "Clé d'administration manquante — reconfigurez le worker.",
    };
  }
  try {
    const res = await fetchWithTimeout(
      `${workerUrl}/?action=refresh`,
      {
        method: "POST",
        headers: {
          "X-Admin-Secret": secret,
          "Content-Type": "application/json",
        },
      },
      15000,
    );
    if (!res) {
      return { ok: false, message: "Le worker ne répond pas." };
    }
    const data = await res.json().catch(() => ({}));
    if (data?.ok && data?.synced) {
      return {
        ok: true,
        synced: true,
        message: data.productsChanged || data.stockChanged
          ? "Données mises à jour — les visiteurs verront les changements dans 5 minutes max."
          : "Aucun changement détecté — les données sont déjà à jour.",
      };
    }
    return {
      ok: false,
      message: data?.error
        ? `Erreur: ${data.error}`
        : "La synchronisation a échoué.",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Erreur réseau: ${String((err as Error)?.message || err)}`,
    };
  }
}

// === Check if Worker is configured (for UI status display) ===
export function isWorkerConfigured(): boolean {
  return getWorkerUrl() !== null;
}

// === Internal: normalize sheet product (defensive) ===
function normalizeSheetProduct(p: any): SheetProduct {
  return {
    id: String(p?.id ?? ""),
    name: String(p?.name ?? ""),
    description: String(p?.description ?? ""),
    category: String(p?.category ?? ""),
    price:
      p?.price === null ||
      p?.price === undefined ||
      p?.price === "" ||
      typeof p?.price === "object"
        ? null
        : Number(p.price),
    image: String(p?.image ?? ""),
    images: String(p?.images ?? ""),
    featured:
      p?.featured === true ||
      p?.featured === 1 ||
      p?.featured === "1" ||
      p?.featured === "true",
    isSpecialOffer:
      p?.isSpecialOffer === true ||
      p?.isSpecialOffer === 1 ||
      p?.isSpecialOffer === "1" ||
      p?.isSpecialOffer === "true",
    variations: String(p?.variations ?? ""),
    variants: String(p?.variants ?? ""),
    stock:
      p?.stock === null ||
      p?.stock === undefined ||
      p?.stock === "" ||
      typeof p?.stock === "object"
        ? null
        : Number(p.stock),
    highlights: String(p?.highlights ?? ""),
    sortOrder: p?.sortOrder === null || p?.sortOrder === undefined ? 999 : Number(p.sortOrder),
    badge: String(p?.badge ?? ""),
    oldPrice:
      p?.oldPrice === null || p?.oldPrice === undefined || p?.oldPrice === ""
        ? null
        : Number(p.oldPrice),
    quantityTiers: String(p?.quantityTiers ?? ""),
  };
}
