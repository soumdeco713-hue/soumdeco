"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/products";

// Stock counts from Google Sheet CSV (Stock tab)
// CSV format: product_name, stock_count (number)
export type StockMap = Record<string, number>;

// localStorage key for caching stock data (survives page reloads)
const STOCK_CACHE_KEY = "soumdeco_stock_cache_v1";
// Cache TTL: 25 minutes (slightly less than poll interval to avoid stale data)
const STOCK_CACHE_TTL_MS = 25 * 60 * 1000;

// P0 FIX: Proper RFC 4180 CSV parser — handles quoted fields with commas + newlines
function parseCsv(text: string): StockMap {
  const map: StockMap = {};
  if (!text || typeof text !== "string") return map;

  // Parse CSV properly (handles quoted fields with embedded commas)
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // skip next char
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\n' || char === '\r') {
        // Handle \r\n and \n
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        if (currentRow.length > 0 && currentRow.some((c) => c.trim() !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }
  // Don't forget the last field
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((c) => c.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return map;

  let nameIdx = 0;
  let countIdx = 1;
  let startLine = 0;

  // Check if first row is a header
  const firstLine = rows[0].map((c) => c.toLowerCase().trim());
  if (
    firstLine.some((h) =>
      h.includes("stock") || h.includes("name") || h.includes("produit") || h.includes("اسم")
    )
  ) {
    firstLine.forEach((h, i) => {
      if (
        h.includes("produit") ||
        h.includes("name") ||
        h.includes("nom") ||
        h.includes("article") ||
        h.includes("اسم")
      )
        nameIdx = i;
      if (
        h.includes("stock") ||
        h.includes("count") ||
        h.includes("status") ||
        h.includes("كمية") ||
        h.includes("حالة")
      )
        countIdx = i;
    });
    startLine = 1;
  }

  for (let i = startLine; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= nameIdx) continue;
    const name = (row[nameIdx] || "").trim();
    const countStr = (row[countIdx] || "").trim();
    if (!name) continue;
    const count = parseInt(countStr, 10);
    if (!isNaN(count)) {
      map[name] = count;
    }
  }
  return map;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

// Load cached stock from localStorage (instant — no network)
function loadCachedStock(): StockMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STOCK_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    if (!parsed.map || typeof parsed.timestamp !== "number") return {};
    // Check if cache is still fresh (under TTL)
    if (Date.now() - parsed.timestamp > STOCK_CACHE_TTL_MS) {
      // Cache is stale — return it anyway (better than empty) but trigger a refresh
      return parsed.map as StockMap;
    }
    return parsed.map as StockMap;
  } catch {
    return {};
  }
}

// Save stock to localStorage
function saveCachedStock(map: StockMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STOCK_CACHE_KEY,
      JSON.stringify({ map, timestamp: Date.now() }),
    );
  } catch {
    // localStorage might be full — ignore (not critical)
  }
}

// Load bundled stock seed (instant — no network, served from Cloudflare Pages)
// This is used on the FIRST visit when localStorage is empty, to show stock
// badges immediately without waiting for Apps Script fetch.
let stockSeedCache: StockMap | null = null;
let stockSeedPromise: Promise<StockMap> | null = null;

