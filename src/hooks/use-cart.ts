"use client";

import { useCallback, useEffect, useState } from "react";
import { CART_STORAGE_KEY } from "@/lib/products";

export type CartItem = {
  productId: string;
  name: string;
  price: number | null;
  image: string;
  quantity: number;
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
      const idx = current.findIndex((i) => i.productId === item.productId);
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
      persist(
        items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i,
        ),
      );
    },
    [items, persist],
  );

  const removeItem = useCallback(
    (productId: string) => {
      persist(items.filter((i) => i.productId !== productId));
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
