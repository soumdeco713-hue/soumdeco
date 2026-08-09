"use client";

import { useCallback, useEffect, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/products";

export type CartItem = {
  productId: string;
  name: string;
  price: number | null;
  image: string;
  quantity: number;
  /** Variant info (e.g. "أحمر / كبير") — if set, items with same productId
   *  but different variantKey are treated as separate line items. */
  variantKey?: string;
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const addToCart = useCallback(
    (item: Omit<CartItem, "quantity">, quantity: number = 1) => {
      const current: CartItem[] = JSON.parse(
        window.localStorage.getItem(CART_STORAGE_KEY) || "[]",
      );
      // Match by productId AND variantKey (if provided)
      // This ensures different colors/sizes of the same product are separate line items
      const variantKey = item.variantKey || "";
      const idx = current.findIndex(
        (i) => i.productId === item.productId && (i.variantKey || "") === variantKey,
      );
      let next: CartItem[];
      if (idx >= 0) {
        next = [...current];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + quantity,
        };
      } else {
        next = [...current, { ...item, quantity }];
      }
      persist(next);
    },
    [persist],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        persist(items.filter((i) => i.productId !== productId));
        return;
      }
      // Only update the first matching item (variantKey is embedded in productId for UI)
      let updated = false;
      persist(
        items.map((i) => {
          if (i.productId === productId && !updated) {
            updated = true;
            return { ...i, quantity };
          }
          return i;
        }),
      );
    },
    [items, persist],
  );

  const removeItem = useCallback(
    (productId: string) => {
      // Remove only the first matching item
      let removed = false;
      persist(
        items.filter((i) => {
          if (i.productId === productId && !removed) {
            removed = true;
            return false;
          }
          return true;
        }),
      );
    },
    [items, persist],
  );

  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    items,
    hydrated,
    count,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
