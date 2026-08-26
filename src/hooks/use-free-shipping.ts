"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand-config";

export type FreeShippingBundle = {
  /** Product IDs included in the free shipping bundle */
  productIds: string[];
  /** Which shipping type is free: "desk", "home", or "both" */
  shippingType: "desk" | "home" | "both";
};

const STORAGE_KEY = BRAND.storage.freeShipping;

function loadBundle(): FreeShippingBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds : [],
      shippingType: parsed.shippingType === "desk" || parsed.shippingType === "home" || parsed.shippingType === "both" ? parsed.shippingType : "both",
    };
  } catch {
    return null;
  }
}

function saveBundle(bundle: FreeShippingBundle | null): void {
  if (typeof window === "undefined") return;
  try {
    if (bundle === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    }
  } catch {
    // ignore
  }
}

export function useFreeShipping() {
  const [bundle, setBundle] = useState<FreeShippingBundle | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const bundleRef = useRef<FreeShippingBundle | null>(null);

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  useEffect(() => {
    const loaded = loadBundle();
    setBundle(loaded);
    setHydrated(true);
  }, []);

  /** Save a bundle (or null to clear it) */
  const setFreeShippingBundle = useCallback((b: FreeShippingBundle | null) => {
    saveBundle(b);
    setBundle(b);
    bundleRef.current = b;
  }, []);

  /** Toggle a product in the bundle */
  const toggleProduct = useCallback((productId: string) => {
    const current = bundleRef.current;
    if (!current) return;
    const exists = current.productIds.includes(productId);
    const nextIds = exists
      ? current.productIds.filter((id) => id !== productId)
      : [...current.productIds, productId];
    const next = { ...current, productIds: nextIds };
    saveBundle(next);
    setBundle(next);
    bundleRef.current = next;
  }, []);

  /** Set the shipping type */
  const setShippingType = useCallback((type: "desk" | "home" | "both") => {
    const current = bundleRef.current;
    if (!current) return;
    const next = { ...current, shippingType: type };
    saveBundle(next);
    setBundle(next);
    bundleRef.current = next;
  }, []);

  /** Check if a product is in the free shipping bundle */
  const isInBundle = useCallback((productId: string): boolean => {
    if (!bundleRef.current) return false;
    return bundleRef.current.productIds.includes(productId);
  }, []);

  /** Clear the entire bundle (removes the section from the storefront) */
  const clearBundle = useCallback(() => {
    saveBundle(null);
    setBundle(null);
    bundleRef.current = null;
  }, []);

  return {
    bundle,
    hydrated,
    setFreeShippingBundle,
    toggleProduct,
    setShippingType,
    isInBundle,
    clearBundle,
  };
}
