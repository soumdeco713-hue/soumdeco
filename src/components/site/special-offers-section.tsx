"use client";

import { Product, formatPrice } from "@/lib/products";
import { ProductImage } from "./product-image";

type SpecialOffersSectionProps = {
  products: Product[];
  onProductClick?: (product: Product) => void;
  isRupture?: (product: Product) => boolean;
};

/**
 * Special Offers section — a simple CSS-only grid of products where
 * `isSpecialOffer === true`. Renders nothing if there are no such products.
 *
 * The section is shown on the home page between the featured carousel and
 * the categories section. Each card uses the same style as the all-products
 * grid but with a magenta accent border and a 🎁 badge.
 */
export function SpecialOffersSection({
  products,
  onProductClick,
  isRupture,
}: SpecialOffersSectionProps) {
  // Filter to only products flagged as special offers
  const offerProducts = products.filter((p) => p.isSpecialOffer === true);

  // Don't render the section at all if no products qualify
  if (offerProducts.length === 0) return null;

  return (
    <section
      id="special-offers"
      className="px-4 py-8 sm:px-6 sm:py-10"
      aria-label="عروض خاصة"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="fade-up mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="text-neon-magenta text-sm">🎁</span>
            <span className="font-arabic text-[11px] font-semibold uppercase tracking-[0.3em] text-neon-magenta">
              عروض
            </span>
            <span className="text-neon-magenta text-sm">🎁</span>
          </div>
          <h2 className="font-arabic text-3xl font-bold sm:text-4xl">
            <span className="text-blue-black">عروض خاصة</span>
          </h2>
          <div
            className="mx-auto mt-3 h-[2px] w-20 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, #C25B7E, #C25B7E, transparent)",
            }}
          />
        </div>

        {/* Products grid — same style as all-products but with magenta accent */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {offerProducts.map((p, i) => {
            const rupture = isRupture?.(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onProductClick?.(p)}
                className="fade-up special-glow-pulse border-glow group relative flex flex-col overflow-hidden rounded-2xl border-2 border-neon-magenta/40 bg-white text-right transition-transform duration-300 hover:-translate-y-1.5 hover:border-neon-magenta/70 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-neon-magenta/40 active:scale-[0.98]"
                style={{
                  boxShadow:
                    "0 2px 12px -4px rgba(194, 91, 126, 0.20), 0 0 0 1px rgba(194, 91, 126, 0.08)",
                  transitionDelay: `${Math.min(i * 30, 240)}ms`,
                }}
                dir="rtl"
                lang="ar"
              >
                {/* 🎁 badge — shows شارة العرض text if set, otherwise just 🎁 */}
                {p.badge && p.badge.trim() !== "" ? (
                  <span
                    className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full border border-neon-magenta/60 bg-white px-2.5 py-1 font-arabic text-[10px] font-bold text-neon-magenta shadow-sm"
                    aria-label={p.badge}
                  >
                    🎁 {p.badge}
                  </span>
                ) : (
                  <span
                    className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full border border-neon-magenta/60 bg-white px-2 py-0.5 font-arabic text-[10px] font-bold text-neon-magenta shadow-sm"
                    aria-label="عرض خاص"
                  >
                    🎁
                  </span>
                )}

                <div className="relative aspect-square w-full overflow-hidden bg-stone">
                  <ProductImage src={p.image} alt={p.name} fit="contain" />
                  {p.category && (
                    <span className="absolute right-2 top-2 rounded-full border border-clay/50 bg-white/95 px-2 py-0.5 font-arabic text-[10px] font-semibold text-gray shadow-sm">
                      {p.category}
                    </span>
                  )}
                  {rupture && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                      <span className="rounded-full bg-terracotta px-3 py-1 font-arabic text-xs font-semibold text-white shadow-md">
                        نفدت الكمية
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="line-clamp-2 font-arabic text-sm font-bold leading-snug">
                    <span className="text-blue-black">{p.name}</span>
                  </h3>
                  <p
                    className={`font-arabic text-sm font-bold ${
                      p.price === null ? "italic text-gray-light" : "text-emerald"
                    }`}
                  >
                    {p.oldPrice != null && (
                      <span className="ml-1 text-xs text-gray-light line-through">
                        {formatPrice(p.oldPrice)}
                      </span>
                    )}
                    {formatPrice(p.price)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