async function loadStockSeed(): Promise<StockMap> {
  if (stockSeedCache) return stockSeedCache;
  if (stockSeedPromise) return stockSeedPromise;

  stockSeedPromise = (async () => {
    try {
      // G4 FIX: Add a 5-second timeout so a hanging fetch doesn't block forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      // P0 FIX: Changed from "force-cache" to "no-cache" — Chrome was caching
      // the stale seed forever, causing "everything out of stock" bug
      const res = await fetch("/stock-seed.json", {
        cache: "no-cache",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return {};
      const data = await res.json();
      if (!data || !data.map || typeof data.map !== "object") return {};
      const seedMap = data.map as StockMap;

      // P0 FIX: Sanity check — reject seeds where >90% of products have 0 stock
      // (indicates a corrupted/stale seed that would show everything as out of stock)
      const entries = Object.values(seedMap);
      if (entries.length > 0) {
        const zeroCount = entries.filter((v) => v === 0).length;
        const zeroRatio = zeroCount / entries.length;
        if (zeroRatio > 0.9) {
          console.warn(
            `[Stock] Seed rejected: ${zeroCount}/${entries.length} (${(zeroRatio * 100).toFixed(1)}%) products have 0 stock — likely corrupted seed`,
          );
          return {};
        }
      }

      stockSeedCache = seedMap;
      return stockSeedCache;
    } catch {
      // G4 FIX: Reset the promise so retries are possible
      stockSeedPromise = null;
      return {};
    }
  })();

  return stockSeedPromise;
}

// Polling intervals — optimized for variable traffic (10 to 800K visits/month).
// Stock data changes less frequently than catalog, so 2-hour polling is fine.
// Total with 100 active users: 26K + 1,200 = 27,200 exec/day → under 30K quota ✅
const POLL_MS = 7_200_000; // 2 hours when tab is visible
const HIDDEN_POLL_MS = 14_400_000; // 4 hours when tab is hidden

export function useStock() {
  // Initialize from localStorage cache (INSTANT — no network wait)
  // This prevents the "slow loading" when navigating between pages
  const [stockMap, setStockMap] = useState<StockMap>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  const hasFetchedRef = useRef(false); // track if we've fetched at least once

  // Pre-normalized lookup map — O(1) lookups
  const [normalizedMap, setNormalizedMap] = useState<Record<string, number>>({});

  // Load cached stock IMMEDIATELY on mount (before any network fetch)
  useEffect(() => {
    const cached = loadCachedStock();
    if (Object.keys(cached).length > 0) {
      setStockMap(cached);
      setLoading(false); // Cache exists — not loading anymore
    }
  }, []);

  // Rebuild normalized map whenever stockMap changes
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const key of Object.keys(stockMap)) {
      next[normalizeName(key)] = stockMap[key];
    }
    setNormalizedMap(next);
  }, [stockMap]);

  // ---- ADAPTIVE FETCH (Worker-first, never crashes) ----
  // Chain: Worker (?action=catalog returns both products+stock) → static CSV → seed → cache
  // Worker is OPTIONAL — if NEXT_PUBLIC_WORKER_URL is not set, it's skipped.
  // This means the site works perfectly WITHOUT the worker (current behavior),
  // and deploying the worker is an OPT-IN upgrade for 5-minute freshness.
  //
  // VISITOR FLOW:
  //   1. Try Worker (?action=catalog) — 5s timeout, returns {products, stock}
  //   2. If Worker fails OR not configured → try static /data/stock.csv
  //   3. If static also fails → use stock-seed.json
  //   4. If seed also fails → use localStorage cache (any age)
  //
  // CRITICAL: No per-visitor Apps Script calls. 50K+ visits/day without
  // hitting Apps Script's 20K/day limit. Stock updates appear within
  // 5 minutes (worker cron) or 24 hours (static rebuild).

  const fetchStock = useCallback(async () => {
    try {
      let csvText = "";

      // 1. Try Worker first (if configured) — returns combined catalog response
      try {
        const { fetchStockCsv } = await import("@/lib/worker-client");
        const result = await fetchStockCsv();
        if (result.csv && result.csv.trim().length > 0) {
          csvText = result.csv;
        }
      } catch {
        // Worker fetch failed — fall through to static
      }

      // 2. If Worker didn't return stock, try static CSV from Cloudflare CDN
      if (!csvText) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const res = await fetch("/data/stock.csv", {
            cache: "no-cache",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            csvText = await res.text();
          }
        } catch {
          // Static file fetch failed — will fall through to seed
        }
      }

      // 3. If both Worker + static failed, try stock-seed.json
      if (!csvText) {
        const seedMap = await loadStockSeed();
        if (seedMap && Object.keys(seedMap).length > 0) {
          setStockMap(seedMap);
          setLoading(false);
        }
        // Try cached stock
        const cached = loadCachedStock();
        if (Object.keys(cached).length > 0) {
          setStockMap(cached);
        }
      }

      if (csvText) {
        const newMap = parseCsv(csvText);

        // Sanity check — don't overwrite with all-zero data
        const entries = Object.values(newMap);
        if (entries.length > 0) {
          const zeroCount = entries.filter((v) => v === 0).length;
          const zeroRatio = zeroCount / entries.length;
          if (zeroRatio > 0.9) {
            console.warn(
              `[Stock] Fetch rejected: ${zeroCount}/${entries.length} (${(zeroRatio * 100).toFixed(1)}%) products have 0 stock — keeping current data`,
            );
            return;
          }
        }

        setStockMap(newMap);
        saveCachedStock(newMap);
        hasFetchedRef.current = true;
      }
    } catch {
      console.warn("[Stock] Fetch failed — using cached data");
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleNext = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = isVisibleRef.current ? POLL_MS : HIDDEN_POLL_MS;
    intervalRef.current = setInterval(() => {
      fetchStock();
    }, delay);
  }, [fetchStock]);

  useEffect(() => {
    // Only fetch if we don't have cached data OR cache is stale
    const cached = loadCachedStock();
    const hasCache = Object.keys(cached).length > 0;

    if (!hasCache) {
      // No cache — try loading from bundled seed first (instant)
      // Then fetch from Apps Script after 1s delay (lets catalog fetch go first)
      loadStockSeed().then((seedMap) => {
        if (seedMap && Object.keys(seedMap).length > 0) {
          setStockMap(seedMap);
          setLoading(false);
        }
      }).catch(() => {});
      // Delay stock fetch by 1s so it doesn't compete with catalog fetch
      setTimeout(() => fetchStock(), 1000);
    } else {
      // Cache exists — fetch in background after 2s (lower priority than catalog)
      setTimeout(() => fetchStock(), 2000);
    }
    scheduleNext();

    const onVisibility = () => {
      const wasHidden = !isVisibleRef.current;
      isVisibleRef.current = !document.hidden;
      if (!document.hidden) {
        if (wasHidden) fetchStock();
        scheduleNext();
      } else {
        scheduleNext();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchStock, scheduleNext]);

  /** Returns true if the product is out of stock (count = 0) */
  const isRupture = useCallback(
    (productName: string): boolean => {
      if (!productName) return false;
      const normalized = normalizeName(productName);
      return normalized in normalizedMap && normalizedMap[normalized] === 0;
    },
    [normalizedMap],
  );

  /** Returns the stock count for a product, or null if not in the Stock tab */
  const getStockCount = useCallback(
    (productName: string): number | null => {
      if (!productName) return null;
      const normalized = normalizeName(productName);
      return normalized in normalizedMap ? normalizedMap[normalized] : null;
    },
    [normalizedMap],
  );

  /** Returns true if the product has low stock (1-3 items) */
  const isLowStock = useCallback(
    (productName: string): boolean => {
      const count = getStockCount(productName);
      return count !== null && count > 0 && count <= 3;
    },
    [getStockCount],
  );

  /** Returns true if a SPECIFIC VARIANT is out of stock.
   *  Uses naming convention: "Product Name - Variant Name" in the Stock tab.
   *  Example: "Service a table - Red" with count 0 → Red variant is out of stock.
   *  If no variant-specific entry exists, returns false (variant is available). */
  const isVariantRupture = useCallback(
    (productName: string, variantName: string): boolean => {
      if (!productName || !variantName) return false;
      const key = `${productName} - ${variantName}`;
      const normalized = normalizeName(key);
      return normalized in normalizedMap && normalizedMap[normalized] === 0;
    },
    [normalizedMap],
  );

  return { stockMap, loading, isRupture, isLowStock, getStockCount, isVariantRupture };
}
