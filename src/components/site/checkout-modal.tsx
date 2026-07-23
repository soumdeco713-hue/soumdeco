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
};

export function CheckoutModal({
  open,
  items,
  onClose,
  onOrderSuccess,
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

  const orderItems: OrderItem[] = items.map((i) => ({
    name: i.name,
    price: i.price,
    quantity: i.quantity,
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
      dir="rtl"
    >
      <div
        onClick={handleClose}
        className="modal-overlay fixed inset-0 bg-night/80 backdrop-blur-sm"
      />
      <div
        className="modal-panel modal-slide-up relative z-10 my-4 w-full max-w-lg overflow-hidden rounded-3xl border border-emerald/25 bg-night-soft/95 shadow-2xl backdrop-blur-xl"
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
          <CodOrderForm
            items={orderItems}
            onSuccess={handleSuccess}
            onContinueShopping={handleClose}
          />
        </div>
      </div>
    </div>
  );
}
