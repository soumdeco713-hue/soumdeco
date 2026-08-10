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

function parseCsv(text: string): StockMap {
  const map: StockMap = {};
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return map;

  let nameIdx = 0;
  let countIdx = 1;
  let startLine = 0;

  const firstLine = lines[0].toLowerCase();
  if (
    firstLine.includes("stock") ||
    firstLine.includes("name") ||
    firstLine.includes("produit") ||
    firstLine.includes("اسم")
  ) {
    const headers = firstLine
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, ""));
    headers.forEach((h, i) => {
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

  for (let i = startLine; i < lines.length; i++) {
    const cols = lines[i]
      .split(",")
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    const name = cols[nameIdx];
    const countStr = cols[countIdx] || "";
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
      const res = await fetch("/stock-seed.json", { cache: "force-cache" });
      if (!res.ok) return {};
      const data = await res.json();
      if (!data || !data.map || typeof data.map !== "object") return {};
      stockSeedCache = data.map as StockMap;
      return stockSeedCache;
    } catch {
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

  const fetchStock = useCallback(async () => {
    try {
      // Fetch directly from Google Apps Script
      const { clientGetStockCsv } = await import("@/lib/client-sheet");
      const text = await clientGetStockCsv();
      if (text) {
        const newMap = parseCsv(text);
        setStockMap(newMap);
        // Cache for next page load (instant load)
        saveCachedStock(newMap);
        hasFetchedRef.current = true;
      }
      // SELF-HEALING: If fetch returned empty, keep current state (don't wipe)
    } catch {
      // SELF-HEALING: Network error — keep current state (don't clear)
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

  return { stockMap, loading, isRupture, isLowStock, getStockCount };
}
