"use client";

import { ShoppingBag, X, Plus, Minus, Trash2 } from "lucide-react";
import { CartItem } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/products";
import { ProductImage } from "./product-image";

type CartBarProps = {
  count: number;
  onOpen: () => void;
};

export function CartBarButton({ count, onOpen }: CartBarProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="فتح السلة"
      className="relative flex items-center gap-1.5 rounded-full border border-emerald/30 bg-night-soft/70 px-4 py-2.5 font-arabic text-base font-medium text-charcoal shadow-lg backdrop-blur-md transition-colors hover:border-emerald hover:bg-emerald/10 focus:outline-none focus:ring-2 focus:ring-emerald/50 active:scale-95"
     
    >
      <ShoppingBag className="h-5 w-5 text-emerald" />
      <span>السلة</span>
      {count > 0 && (
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald px-1.5 font-arabic text-xs font-bold text-night transition-transform"
          style={{ boxShadow: "0 0 12px rgba(42, 125, 91, 0.35)" }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type CartDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onItemClick: (productId: string) => void;
  onCheckout: () => void;
};

export function CartDrawer({
  open,
  onOpenChange,
  items,
  onUpdateQuantity,
  onRemove,
  onItemClick,
  onCheckout,
}: CartDrawerProps) {
  // Compute cart total — guard against NaN/undefined prices (from malformed localStorage)
  const total = items.reduce((sum, i) => {
    const price = typeof i.price === "number" && !isNaN(i.price) ? i.price : 0;
    return sum + price * i.quantity;
  }, 0);
  // Check if any item has no price (price-on-request) — show "السعر عند الطلب" instead of total
  const hasPricedItems = items.some(
    (i) => typeof i.price === "number" && !isNaN(i.price),
  );
  const hasUnpricedItems = items.some(
    (i) => !(typeof i.price === "number" && !isNaN(i.price)),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay — fade in via CSS animation */}
      <div
        onClick={() => onOpenChange(false)}
        className="drawer-overlay absolute inset-0 bg-night/70 backdrop-blur-sm"
      />
      {/* Drawer panel — slide in from the right (LTR) via CSS animation */}
      <div
        className="drawer-panel-right drawer-slide absolute right-0 top-0 flex h-full w-[340px] max-w-[90vw] flex-col border-l border-emerald/20 bg-night-soft/95 shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-label="السلة"
      >
        <div className="flex items-center justify-between border-b border-clay/30 px-4 py-5">
          <h2 className="font-arabic text-xl font-bold text-charcoal">
            السلة
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray transition-colors hover:bg-night hover:text-emerald"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingBag className="h-12 w-12 text-clay" />
            <p className="font-arabic text-sm text-gray">سلتك فارغة</p>
          </div>
        ) : (
          <>
            <div className="scroll-area flex-1 overflow-y-auto p-3">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantKey || ""}`}
                  className="mb-3 flex gap-3 rounded-xl border border-clay/30 bg-night/60 p-2 backdrop-blur-sm"
                >
                  <button
                    type="button"
                    onClick={() => onItemClick(item.productId)}
                    className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-night"
                  >
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      fit="contain"
                    />
                  </button>
                  <div className="flex flex-1 flex-col">
                    <button
                      type="button"
                      onClick={() => onItemClick(item.productId)}
                      className="line-clamp-2 text-left font-arabic text-sm font-medium text-charcoal hover:text-emerald"
                    >
                      {item.name}
                    </button>
                    <p className="mt-0.5 font-arabic text-sm font-semibold text-emerald">
                      {formatPrice(item.price)}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateQuantity(
                              item.productId,
                              item.quantity - 1,
                            )
                          }
                          aria-label="إنقاص"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-clay/40 text-charcoal transition-colors hover:bg-emerald/10 hover:border-emerald"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center font-arabic text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateQuantity(
                              item.productId,
                              item.quantity + 1,
                            )
                          }
                          aria-label="زيادة"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-clay/40 text-charcoal transition-colors hover:bg-emerald/10 hover:border-emerald"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.productId)}
                        aria-label="حذف"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-terracotta transition-colors hover:bg-terracotta/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-clay/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-arabic text-sm text-gray">المجموع</span>
                <span className="font-arabic text-xl font-bold text-emerald neon-text-emerald">
                  {hasPricedItems && !hasUnpricedItems
                    ? formatPrice(total)
                    : hasPricedItems && hasUnpricedItems
                    ? `${formatPrice(total)} + سعر عند الطلب`
                    : "السعر عند الطلب"}
                </span>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                className="w-full rounded-full bg-emerald px-4 py-3 text-center font-arabic text-sm font-bold text-night transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ boxShadow: "0 0 20px rgba(42, 125, 91, 0.30)" }}
              >
                إتمام الطلب
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
