"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CartItem } from "@/hooks/use-cart";
import { CodOrderForm, OrderItem } from "./cod-order-form";

type CheckoutModalProps = {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onOrderSuccess: () => void;
  /** Per-variant rupture check: (productName, variantName) → boolean.
   *  Used to block checkout when a cart item's variant is out of stock. */
  isVariantRupture?: (productName: string, variantName: string) => boolean;
};

export function CheckoutModal({
  open,
  items,
  onClose,
  onOrderSuccess,
  isVariantRupture,
}: CheckoutModalProps) {
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // ============================================================
  //  CART OUT-OF-STOCK CHECK
  //  For each cart item, extract variant info from the name (if any)
  //  and check if that variant is out of stock. If ANY item's variant
  //  is out of stock, block the entire checkout.
  //
  //  This catches the scenario where:
  //    1. Customer adds "Cocotte (المقاس: 06L)" to cart
  //    2. Another customer confirms an order → 06L auto-decrements to 0
  //    3. First customer opens checkout → we detect 06L is now out of stock
  //    4. Block + show which item is unavailable
  // ============================================================
  const itemsWithRupture = items.map((i) => {
    // Extract variant name from item name (format: "Product (variant info)")
    const variantMatch = i.name.match(/\(([^)]+)\)\s*$/);
    let variantName = "";
    if (variantMatch) {
      const content = variantMatch[1].trim();
      const parts = content.split("·");
      const values: string[] = [];
      for (const part of parts) {
        const trimmed = part.trim();
        const colonIdx = trimmed.lastIndexOf(":");
        if (colonIdx >= 0) {
          const value = trimmed.substring(colonIdx + 1).trim();
          if (value) values.push(value);
        } else if (trimmed) {
          values.push(trimmed);
        }
      }
      variantName = values.join(" - ");
    }
    // Extract bare product name (without variant parentheses)
    const bareName = i.name.replace(/\s*\([^)]+\)\s*$/, "").trim();
    const isRupture =
      variantName && isVariantRupture
        ? isVariantRupture(bareName, variantName)
        : false;
    return { item: i, variantName, isRupture };
  });

  const hasRuptureItem = itemsWithRupture.some((r) => r.isRupture);
  const ruptureItems = itemsWithRupture.filter((r) => r.isRupture);

  const orderItems: OrderItem[] = items.map((i) => ({
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    productId: i.productId,
  }));

  const handleSuccess = () => {
    onOrderSuccess();
    setCleared(true);
  };

  const handleClose = () => {
    setCleared(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="إتمام الطلب"
    >
      <div
        onClick={handleClose}
        className="modal-overlay fixed inset-0 bg-night/80 backdrop-blur-sm"
      />
      <div
        className="modal-panel modal-slide-up relative z-10 my-4 w-full max-w-lg overflow-hidden rounded-3xl border border-emerald/25 bg-night-soft/95 shadow-2xl backdrop-blur-sm"
        style={{
          boxShadow:
            "0 24px 80px -12px rgba(107, 100, 87, 0.18), 0 0 0 1px rgba(42, 125, 91, 0.2), 0 0 60px -10px rgba(42, 125, 91, 0.35)",
        }}
      >
        <div className="flex items-center justify-between border-b border-clay/30 px-5 py-4">
          <h2 className="font-arabic text-xl font-bold text-charcoal">
            {cleared ? "تم الطلب" : "إتمام الطلب"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray transition-colors hover:bg-emerald/10 hover:text-emerald"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {/* OUT-OF-STOCK CART ITEMS WARNING */}
          {hasRuptureItem && (
            <div className="mb-4 rounded-xl border border-terracotta/40 bg-terracotta/10 px-4 py-3">
              <p className="font-arabic text-sm font-semibold text-terracotta">
                بعض المنتجات في السلة لم تعد متوفرة:
              </p>
              <ul className="mt-2 space-y-1">
                {ruptureItems.map((r, idx) => (
                  <li key={idx} className="font-arabic text-xs text-terracotta">
                    • {r.item.name} {r.variantName && `(${r.variantName})`}
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-arabic text-xs text-gray-light">
                الرجاء حذف هذه المنتجات من السلة لإتمام الطلب.
              </p>
            </div>
          )}

          <CodOrderForm
            items={orderItems}
            onSuccess={handleSuccess}
            onContinueShopping={handleClose}
            rupture={hasRuptureItem}
          />
        </div>
      </div>
    </div>
  );
}
