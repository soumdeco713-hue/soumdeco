"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  Check,
  ShoppingBag,
  Sparkles,
  Truck,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  QuantityTier,
  formatPrice,
  getProductImages,
} from "@/lib/products";
import { ProductImage } from "./product-image";
import { CodOrderForm, OrderItem } from "./cod-order-form";
import { BRAND } from "@/lib/brand-config";

type ProductPageProps = {
  product: Product;
  onAddToCart: (item: {
    productId: string;
    name: string;
    price: number | null;
    image: string;
  }) => void;
  onBack: () => void;
  rupture?: boolean;
  relatedProducts?: Product[];
  onProductClick?: (product: Product) => void;
  /** Per-variant rupture check: (productName, variantName) → boolean */
  isVariantRupture?: (productName: string, variantName: string) => boolean;
};

export function ProductPage({
  product,
  onAddToCart,
  onBack,
  rupture,
  relatedProducts = [],
  onProductClick,
  isVariantRupture: isVariantRuptureFn,
}: ProductPageProps) {
  const images = getProductImages(product);
  const [activeIdx, setActiveIdx] = useState(0);
  const [added, setAdded] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedCustom, setSelectedCustom] = useState<Record<string, string>>({});
  const [selectedQty, setSelectedQty] = useState(1);

  useEffect(() => {
    setAdded(false);
    setActiveIdx(0);
    setSelectedColor("");
    setSelectedSize("");
    setSelectedCustom({});
    setSelectedQty(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [product?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const currentImage = images[activeIdx] || images[0] || "";
  const hasMultiple = images.length > 1;

  const go = (dir: number) => {
    if (!hasMultiple) return;
    setActiveIdx((i) => (i + dir + images.length) % images.length);
  };

  // Variants — split into colors, sizes, and custom types.
  const variants: ProductVariant[] = product.variants ?? [];
  const colorVariants = variants.filter((v) => v.type === "color");
  const sizeVariants = variants.filter((v) => v.type === "size");
  // Custom types (not color and not size) — up to 2
  const customTypes = Array.from(
    new Set(
      variants
        .map((v) => v.type)
        .filter((t) => t !== "color" && t !== "size" && t.trim() !== ""),
    ),
  );
  // Whether this product has ANY variants (used for obligatory selection check)
  const hasVariants = colorVariants.length > 0 || sizeVariants.length > 0 || customTypes.length > 0;

  // The selected color/size objects (for their price adjustments).
  const selectedColorVariant = colorVariants.find((v) => v.name === selectedColor);
  const selectedSizeVariant = sizeVariants.find((v) => v.name === selectedSize);

  // Custom variant selections — for price adjustments
  const selectedCustomVariants = customTypes.flatMap((ct) => {
    const sel = selectedCustom[ct];
    if (!sel) return [];
    const found = variants.find((v) => v.type === ct && v.name === sel);
    return found ? [found] : [];
  });

  // Total price adjustment = color adj + size adj + all custom adj.
  const variantAdjustment =
    (selectedColorVariant?.priceAdjustment ?? 0) +
    (selectedSizeVariant?.priceAdjustment ?? 0) +
    selectedCustomVariants.reduce((sum, v) => sum + (v.priceAdjustment ?? 0), 0);

  // Per-variant stock check: if the selected variant is out of stock,
  // show a message and disable add-to-cart.
  const isVariantRupture = isVariantRuptureFn ?? (() => false);
  const selectedVariantName =
    [selectedColor, selectedSize, ...customTypes.map((ct) => selectedCustom[ct])]
      .filter(Boolean)
      .join(" - ") || "";
  const isVariantOutOfStock = selectedVariantName
    ? isVariantRupture(product.name, selectedVariantName)
    : false;

  // Adjusted unit price — null stays null (price-on-request).
  const adjustedPrice =
    product.price === null ? null : product.price + variantAdjustment;

  // Quantity tiers — find the tier matching the currently-selected qty.
  const tiers = product.quantityTiers ?? [];
  const activeTier = useMemo(
    () => tiers.find((t) => t.qty === selectedQty) ?? null,
    [tiers, selectedQty],
  );

  const tierBenefitText = (tier: QuantityTier): string => {
    const qtyWord = "قطعة";
    const hasFree = tier.freeShipping && tier.freeShipping !== "none";
    const discount = tier.discountAmount ?? 0;
    const hasDiscount = discount > 0;
    const shippingLabel =
      tier.freeShipping === "both"
        ? "كلاهما"
        : tier.freeShipping === "desk"
        ? "المكتب"
        : tier.freeShipping === "home"
        ? "المنزل"
        : "";
    if (hasFree && hasDiscount) {
      return `🎉 توصيل مجاني (${shippingLabel}) + خصم ${discount} دج عند شراء ${tier.qty} ${qtyWord}!`;
    }
    if (hasFree) {
      return `🎉 توصيل مجاني (${shippingLabel}) عند شراء ${tier.qty} ${qtyWord}!`;
    }
    if (hasDiscount) {
      return `🎉 خصم ${discount} دج عند شراء ${tier.qty} ${qtyWord}!`;
    }
    return "";
  };

  const orderItems: OrderItem[] = [
    {
      name: product.name,
      price: adjustedPrice,
      quantity: selectedQty,
    },
  ];

  const handleAdd = () => {
    if (isVariantOutOfStock) return; // prevent adding out-of-stock variant

    // OBLIGATORY VARIANT CHECK: if the product has variants (colors, sizes, or custom),
    // the customer MUST select at least one option from EACH available variant type
    // before they can add to cart. This prevents orders without variant info.
    if (hasVariants) {
      // Check each variant type — if any has options but none selected, block
      const missingSelections: string[] = [];
      if (colorVariants.length > 0 && !selectedColor) {
        missingSelections.push("اللون");
      }
      if (sizeVariants.length > 0 && !selectedSize) {
        missingSelections.push("المقاس");
      }
      for (const ct of customTypes) {
        if (!selectedCustom[ct]) {
          missingSelections.push(ct);
        }
      }
      if (missingSelections.length > 0) {
        // Show toast with the missing variant name(s)
        import("sonner").then(({ toast }) => {
          if (missingSelections.length === 1) {
            toast.error(`الرجاء اختيار ${missingSelections[0]}`);
          } else {
            toast.error(`الرجاء اختيار: ${missingSelections.join("، ")}`);
          }
        });
        return; // block add-to-cart
      }
    }

    // Build variantKey so the cart can distinguish items with different
    // color/size/custom selections (prevents merging different variants into one line item)
    const allSelections = [
      selectedColor,
      selectedSize,
      ...customTypes.map((ct) => selectedCustom[ct]),
    ].filter(Boolean);
    const variantKey = allSelections.join("_") || undefined;
    onAddToCart({
      productId: product.id,
      name: variantSummary ? `${product.name} (${variantSummary})` : product.name,
      price: adjustedPrice,
      image: currentImage,
      variantKey,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Human-readable variant summary, e.g. "اللون: أحمر · المقاس: كبير · الوزن: 1كغ".
  // Empty when nothing is selected — keeps the order notes clean.
  const variantSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedColor) parts.push(`اللون: ${selectedColor}`);
    if (selectedSize) parts.push(`المقاس: ${selectedSize}`);
    for (const ct of customTypes) {
      const sel = selectedCustom[ct];
      if (sel) parts.push(`${ct}: ${sel}`);
    }
    return parts.join(" · ");
  }, [selectedColor, selectedSize, selectedCustom, customTypes]);

  return (
    <div
      className="page-enter min-h-screen"
     
     
    >
      {/* Top bar: back button */}
      <div className="sticky top-0 z-40 border-b border-clay/30 bg-night-soft/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-full border border-emerald/30 bg-night-soft/70 px-4 py-2 font-arabic text-sm font-medium text-charcoal shadow-lg backdrop-blur-sm transition-transform hover:translate-x-1 hover:bg-emerald/10 active:scale-95"
          >
            <ArrowRight className="h-4 w-4 text-emerald" />
            <span>العودة للمتجر</span>
          </button>
          <div className="flex items-center gap-2 font-arabic text-xs text-gray">
            <span>{BRAND.name}</span>
            <span className="text-emerald">/</span>
            <span className="text-charcoal">{product.category || "منتج"}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          {/* ============= GALLERY COLUMN ============= */}
          <div
            className="fade-up flex flex-col gap-3"
          >
            {/* Hero image */}
            <div
              className="relative aspect-square w-full overflow-hidden rounded-3xl border border-emerald/20 bg-night-soft/60 shadow-2xl backdrop-blur-sm sm:aspect-[4/5]"
              style={{
                boxShadow:
                  "0 20px 60px -20px rgba(107, 100, 87, 0.18), 0 0 0 1px rgba(42, 125, 91, 0.18), 0 0 80px -20px rgba(42, 125, 91, 0.35)",
              }}
            >
              {currentImage ? (
                <ProductImage
                  src={currentImage}
                  alt={product.name}
                  fit="contain"
                  priority
                  size="full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-arabic text-sm text-gray-light">
                  لا توجد صورة
                </div>
              )}

              {rupture && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/25 backdrop-blur-[3px]">
                  <span className="rounded-full bg-terracotta px-5 py-2 font-arabic text-sm font-semibold text-white shadow-md">
                    نفدت الكمية
                  </span>
                </div>
              )}

              {product.category && (
                <span className="absolute right-3 top-3 rounded-full border border-emerald/40 bg-night-soft/80 px-3 py-1 font-arabic text-[11px] font-medium text-emerald backdrop-blur-sm">
                  {product.category}
                </span>
              )}
              {product.badge && (
                <span
                  className="absolute left-3 top-3 rounded-full border border-neon-magenta/60 bg-neon-magenta/20 px-3 py-1 font-arabic text-[11px] font-bold text-neon-magenta backdrop-blur-sm"
                  style={{ boxShadow: "0 0 18px rgba(194, 91, 126, 0.30)" }}
                >
                  {product.badge}
                </span>
              )}

              {hasMultiple && (
                <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-night/65 px-3 py-1 font-arabic text-[11px] font-medium text-cream backdrop-blur-sm">
                  {activeIdx + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {hasMultiple && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-label={`الصورة ${i + 1}`}
                    className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 bg-night transition-all ${
                      i === activeIdx
                        ? "border-emerald shadow-[0_0_16px_rgba(42, 125, 91,0.6)]"
                        : "border-clay/40 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <ProductImage
                      src={img}
                      alt={`صورة ${i + 1}`}
                      fit="cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Trust badges */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-clay/30 bg-night-soft/50 p-3 text-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-1.5">
                <Truck className="h-5 w-5 text-emerald" />
                <span className="font-arabic text-[11px] font-medium text-gray">توصيل 58 ولاية</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 border-x border-clay/20">
                <CreditCard className="h-5 w-5 text-emerald" />
                <span className="font-arabic text-[11px] font-medium text-gray">الدفع عند الاستلام</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <ShieldCheck className="h-5 w-5 text-emerald" />
                <span className="font-arabic text-[11px] font-medium text-gray">منتج مضمون</span>
              </div>
            </div>
          </div>

          {/* ============= INFO COLUMN ============= */}
          <div
            className="fade-up flex flex-col gap-5"
          >
            {product.category && (
              <div className="flex items-center gap-2 font-arabic text-xs uppercase tracking-[0.25em] text-emerald">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{product.category}</span>
              </div>
            )}

            <h1 className="font-arabic text-3xl font-bold leading-tight sm:text-5xl">
              <span className="text-blue-black-animated">{product.name}</span>
            </h1>
            {product.badge && (
              <div className="mt-2">
                <span
                  className="inline-block rounded-full border border-neon-magenta/60 bg-neon-magenta/15 px-3 py-1 font-arabic text-xs font-bold text-neon-magenta"
                  style={{ boxShadow: "0 0 12px rgba(194, 91, 126, 0.25)" }}
                >
                  ⚡ {product.badge}
                </span>
              </div>
            )}

            <div className="flex items-baseline gap-3">
              {product.oldPrice != null && (
                <span className="font-arabic text-lg text-gray-light line-through">
                  {formatPrice(product.oldPrice)}
                </span>
              )}
              <p className="font-arabic text-4xl font-bold text-emerald neon-text-emerald">
                {formatPrice(adjustedPrice)}
              </p>
              {adjustedPrice === null && (
                <span className="font-arabic text-xs text-gray-light">
                  تواصل معنا لمعرفة السعر
                </span>
              )}
              {variantAdjustment !== 0 && adjustedPrice !== null && (
                <span className="font-arabic text-xs font-medium text-neon-magenta">
                  ({variantAdjustment > 0 ? "+" : ""}{variantAdjustment} دج)
                </span>
              )}
            </div>

            <div className="h-px w-full bg-gradient-to-l from-transparent via-emerald/40 to-transparent" />

            <div>
              <h2 className="mb-2 font-arabic text-sm font-semibold uppercase tracking-wide text-emerald">
                وصف المنتج
              </h2>
              <p className="font-arabic text-base leading-loose text-gray">
                {product.description}
              </p>
            </div>

            {/* Variants — colors + sizes (replaces the old generic variations UI).
                Each button reflects the variant's price adjustment next to its name. */}
            {(colorVariants.length > 0 || sizeVariants.length > 0 || customTypes.length > 0) && (
              <div className="space-y-4">
                <h2 className="font-arabic text-sm font-semibold uppercase tracking-wide text-emerald">
                  الخيارات المتاحة <span className="text-terracotta">*</span>
                </h2>
                {colorVariants.length > 0 && (
                  <div>
                    <label className="mb-2 block font-arabic text-sm font-medium text-charcoal">
                      اللون <span className="text-terracotta">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {colorVariants.map((c) => {
                        const isSelected = selectedColor === c.name;
                        const adj = c.priceAdjustment ?? 0;
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => setSelectedColor(isSelected ? "" : c.name)}
                            className={`rounded-lg border-2 px-4 py-2 font-arabic text-sm font-medium transition-all active:scale-95 ${
                              isSelected
                                ? "border-emerald bg-emerald/15 text-emerald"
                                : "border-clay/40 bg-night-soft/60 text-charcoal hover:border-emerald/40"
                            }`}
                          >
                            {c.name}
                            {adj !== 0 && (
                              <span className="ml-1 text-[10px] text-neon-magenta">
                                ({adj > 0 ? "+" : ""}{adj} دج)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {sizeVariants.length > 0 && (
                  <div>
                    <label className="mb-2 block font-arabic text-sm font-medium text-charcoal">
                      المقاس <span className="text-terracotta">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sizeVariants.map((s) => {
                        const isSelected = selectedSize === s.name;
                        const adj = s.priceAdjustment ?? 0;
                        return (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => setSelectedSize(isSelected ? "" : s.name)}
                            className={`rounded-lg border-2 px-4 py-2 font-arabic text-sm font-medium transition-all active:scale-95 ${
                              isSelected
                                ? "border-emerald bg-emerald/15 text-emerald"
                                : "border-clay/40 bg-night-soft/60 text-charcoal hover:border-emerald/40"
                            }`}
                          >
                            {s.name}
                            {adj !== 0 && (
                              <span className="ml-1 text-[10px] text-neon-magenta">
                                ({adj > 0 ? "+" : ""}{adj} دج)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Custom variable dropdowns — up to 2 custom types */}
                {customTypes.map((ct) => {
                  const ctVariants = variants.filter((v) => v.type === ct);
                  if (ctVariants.length === 0) return null;
                  return (
                    <div key={ct}>
                      <label className="mb-2 block font-arabic text-sm font-medium text-charcoal">
                        {ct} <span className="text-terracotta">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ctVariants.map((c) => {
                          const isSelected = selectedCustom[ct] === c.name;
                          const adj = c.priceAdjustment ?? 0;
                          // Check per-variant stock
                          const variantStockKey = `${product.name} - ${c.name}`;
                          const variantRupture = isVariantRupture(product.name, c.name);
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() =>
                                setSelectedCustom((prev) => ({
                                  ...prev,
                                  [ct]: isSelected ? "" : c.name,
                                }))
                              }
                              disabled={variantRupture}
                              className={`rounded-lg border-2 px-4 py-2 font-arabic text-sm font-medium transition-all active:scale-95 ${
                                isSelected
                                  ? "border-emerald bg-emerald/15 text-emerald"
                                  : "border-clay/40 bg-night-soft/60 text-charcoal hover:border-emerald/40"
                              } ${variantRupture ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                            >
                              {c.name}
                              {adj !== 0 && (
                                <span className="ml-1 text-[10px] text-neon-magenta">
                                  ({adj > 0 ? "+" : ""}{adj} دج)
                                </span>
                              )}
                              {variantRupture && (
                                <span className="ml-1 text-[10px] text-terracotta">
                                  (نفدت)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* Per-variant out-of-stock message */}
                {isVariantOutOfStock && (
                  <p className="font-arabic text-sm text-terracotta">
                    هذا الخيار غير متوفر حالياً. اختر خياراً آخر.
                  </p>
                )}
              </div>
            )}

            {/* Quantity selector — 4 buttons (1, 2, 3, 4). ALWAYS visible.
                The "✨ اخترني!" badge only appears on quantities that have a tier benefit
                (i.e. when admin has set tiers for this product). */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={rupture || isVariantOutOfStock}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-arabic text-base font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${
                added
                  ? "bg-emerald-bright text-night"
                  : "bg-emerald text-night hover:bg-emerald-bright"
              }`}
              style={{ boxShadow: added ? "0 0 30px rgba(92, 255, 217, 0.7)" : "0 0 20px rgba(42, 125, 91, 0.30)" }}
            >
              {added ? (
                <>
                  <Check className="h-5 w-5" strokeWidth={3} />
                  تمت الإضافة إلى السلة
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  أضف إلى السلة
                </>
              )}
            </button>

            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-clay/30" />
              <span className="font-arabic text-xs text-gray-light">
                أو اطلب مباشرة عبر النموذج
              </span>
              <div className="h-px flex-1 bg-clay/30" />
            </div>

            <CodOrderForm
              items={orderItems}
              rupture={rupture}
              onContinueShopping={onBack}
              extraNotes={variantSummary}
              quantityTiers={tiers}
            />
          </div>
        </div>

        {/* ============= RELATED PRODUCTS ============= */}
        {relatedProducts.length > 0 && (
          <section className="mt-20 sm:mt-24">
            <div className="fade-up mb-8 text-center">
              <h2 className="font-arabic text-2xl font-bold text-charcoal sm:text-3xl">
                <span className="text-blue-black-animated">منتجات قد تعجبك</span>
              </h2>
              <div className="mx-auto mt-3 h-[2px] w-16 rounded-full" style={{
                background: "linear-gradient(90deg, transparent, #2A7D5B, transparent)",
              }} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {relatedProducts.slice(0, 4).map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProductClick?.(p)}
                  className="fade-up group flex flex-col overflow-hidden rounded-2xl border border-clay/40 bg-night-soft/70 text-left backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:border-emerald/50 active:scale-[0.98]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-night">
                    <ProductImage src={p.image} alt={p.name} fit="contain" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="line-clamp-2 font-arabic text-sm font-medium leading-snug text-charcoal">
                      {p.name}
                    </h3>
                    <p
                      className={`font-arabic text-sm font-semibold ${
                        p.price === null ? "italic text-gray-light" : "text-emerald"
                      }`}
                    >
                      {formatPrice(p.price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
