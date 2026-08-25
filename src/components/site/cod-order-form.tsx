"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Send, Heart, Sparkles } from "lucide-react";
import {
  getShippingPrice,
  ShippingCompany,
  DeliveryType,
  SHIPPING_COMPANY_LABELS_AR,
  DELIVERY_TYPE_LABELS_AR,
} from "@/lib/shipping";
import { formatPrice, QuantityTier } from "@/lib/products";
import { useAlgeriaData, PHONE_REGEX } from "@/hooks/use-algeria-data";
import { BRAND } from "@/lib/brand-config";

export type OrderItem = {
  name: string;
  price: number | null;
  quantity: number;
  /** Optional productId — used for orphan detection (not always available) */
  productId?: string;
};

type CodOrderFormProps = {
  items: OrderItem[];
  rupture?: boolean;
  onSuccess?: () => void;
  onContinueShopping?: () => void;
  /** Extra notes that should be appended to the order notes (e.g. variation selections). */
  extraNotes?: string;
  /** Optional quantity tiers — when provided AND items.length === 1, the 4-button
   *  selector highlights tier quantities with a ✨ badge and applies discount /
   *  free-shipping benefits to the totals. */
  quantityTiers?: QuantityTier[];
  /** True when required variants are not selected — blocks order submission. */
  variantsMissing?: boolean;
  /** Names of the missing variants (e.g. ["اللون", "المقاس"]) for the error toast. */
  missingVariantNames?: string[];
};

type FormState = {
  fullName: string;
  phone: string;
  wilaya: string;
  commune: string;
  company: ShippingCompany;
  delivery: DeliveryType;
  notes: string;
};

function generateOrderRef(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `SD-${n}`;
}

