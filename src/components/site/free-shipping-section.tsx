"use client";

import { Sparkles } from "lucide-react";
import { Product, formatPrice } from "@/lib/products";
import { ProductImage } from "./product-image";
import { FreeShippingBundle } from "@/hooks/use-free-shipping";

type SpecialOffersSectionProps = {
  bundle: FreeShippingBundle;
  products: Product[];
  onProductClick?: (product: Product) => void;
};

/**
 * Special Offers section — a beautiful product showcase.
 *
 * Originally "Free Shipping Section"; renamed to "عروض خاصة" (Special Offers).
 * The bundle's `shippingType` is still wired through `useFreeShipping` for
 * backward-compat with the admin panel, but this section no longer surfaces
 * it in the UI — it just shows a clean grid of products with a 🎁 badge.
 */
export function SpecialOffersSection({
  bundle,
  products,
  onProductClick,
}: SpecialOffersSectionProps) {
  // Get the products that are in the bundle
  const bundleProducts = products.filter((p) =>
    bundle.productIds.includes(p.id),
  );

  if (bundleProducts.length === 0) return null;

  return (
    <section
      id="special-offers"
      className="relative overflow-hidden px-4 py-10 sm:px-6 sm:py-14"
     
     
      style={{
        background:
          "linear-gradient(135deg, rgba(194, 91, 126, 0.08) 0%, rgba(255, 246, 235, 0.55) 35%, rgba(255, 255, 255, 0.85) 65%, rgba(201, 151, 74, 0.10) 100%)",
      }}
    >
      {/* Decorative ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(194, 91, 126, 0.45), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-0 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(201, 151, 74, 0.40), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-5xl">
        {/* Header */}
        <div className="fade-up mb-7 text-center">
          {/* Static gift icon (entrance fade-in only) */}
          <div className="fade-up mb-3 flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-magenta/40 bg-white text-3xl shadow-lg"
              style={{ boxShadow: "0 8px 24px -6px rgba(194, 91, 126, 0.40), 0 0 0 1px rgba(194, 91, 126, 0.15) inset" }}
              aria-hidden
            >
              🎁
            </div>
          </div>

          <div className="mb-2 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-neon-magenta" />
            <span className="font-arabic text-[11px] font-semibold uppercase tracking-[0.3em] text-neon-magenta">
              عرض خاص
            </span>
            <Sparkles className="h-4 w-4 text-neon-magenta" />
          </div>
          <h2 className="font-arabic text-3xl font-extrabold sm:text-4xl">
            <span className="text-blue-black-animated">عروض خاصة</span>
          </h2>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {bundleProducts.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onProductClick?.(p)}
              className="fade-up group relative flex flex-col overflow-hidden rounded-2xl border-2 border-neon-magenta/35 bg-white text-left transition-transform duration-300 hover:-translate-y-1 hover:border-neon-magenta/70 active:scale-[0.98]"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(194, 91, 126, 0.10), 0 8px 24px -8px rgba(194, 91, 126, 0.35), 0 0 28px -6px rgba(194, 91, 126, 0.25)",
                animationDelay: `${Math.min(i * 60, 350)}ms`,
              }}
             
             
            >
              {/* Animated glow ring (visible on hover) */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ boxShadow: "0 0 0 2px rgba(194, 91, 126, 0.45), 0 0 28px -2px rgba(194, 91, 126, 0.55)" }}
              />

              {/* 🎁 badge */}
              <span
                className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full border border-neon-magenta/60 bg-white px-2.5 py-1 font-arabic text-[10px] font-bold text-neon-magenta shadow-sm"
              >
                🎁
              </span>

              <div className="relative aspect-square w-full overflow-hidden bg-stone">
                <ProductImage src={p.image} alt={p.name} fit="contain" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="line-clamp-2 font-arabic text-sm font-bold leading-snug">
                  <span className="text-blue-black-animated">{p.name}</span>
                </h3>
                {p.oldPrice != null && (
                  <span className="font-arabic text-xs text-gray-light line-through">
                    {formatPrice(p.oldPrice)}
                  </span>
                )}
                <p className="font-arabic text-sm font-bold text-emerald">
                  {formatPrice(p.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Legacy export — kept for back-compat with any imports that still reference
 * `FreeShippingSection`. Forwards props to the new `SpecialOffersSection`.
 * @deprecated Use `SpecialOffersSection` instead.
 */
export const FreeShippingSection = SpecialOffersSection;
