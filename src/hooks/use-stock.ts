"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Stock counts from Google Sheet CSV (Stock tab)
// CSV format: product_name, stock_count (number)
export type StockMap = Record<string, number>;

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

// Polling intervals — optimized for 800K visits/month to stay under
// Apps Script's 20K-30K exec/day Consumer Gmail quota.
const POLL_MS = 1_800_000; // 30 minutes when tab is visible
const HIDDEN_POLL_MS = 3_600_000; // 1 hour when tab is hidden

export function useStock() {
  const [stockMap, setStockMap] = useState<StockMap>({});
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  // Pre-normalized lookup map — O(1) lookups instead of O(n×m) linear scans.
  // Built once whenever stockMap changes, then reused by isRupture/isLowStock.
  // Key = normalized product name, Value = stock count
  const [normalizedMap, setNormalizedMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const key of Object.keys(stockMap)) {
      next[normalizeName(key)] = stockMap[key];
    }
    setNormalizedMap(next);
  }, [stockMap]);

  const fetchStock = useCallback(async () => {
    try {
      // Fetch directly from Google Apps Script (bypasses broken edge API)
      const { clientGetStockCsv } = await import("@/lib/client-sheet");
      const text = await clientGetStockCsv();
      if (text) {
        setStockMap(parseCsv(text));
      }
    } catch {
      // keep current state
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
    fetchStock();
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
      // O(1) lookup in the pre-normalized map
      return normalized in normalizedMap && normalizedMap[normalized] === 0;
    },
    [normalizedMap],
  );

  /** Returns the stock count for a product, or null if not in the Stock tab (unlimited) */
  const getStockCount = useCallback(
    (productName: string): number | null => {
      if (!productName) return null;
      const normalized = normalizeName(productName);
      // O(1) lookup in the pre-normalized map
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