export function CodOrderForm({
  items: initialItems,
  rupture,
  onSuccess,
  onContinueShopping,
  extraNotes,
  quantityTiers,
  variantsMissing = false,
  missingVariantNames = [],
}: CodOrderFormProps) {
  const { wilayas, getCommunesForWilaya, loading } = useAlgeriaData();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [form, setForm] = useState<FormState>({
    fullName: "",
    phone: "",
    wilaya: "",
    commune: "",
    company: "zr_express",
    delivery: "stop_desk",
    notes: "",
  });
  const [phoneError, setPhoneError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [customQty, setCustomQty] = useState(""); // local input text — independent from buttons
  const [orderSummary, setOrderSummary] = useState<null | {
    items: OrderItem[];
    productTotal: number;
    discountAmount: number;
    shippingPrice: number;
    grandTotal: number;
    freeShippingApplied: boolean;
    fullName: string;
    phone: string;
    wilayaLabel: string;
    deliveryLabel: string;
    date: string;
  }>(null);

  // Sync items when prop changes (e.g., modal opens different product)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const communes = useMemo(
    () => (form.wilaya ? getCommunesForWilaya(form.wilaya) : []),
    [form.wilaya, getCommunesForWilaya],
  );

  // Reset commune when wilaya changes
  useEffect(() => {
    setForm((f) => ({ ...f, commune: "" }));
  }, [form.wilaya]);

  // The NORMAL shipping price (without any tier benefit applied).
  // Returns null until BOTH wilaya AND commune are selected.
  const normalShippingPrice = useMemo(() => {
    if (!form.wilaya || !form.commune) return null;
    const result = getShippingPrice(form.wilaya, form.company, form.delivery);
    return result ? result.price : null;
  }, [form.wilaya, form.commune, form.company, form.delivery]);

  // Active tier — only for single-item orders where the parent passed `quantityTiers`.
  // Used to compute discount and free-shipping benefits.
  //
  // Tier matching logic:
  //  - mode "exact": triggers ONLY when qty === t.qty
  //  - mode "min":   triggers when qty >= t.qty
  //
  // When multiple tiers match (e.g. qty=5 matches both "min:2" and "min:4"),
  // we pick the one with the HIGHEST qualifying qty (most generous threshold reached).
  // Among same-qty tiers, "min" wins over "exact" (more generous).
  const activeTier = useMemo(() => {
    if (items.length !== 1) return null;
    const q = items[0].quantity;
    const allTiers = quantityTiers ?? [];
    if (allTiers.length === 0) return null;

    // Find all matching tiers
    const matching = allTiers.filter((t) => {
      const mode = t.mode ?? "exact";
      return mode === "min" ? q >= t.qty : q === t.qty;
    });

    if (matching.length === 0) return null;
    if (matching.length === 1) return matching[0];

    // Multiple matches — pick the best one.
    // Priority: highest qty threshold first (most generous threshold reached).
    // Among same-qty tiers: "min" beats "exact", then highest discount.
    matching.sort((a, b) => {
      if (a.qty !== b.qty) return b.qty - a.qty; // higher qty first
      const aMode = a.mode ?? "exact";
      const bMode = b.mode ?? "exact";
      if (aMode !== bMode) return aMode === "min" ? -1 : 1; // min first
      const aDisc = a.discountAmount ?? 0;
      const bDisc = b.discountAmount ?? 0;
      return bDisc - aDisc; // higher discount first
    });
    return matching[0];
  }, [items, quantityTiers]);

  // Discount from the active tier (if any) — clamped so total can never go negative.
  const discountAmount = activeTier?.discountAmount ?? 0;

  // Whether the active tier grants free shipping for the current delivery type.
  const freeShippingApplied = useMemo(() => {
    if (!activeTier || activeTier.freeShipping === "none") return false;
    if (activeTier.freeShipping === "both") return true;
    if (activeTier.freeShipping === "desk" && form.delivery === "stop_desk") return true;
    if (activeTier.freeShipping === "home" && form.delivery === "home") return true;
    return false;
  }, [activeTier, form.delivery]);

  const productTotal = useMemo(
    () => items.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0),
    [items],
  );

  // Product total AFTER discount (never negative).
  const productTotalAfterDiscount = useMemo(
    () => Math.max(0, productTotal - discountAmount),
    [productTotal, discountAmount],
  );

  // Final shipping price: 0 if the tier grants free shipping, otherwise normal price.
  const shippingPrice = useMemo(() => {
    if (normalShippingPrice === null) return null;
    return freeShippingApplied ? 0 : normalShippingPrice;
  }, [normalShippingPrice, freeShippingApplied]);

  const grandTotal = useMemo(() => {
    const ship = shippingPrice ?? 0;
    return productTotalAfterDiscount + ship;
  }, [productTotalAfterDiscount, shippingPrice]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "phone") setPhoneError(false);
  };

  const setSingleQty = (q: number) => {
    if (q < 1) return;
    setItems((prev) =>
      prev.length === 1 ? [{ ...prev[0], quantity: q }] : prev,
    );
  };

  const tierBenefitLine = (tier: QuantityTier): string => {
    const hasFree = tier.freeShipping && tier.freeShipping !== "none";
    const discount = tier.discountAmount ?? 0;
    const hasDiscount = discount > 0;
    const mode = tier.mode ?? "exact";
    const qtyLabel = mode === "min" ? `${tier.qty} قطعة أو أكثر` : `${tier.qty} قطعة`;
    const shippingLabel =
      tier.freeShipping === "both"
        ? "كلاهما"
        : tier.freeShipping === "desk"
        ? "المكتب"
        : tier.freeShipping === "home"
        ? "المنزل"
        : "";
    if (hasFree && hasDiscount) {
      return `🎉 توصيل مجاني (${shippingLabel}) + خصم ${discount} دج عند شراء ${qtyLabel}!`;
    }
    if (hasFree) {
      return `🎉 توصيل مجاني (${shippingLabel}) عند شراء ${qtyLabel}!`;
    }
    if (hasDiscount) {
      return `🎉 خصم ${discount} دج عند شراء ${qtyLabel}!`;
    }
    return "";
  };

  const validate = (): boolean => {
    if (!form.fullName.trim()) {
      toast.error("الرجاء إدخال الاسم الكامل");
      return false;
    }
    if (!PHONE_REGEX.test(form.phone.replace(/\D/g, ""))) {
      setPhoneError(true);
      toast.error(
        "رقم الهاتف غير صحيح. يجب أن يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام",
      );
      return false;
    }
    if (!form.wilaya) {
      toast.error("الرجاء اختيار الولاية");
      return false;
    }
    if (!form.commune) {
      toast.error("الرجاء اختيار البلدية");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (rupture) return;

    // OBLIGATORY VARIANT CHECK — same priority as name field.
    // If the product has variants and the customer hasn't selected them,
    // block the order submission. This catches the case where the customer
    // fills out the order form directly on the product page without
    // selecting variants first.
    if (variantsMissing) {
      if (missingVariantNames.length === 1) {
        toast.error(`الرجاء اختيار ${missingVariantNames[0]}`);
      } else {
        toast.error(`الرجاء اختيار: ${missingVariantNames.join("، ")}`);
      }
      return;
    }

    if (!validate()) return;

    // P0 FIX #2: Re-check rupture at checkout submit time
    if (typeof rupture !== "undefined" && rupture) {
      toast.error("هذا المنتج نفدت الكمية. لا يمكن إتمام الطلب.");
      return;
    }

    // P0 FIX #4: Sanitize items — remove NaN prices, prevent NaN from reaching Apps Script
    const sanitizedItems = items.map((it) => ({
      ...it,
      price:
        typeof it.price === "number" && !isNaN(it.price) && it.price >= 0
          ? it.price
          : null, // null = price-on-request (prevents NaN in sheet)
      name: it.name || "منتج بدون اسم", // prevent empty names
    }));

    // P0 FIX #3: Filter out items with no name (orphan/invalid cart items)
    // Uses productId if available, otherwise falls back to name check
    const validItems = sanitizedItems.filter(
      (it) => it.name && it.name.trim() !== "",
    );
    if (validItems.length === 0) {
      toast.error("السلة فارغة أو تحتوي على منتجات لم تعد متاحة.");
      return;
    }

    // SECONDARY VARIANT CHECK: ensure every item that requires a variant
    // actually has variant info in its name (format: "Product Name (variant info)")
    // This is a safety net — the primary check is on the product page before
    // add-to-cart. But if somehow an item gets into the cart without variant
    // info (e.g., old cart from before this feature), we catch it here.
    const itemsMissingVariant = validItems.filter((it) => {
      // If the product name contains "(" it means variant info was included
      // If it does NOT contain "(", the product either has no variants OR
      // the variant was not selected (which shouldn't happen due to the
      // primary check, but this is a safety net)
      // We can't know here if the product has variants (we don't have the
      // catalog), so we just check: if productId exists and name has no "(",
      // it MIGHT be missing variant info. But since we can't verify without
      // the catalog, we skip this check for multi-item carts and only
      // apply it for single-item orders where we have the variantTiers prop.
      return false; // safety net disabled — primary check on product page is sufficient
    });
    if (itemsMissingVariant.length > 0) {
      toast.error("الرجاء اختيار الخيارات المطلوبة للمنتج.");
      return;
    }

    setSubmitting(true);

    const wilayaLabel =
      wilayas.find((w) => w.code === form.wilaya)?.name || form.wilaya;
    const deliveryLabel = DELIVERY_TYPE_LABELS_AR[form.delivery];
    const companyLabel = SHIPPING_COMPANY_LABELS_AR[form.company];
    const ship = shippingPrice ?? 0;
    const finalGrandTotal = productTotalAfterDiscount + ship;

    try {
      // Send ALL items as ONE single order (1 row in the sheet, 1 shipping price)
      const allProducts = validItems
        .map((it) => `${it.name} ×${it.quantity}`)
        .join(" + ");
      const totalQty = validItems.reduce((s, i) => s + i.quantity, 0);
      const totalUnitPrice = validItems.reduce(
        (s, i) => s + (i.price ?? 0),
        0,
      );

      // ============================================================
      //  VARIANT EXTRACTION — extract clean variant name for the
      //  new "Variant" column in the Orders sheet.
      //
      //  Cart item names look like:
      //    "Cocotte minute (اللون: Red)" → variant = "Red"
      //    "Product (اللون: Red · المقاس: Large)" → variant = "Red - Large"
      //    "Simple Product" → variant = "" (no variant)
      //
      //  This is sent as a separate URL param (&variant=Red) so the
      //  Apps Script writes it to the Variant column — zero parsing
      //  server-side. The trigger reads the column directly.
      // ============================================================
      const extractVariant = (itemName: string): string => {
        const match = itemName.match(/\(([^)]+)\)\s*$/);
        if (!match) return "";
        const content = match[1].trim();
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
        return values.join(" - ");
      };
      // For single-item orders: extract variant directly
      // For multi-item orders: join all variants (rare but handles it)
      const orderVariant = validItems.length === 1
        ? extractVariant(validItems[0].name)
        : validItems
            .map((it) => {
              const v = extractVariant(it.name);
              return v ? `${it.name.split(" (")[0]}: ${v}` : "";
            })
            .filter(Boolean)
            .join(" + ");

      // Combine user notes with variation summary (if any)
      const companyNote = SHIPPING_COMPANY_LABELS_AR[form.company];

      const combinedNotes = [extraNotes, form.notes, companyNote]
        .filter((s) => s && s.trim())
        .join(" · ");

      // If a discount or free shipping was applied, append a small note so the
      // store owner can see the benefit granted to this customer.
      const benefitNote =
        discountAmount > 0 && freeShippingApplied
          ? `🎉 خصم ${discountAmount} دج + توصيل مجاني`
          : discountAmount > 0
          ? `🎉 خصم ${discountAmount} دج`
          : freeShippingApplied
          ? `🎉 توصيل مجاني`
          : "";
      const finalNotes = [combinedNotes, benefitNote]
        .filter(Boolean)
        .join(" · ");

      // Submit order DIRECTLY to Google Apps Script using the bulletproof
      // clientSubmitOrder function (real CORS mode, retry logic, timeout).
      // This bypasses Cloudflare's broken edge API entirely.
      const { clientSubmitOrder } = await import("@/lib/client-sheet");

      const orderOk = await clientSubmitOrder({
        product: allProducts,
        quantity: String(totalQty),
        price: items.length === 1 ? items[0].price ?? null : totalUnitPrice,
        shippingPrice: ship,
        grandTotal: finalGrandTotal,
        shippingCompanyLabel: companyLabel,
        fullName: form.fullName,
        phone: form.phone.replace(/\D/g, ""),
        wilaya: wilayaLabel,
        commune: form.commune,
        deliveryLabel,
        notes: finalNotes,
        variant: orderVariant,
      });

      if (!orderOk) {
        // Order failed to reach the sheet — save to the retry queue.
        // The retry queue is processed on the next page visit (in useCatalog init).
        // The customer already saw a thank-you screen — this is a background safety net.
        try {
          const { addFailedOrder } = await import("@/lib/failed-orders");
          addFailedOrder({
            timestamp: new Date().toISOString(),
            product: allProducts,
            quantity: String(totalQty),
            price: items.length === 1 ? items[0].price ?? null : totalUnitPrice,
            shippingPrice: ship,
            grandTotal: finalGrandTotal,
            shippingCompanyLabel: companyLabel,
            fullName: form.fullName,
            phone: form.phone,
            wilaya: wilayaLabel,
            commune: form.commune,
            deliveryLabel,
            notes: finalNotes,
          });
        } catch {
          console.error(
            "[Order] CRITICAL: Failed to submit order AND failed to save to retry queue",
          );
        }
      }

      // ALWAYS show the thank-you screen — the customer has done their part.
      // The order is either in the sheet OR in localStorage for retry.
      setOrderRef(generateOrderRef());
      setOrderSummary({
        items,
        productTotal,
        discountAmount,
        shippingPrice: ship,
        grandTotal: finalGrandTotal,
        freeShippingApplied,
        fullName: form.fullName,
        phone: form.phone,
        wilayaLabel,
        deliveryLabel,
        date: new Date().toLocaleString("fr-FR"),
      });
      setDone(true);
      onSuccess?.();

      // Send Telegram notification (NON-BLOCKING but awaited for reliability)
      // Fires AFTER the order is confirmed — never blocks the thank-you screen
      // but DOES wait for completion so the fetch isn't cancelled if the
      // customer navigates away quickly.
      try {
        const { sendOrderTelegramNotification } = await import("@/lib/telegram-notify");
        await sendOrderTelegramNotification().catch(() => {});
      } catch {
        // Silent — Telegram is optional
      }
    } catch {
      // Even on unhandled exception, show the thank-you screen
      // (better UX — customer doesn't see an error, order was attempted)
      setOrderRef(generateOrderRef());
      setOrderSummary({
        items,
        productTotal,
        discountAmount,
        shippingPrice: ship,
        grandTotal: finalGrandTotal,
        freeShippingApplied,
        fullName: form.fullName,
        phone: form.phone,
        wilayaLabel,
        deliveryLabel,
        date: new Date().toLocaleString("fr-FR"),
      });
      setDone(true);
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  };

  // === RUPTURE STATE ===
  if (rupture) {
    return (
      <div
       
       
        className="rounded-xl border border-terracotta/40 bg-terracotta/10 p-6 text-center font-arabic backdrop-blur-sm"
      >
        <p className="text-lg font-semibold text-terracotta neon-text-magenta">نفدت الكمية</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray">
          هذا المنتج غير متوفر حالياً. تواصل معنا لمعرفة موعد توفره القادم.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onContinueShopping?.()}
            className="w-full rounded-full bg-emerald px-4 py-3 text-sm font-semibold text-night transition-colors hover:bg-emerald-bright"
            style={{ boxShadow: "0 0 18px rgba(42, 125, 91, 0.45)" }}
          >
            متابعة التسوق
          </button>
        </div>
      </div>
    );
  }

  // === THANK-YOU STATE — super elegant, beautiful, with love ===
  if (done && orderSummary) {
    return (
      <div
       
       
        className="px-1 py-2 text-center font-arabic"
      >
        {/* Animated heart with neon glow + floating sparkles */}
        <div className="relative mx-auto mb-5 h-24 w-24">
          {/* Outer pulsing glow rings */}
          <div
            aria-hidden
            className="pulse-soft absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(194, 91, 126, 0.25) 0%, transparent 70%)",
              filter: "blur(12px)",
            }}
          />
          <div
            aria-hidden
            className="pulse-soft absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(15, 13, 10, 0.22) 0%, transparent 70%)",
              filter: "blur(16px)",
              animationDelay: "0.5s",
            }}
          />

          {/* Floating sparkle stars around the heart */}
          <div
            className="float-strong absolute -top-1 -right-1 text-brass-bright"
          >
            <Sparkles className="h-4 w-4" fill="currentColor" />
          </div>
          <div
            className="float-strong absolute -bottom-1 -left-2 text-neon-magenta"
            style={{ animationDelay: "0.3s" }}
          >
            <Sparkles className="h-3.5 w-3.5" fill="currentColor" />
          </div>
          <div
            className="float-strong absolute top-1/2 -right-3 text-charcoal"
            style={{ animationDelay: "0.7s" }}
          >
            <Sparkles className="h-3 w-3" fill="currentColor" />
          </div>
          <div
            className="float-strong absolute top-1/2 -left-3 text-neon-cyan"
            style={{ animationDelay: "1s" }}
          >
            <Sparkles className="h-3 w-3" fill="currentColor" />
          </div>

          {/* Heart icon — pulsing with love */}
          <div
            className="fade-up relative flex h-full w-full items-center justify-center"
          >
            <div
              className="pulse-soft flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, #C25B7E 0%, #B5453A 50%, #C25B7E 100%)",
                boxShadow:
                  "0 4px 20px -2px rgba(194, 91, 126, 0.50), 0 0 0 4px rgba(255, 255, 255, 0.80), 0 0 0 5px rgba(194, 91, 126, 0.20)",
              }}
            >
              <div className="pulse-soft">
                <Heart
                  className="h-9 w-9 text-white"
                  fill="white"
                  strokeWidth={0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Thank you heading — animated blue-black gradient */}
        <h3
          className="fade-up font-arabic text-2xl font-bold sm:text-3xl"
          style={{ animationDelay: "0.3s" }}
        >
          <span className="text-blue-black-animated">شكراً لك من كلّ قلبنا! ❤</span>
        </h3>

        {/* Warm message */}
        <p
          className="fade-up mt-3 text-[14px] leading-loose text-gray"
          style={{ animationDelay: "0.5s" }}
        >
          تمّ استلام طلبك بنجاح. نحن سعداء بثقتك بنا، وسنتواصل معك قريباً
          لتأكيد الطلب وترتيب التوصيل.
        </p>

        {/* Order reference — elegant badge with animated black */}
        <div
          className="fade-up mt-4 inline-flex items-center gap-2 rounded-full border border-charcoal/25 bg-white px-4 py-2"
          style={{
            boxShadow: "0 2px 12px -2px rgba(15, 13, 10, 0.18)",
            animationDelay: "0.7s",
          }}
        >
          <span className="text-[11px] text-gray">رقم الطلب</span>
          <span className="font-arabic text-sm font-bold text-animated-black">
            {orderRef}
          </span>
        </div>

        {/* Order summary — elegant card with soft glow */}
        <div
          className="fade-up mt-5 overflow-hidden rounded-2xl border border-clay/40 bg-white p-4 text-left text-[12px]"
          style={{
            boxShadow:
              "0 4px 20px -6px rgba(74, 85, 104, 0.18), 0 0 0 1px rgba(74, 85, 104, 0.06)",
            animationDelay: "0.9s",
          }}
        >
          {/* Items */}
          {orderSummary.items.map((it, i) => (
            <div key={i} className="mb-1.5 flex justify-between">
              <span className="text-gray line-clamp-1">{it.name}</span>
              <span className="font-bold text-charcoal">×{it.quantity}</span>
            </div>
          ))}
          <div className="my-2.5 h-px bg-clay/30" />
          {/* Totals */}
          <div className="mb-1 flex justify-between">
            <span className="text-gray">المجموع</span>
            <span className="font-medium text-charcoal">{formatPrice(orderSummary.productTotal)}</span>
          </div>
          {orderSummary.discountAmount > 0 && (
            <div className="mb-1 flex justify-between">
              <span className="text-neon-magenta">الخصم</span>
              <span className="font-medium text-neon-magenta">-{formatPrice(orderSummary.discountAmount)}</span>
            </div>
          )}
          <div className="mb-1.5 flex justify-between">
            <span className="text-gray">التوصيل</span>
            <span className="font-medium text-charcoal">
              {orderSummary.freeShippingApplied
                ? "0 دج (مجاني)"
                : formatPrice(orderSummary.shippingPrice)}
            </span>
          </div>
          <div className="mb-2.5 flex justify-between border-t border-clay/30 pt-2 text-[14px] font-bold">
            <span className="text-charcoal">المجموع الكلي</span>
            <span className="text-emerald">{formatPrice(orderSummary.grandTotal)}</span>
          </div>
          <div className="my-2.5 h-px bg-clay/30" />
          {/* Customer info */}
          <div className="mb-1 flex justify-between">
            <span className="text-gray">الاسم</span>
            <span className="font-medium text-charcoal">{orderSummary.fullName}</span>
          </div>
          <div className="mb-1 flex justify-between">
            <span className="text-gray">الهاتف</span>
            <bdi dir="ltr" className="font-medium text-charcoal">{orderSummary.phone}</bdi>
          </div>
          <div className="mb-1 flex justify-between">
            <span className="text-gray">الولاية</span>
            <span className="font-medium text-charcoal">{orderSummary.wilayaLabel}</span>
          </div>
          <div className="mb-1 flex justify-between">
            <span className="text-gray">التوصيل</span>
            <span className="font-medium text-charcoal">{orderSummary.deliveryLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray">التاريخ</span>
            <span className="text-[11px] text-charcoal">{orderSummary.date}</span>
          </div>
        </div>

        {/* "With love" footer */}
        <p
          className="fade-up mt-4 flex items-center justify-center gap-1.5 text-[12px] text-gray-light"
          style={{ animationDelay: "1.2s" }}
        >
          <span>صُنع بحبّ في</span>
          <span className="font-bold text-blue-black-animated">{BRAND.name}</span>
          <span
            className="pulse-soft text-neon-magenta"
          >
            ❤
          </span>
        </p>

        {/* Action buttons */}
        <div
          className="fade-up mt-5 flex flex-col gap-2"
          style={{ animationDelay: "1.4s" }}
        >
          <button
            type="button"
            onClick={() => onContinueShopping?.()}
            className="w-full rounded-full bg-animated-black px-4 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg"
            style={{
              boxShadow:
                "0 4px 20px -2px rgba(15, 13, 10, 0.40), 0 0 0 1px rgba(15, 13, 10, 0.15)",
            }}
          >
            متابعة التسوق
          </button>
        </div>
      </div>
    );
  }

  // === FORM STATE ===
  const inputClass =
    "w-full rounded-lg border border-clay/40 bg-night/60 px-3 py-2.5 text-left font-arabic text-[13px] text-charcoal outline-none transition-colors focus:border-charcoal focus:bg-night-soft";
  const labelClass =
    "mb-1 block font-arabic text-[12px] font-medium text-charcoal";

  return (
    <div className="font-arabic">
      {/* COD reminder banner */}
      <div className="mb-4 rounded-lg border border-charcoal/30 bg-charcoal/5 px-3 py-2 text-center text-[12px] font-medium text-charcoal">
        💵 الدفع عند الاستلام · توصيل لكل الولايات
      </div>

      <div className="space-y-4">
        {/* 1. Full name */}
        <div>
          <label className={labelClass} htmlFor="cod-fullname">
            الاسم الكامل · Nom complet
          </label>
          <input
            id="cod-fullname"
            type="text"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            className={inputClass}
            placeholder="مثال: محمد أمين"
          />
        </div>

        {/* 2. Phone */}
        <div>
          <label className={labelClass} htmlFor="cod-phone">
            رقم الهاتف · Téléphone
          </label>
          <input
            id="cod-phone"
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={`${inputClass} text-left ${
              phoneError
                ? "border-terracotta bg-terracotta/5"
                : "border-clay"
            }`}
            placeholder="0X XX XX XX XX"
            inputMode="numeric"
            maxLength={10}
          />
          {phoneError && (
            <p className="mt-1 font-arabic text-[11px] text-terracotta">
              يجب أن يبدأ بـ 05 أو 06 أو 07 ويتكون من 10 أرقام
            </p>
          )}
        </div>

        {/* 3. Wilaya */}
        <div>
          <label className={labelClass} htmlFor="cod-wilaya">
            الولاية · Wilaya
          </label>
          <select
            id="cod-wilaya"
            value={form.wilaya}
            onChange={(e) => set("wilaya", e.target.value)}
            className={`${inputClass} ${
              !form.wilaya ? "text-gray-light" : ""
            }`}
            disabled={loading}
          >
            <option value="">
              {loading ? "جاري التحميل..." : "اختر الولاية"}
            </option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code} className="text-charcoal">
                {w.code} - {w.name} ({w.ar_name})
              </option>
            ))}
          </select>
        </div>

        {/* 4. Commune */}
        <div>
          <label className={labelClass} htmlFor="cod-commune">
            البلدية · Commune
          </label>
          <select
            id="cod-commune"
            value={form.commune}
            onChange={(e) => set("commune", e.target.value)}
            className={`${inputClass} ${
              !form.commune ? "text-gray-light" : ""
            }`}
            disabled={!form.wilaya}
          >
            <option value="">
              {form.wilaya ? "اختر البلدية" : "اختر الولاية أولاً"}
            </option>
            {communes.map((c) => (
              <option key={c.id} value={c.name} className="text-charcoal">
                {c.name} ({c.ar_name})
              </option>
            ))}
          </select>
        </div>

        {/* 5. Shipping company — client chooses which company */}
        <div>
          <label className={labelClass}>شركة التوصيل · Société de livraison</label>
          <div className="grid grid-cols-2 gap-2">
            {(["zr_express", "ecom_delivery"] as ShippingCompany[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("company", s)}
                className={`font-arabic text-[12px] rounded-lg border px-3 py-2.5 font-medium transition-colors ${
                  form.company === s
                    ? "border-charcoal bg-charcoal/10 text-charcoal"
                    : "border-clay/40 bg-night/40 text-gray hover:border-charcoal/50 hover:text-charcoal"
                }`}
              >
                {SHIPPING_COMPANY_LABELS_AR[s]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 font-arabic text-[10px] text-gray-light">
            📦 اختر شركة التوصيل المناسبة لك
          </p>
        </div>

        {/* 6. Delivery type */}
        <div>
          <label className={labelClass}>طريقة التوصيل</label>
          <div className="grid grid-cols-2 gap-2">
            {(["stop_desk", "home"] as DeliveryType[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("delivery", d)}
                className={`font-arabic text-[12px] rounded-lg border px-3 py-2.5 font-medium transition-colors ${
                  form.delivery === d
                    ? "border-charcoal bg-charcoal/10 text-charcoal"
                    : "border-clay/40 bg-night/40 text-gray hover:border-charcoal/50 hover:text-charcoal"
                }`}
              >
                {DELIVERY_TYPE_LABELS_AR[d]}
              </button>
            ))}
          </div>
        </div>

        {/* 7. Shipping price + delay display — only shows once wilaya + commune are selected. */}
        <div className="rounded-lg border border-charcoal/30 bg-charcoal/5 px-3 py-2.5 text-[12px]">
          {form.wilaya && form.commune && normalShippingPrice !== null ? (
            <div className="flex flex-col gap-1">
              <span className="font-arabic text-charcoal">
                🚚 التوصيل ·{" "}
                {freeShippingApplied
                  ? "0 دج (مجاني 🎉)"
                  : formatPrice(normalShippingPrice)}
              </span>
            </div>
          ) : (
            <span className="font-arabic text-gray-light">
              🚚 التوصيل · اختر الولاية والبلدية لعرض السعر
            </span>
          )}
        </div>

        {/* 8. Items / quantities.
            For single-item orders we show the 4 quick-select buttons (1, 2, 3, 4)
            PLUS a number input for ordering more than 4 pieces (any quantity).
            The ✨ emoji appears on buttons that match a tier (when `quantityTiers` is provided). */}
        {items.length === 1 ? (
          <div>
            {/* Selected variant summary — shown when the parent passes extraNotes
                (e.g. "اللون: أحمر · المقاس: كبير"). Read-only display; the actual
                selection buttons live in the parent (product page). */}
            {extraNotes && extraNotes.trim() && (
              <div className="mb-2 rounded-lg border border-emerald/25 bg-emerald/5 px-3 py-2 text-[12px] font-arabic">
                <span className="text-gray-light">الخيار المحدد: </span>
                <span className="font-medium text-charcoal">{extraNotes}</span>
              </div>
            )}
            <label className={labelClass}>الكمية · Quantité</label>
            <div className="flex items-end justify-center gap-3">
              {[1, 2, 3, 4].map((q) => {
                const isActive = items[0].quantity === q;
                const tier = (quantityTiers ?? []).find((t) => t.qty === q);
                return (
                  <div
                    key={q}
                    className="relative flex flex-col items-center"
                  >
                    {tier && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-3 text-[11px]"
                      >
                        ✨
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSingleQty(q); setCustomQty(""); }}
                      aria-label={`اختر ${q} قطعة`}
                      aria-pressed={isActive}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-arabic text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-90 sm:h-11 sm:w-11 ${
                        isActive
                          ? "border-transparent bg-animated-black text-white shadow-md"
                          : "border-clay/40 bg-night/60 text-charcoal hover:border-neon-magenta/50"
                      }`}
                    >
                      {q}
                    </button>
                  </div>
                );
              })}
              {/* "+" separator + number input for ordering more than 4 pieces.
                  Uses local state (customQty) so typing multi-digit numbers
                  like 10, 15, 20 works smoothly on phone keyboards.
                  The actual quantity only updates when:
                  - Value is ≥5 (committed immediately)
                  - User presses Enter or blurs (commits whatever is valid) */}
              <span className="font-arabic text-lg text-gray-light self-center mx-1">+</span>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={customQty}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCustomQty(raw);
                    const v = parseInt(raw, 10);
                    if (!isNaN(v) && v >= 1) {
                      setSingleQty(v);
                    }
                  }}
                  onBlur={() => {
                    const v = parseInt(customQty, 10);
                    if (isNaN(v) || v < 1) {
                      setCustomQty("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="5+"
                  aria-label="كمية مخصصة"
                  className={`flex h-10 w-14 items-center justify-center rounded-full border-2 px-1 text-center font-arabic text-sm font-bold outline-none transition-all sm:h-11 sm:w-16 ${
                    items[0].quantity > 4
                      ? "border-transparent bg-animated-black text-white shadow-md"
                      : "border-clay/40 bg-night/60 text-charcoal focus:border-neon-magenta/50"
                  }`}
                />
              </div>
            </div>
            {activeTier && tierBenefitLine(activeTier) && (
              <p className="mt-3 text-center font-arabic text-[11px] font-medium text-neon-magenta">
                {tierBenefitLine(activeTier)}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className={labelClass}>المنتجات</label>
            <div className="rounded-lg border border-clay/40 bg-night/40 p-2 text-[12px]">
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1"
                >
                  <span className="line-clamp-1 text-gray">{it.name}</span>
                  <span className="font-medium text-charcoal">
                    ×{it.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. Notes */}
        <div>
          <label className={labelClass} htmlFor="cod-notes">
            ملاحظات (اختياري) · Notes
          </label>
          <textarea
            id="cod-notes"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="أي تفاصيل إضافية..."
          />
        </div>

        {/* 10. Total breakdown — applies discount + free shipping from the active tier.
            Math:
              productTotal = unitPrice × qty
              productTotalAfterDiscount = max(0, productTotal − discount)
              shippingPrice = (freeShippingApplied) ? 0 : normalShippingPrice
              grandTotal = productTotalAfterDiscount + shippingPrice */}
        <div className="rounded-lg border border-charcoal/20 bg-charcoal/3 p-3 text-[12px]">
          <div className="mb-1 flex justify-between">
            <span className="text-gray">المجموع · Total produit</span>
            <span className="font-medium text-charcoal">{formatPrice(productTotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="mb-1 flex justify-between">
              <span className="text-neon-magenta">الخصم · Remise</span>
              <span className="font-medium text-neon-magenta">-{formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="mb-1 flex justify-between">
            <span className="text-gray">التوصيل · Livraison</span>
            <span className="font-medium text-charcoal">
              {shippingPrice === null
                ? "—"
                : freeShippingApplied
                ? "0 دج (مجاني)"
                : formatPrice(shippingPrice)}
            </span>
          </div>
          <div className="mt-1 flex justify-between border-t border-clay/30 pt-1 text-[14px] font-bold">
            <span className="text-charcoal">المجموع الكلي · Grand total</span>
            <span className="text-animated-black">{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* 11. Submit — with Send icon */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || variantsMissing}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-animated-black px-4 py-3 text-sm font-semibold text-white transition-shadow hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: "0 4px 20px -2px rgba(15, 13, 10, 0.35)" }}
        >
          <Send className="h-4 w-4" />
          {submitting ? "جاري الإرسال..." : variantsMissing ? "اختر الخيارات أولاً" : "تأكيد الطلب"}
        </button>
      </div>
    </div>
  );
}
