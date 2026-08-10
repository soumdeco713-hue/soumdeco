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
        if (Array.isArray(parsed)) {
          // SELF-HEALING: Validate + sanitize cart items
          // Removes corrupted items (missing required fields, invalid quantity)
          const sanitized = parsed
            .filter(
              (item) =>
                item &&
                typeof item === "object" &&
                typeof item.productId === "string" &&
                item.productId.trim() !== "" &&
                typeof item.name === "string" &&
                typeof item.quantity === "number" &&
                item.quantity > 0 &&
                item.quantity < 1000, // sanity check
            )
            .map((item) => ({
              productId: String(item.productId),
              name: String(item.name),
              price:
                typeof item.price === "number" && !isNaN(item.price)
                  ? item.price
                  : null,
              image: typeof item.image === "string" ? item.image : "",
              quantity: Math.min(99, Math.max(1, Math.floor(item.quantity))),
              variantKey:
                typeof item.variantKey === "string" ? item.variantKey : undefined,
            }));
          if (sanitized.length !== parsed.length) {
            console.warn(
              `[Cart] Self-healing: removed ${parsed.length - sanitized.length} corrupted item(s)`,
            );
          }
          setItems(sanitized);
          // Re-save the sanitized version
          try {
            window.localStorage.setItem(
              CART_STORAGE_KEY,
              JSON.stringify(sanitized),
            );
          } catch {}
        }
      }
    } catch {
      // Corrupted JSON — clear it and start fresh
      console.warn("[Cart] Self-healing: corrupted localStorage, clearing cart");
      try {
        window.localStorage.removeItem(CART_STORAGE_KEY);
      } catch {}
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
      // G5 FIX: Wrap in try/catch — corrupted localStorage shouldn't crash the click handler
      let current: CartItem[] = [];
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY) || "[]";
        current = JSON.parse(raw);
        if (!Array.isArray(current)) current = [];
      } catch {
        current = []; // corrupted — start fresh
      }
      // Match by productId AND variantKey (if provided)
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
    (productId: string, quantity: number, variantKey?: string) => {
      const vk = variantKey || "";
      if (quantity <= 0) {
        // Remove the item entirely (matching productId + variantKey)
        persist(items.filter((i) => !(i.productId === productId && (i.variantKey || "") === vk)));
        return;
      }
      // Update the item matching BOTH productId AND variantKey
      let updated = false;
      persist(
        items.map((i) => {
          if (
            i.productId === productId &&
            (i.variantKey || "") === vk &&
            !updated
          ) {
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
    (productId: string, variantKey?: string) => {
      const vk = variantKey || "";
      // Remove the item matching BOTH productId AND variantKey
      persist(items.filter((i) => !(i.productId === productId && (i.variantKey || "") === vk)));
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
