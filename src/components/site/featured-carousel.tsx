"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product, formatPrice } from "@/lib/products";
import { ProductImage } from "./product-image";

type FeaturedCarouselProps = {
  products: Product[];
  onProductClick?: (product: Product) => void;
  isRupture?: (product: Product) => boolean;
};

const ROTATE_MS = 4500;

export function FeaturedCarousel({
  products,
  onProductClick,
  isRupture,
}: FeaturedCarouselProps) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  const count = products.length;

  const go = useCallback(
    (dir: number) => {
      if (count === 0) return;
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setIndex((i) => (i + 1) % count);
      }
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  // Bulletproof guard: if index is somehow out of bounds (race condition
  // during catalog refresh), fall back to the first product instead of crashing.
  const current = products[index] ?? products[0];
  if (!current) return null;
  const rupture = isRupture?.(current);

  return (
    <section
      id="vedettes"
      className="relative px-4 py-8 sm:px-6 sm:py-12"
      aria-label="منتجات مميزة"
     
     
    >
      <div className="mx-auto max-w-md">
        {/* Header — identical to reference: "Nos Coups de Cœur" eyebrow + "Produits Vedettes" */}
        <div className="fade-up mb-5 text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            <span className="text-brass text-sm">✧</span>
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brass-deep">
              Nos Coups de Cœur
            </span>
            <span className="text-brass text-sm">✧</span>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-charcoal sm:text-3xl">
            منتجات مميّزة
          </h2>
        </div>

        {/* Carousel */}
        <div
          className="relative flex items-center justify-center"
          onMouseEnter={() => (pausedRef.current = true)}
          onMouseLeave={() => (pausedRef.current = false)}
        >
          {/* Left arrow (RTL: visually on the left) */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="السابق"
            className="absolute left-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-brass/30 bg-paper/80 text-charcoal shadow-md backdrop-blur-sm transition-all hover:bg-charcoal hover:text-cream hover:border-charcoal focus:outline-none sm:left-2"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>

          {/* Card — transparent with backdrop blur, title+price overlaid on image */}
          <div className="w-full max-w-[300px] sm:max-w-[340px]">
            <button
              key={current.id}
              type="button"
              onClick={() => onProductClick?.(current)}
              className="carousel-fade block w-full overflow-hidden rounded-2xl border border-brass/20 bg-paper/90 shadow-xl shadow-brass/10 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-brass/40"
            >
              {/* Image section — full frame with dark gradient overlay at bottom */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-sand">
                <ProductImage
                  src={current.image}
                  alt={current.name}
                  fit="cover"
                  priority={index === 0}
                />

                {/* Dark gradient overlay — from bottom, fades to transparent */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />

                {/* Category badge — top-left, transparent with backdrop blur */}
                {current.category && (
                  <span className="absolute left-3 top-3 rounded-full border border-brass/20 bg-paper/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-charcoal backdrop-blur-sm">
                    {current.category}
                  </span>
                )}

                {/* Special badge — top-right */}
                {current.badge && (
                  <span
                    className="absolute right-3 top-3 rounded-full border border-rose/50 bg-paper/70 px-2 py-0.5 text-[10px] font-bold text-rose-deep backdrop-blur-sm"
                  >
                    ✨ {current.badge}
                  </span>
                )}

                {/* Rupture overlay */}
                {rupture && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
                    <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-cream">
                      نفدت الكمية
                    </span>
                  </div>
                )}

                {/* Title + price — overlaid at BOTTOM of image, white text with drop shadow */}
                <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                  <h3 className="name-reveal font-serif text-lg font-medium leading-snug text-cream drop-shadow-md">
                    {current.name}
                  </h3>
                  {current.price !== null && (
                    <p className="mt-1 text-sm font-semibold text-brass-bright drop-shadow-sm">
                      {current.oldPrice != null && (
                        <span className="ml-1.5 text-xs text-cream/60 line-through">
                          {formatPrice(current.oldPrice)}
                        </span>
                      )}
                      {formatPrice(current.price)}
                    </p>
                  )}
                  {current.price === null && (
                    <p className="mt-1 text-sm font-medium italic text-cream/80 drop-shadow-sm">
                      السعر عند الطلب
                    </p>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Right arrow (RTL: visually on the right) */}
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="التالي"
            className="absolute right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-brass/30 bg-paper/80 text-charcoal shadow-md backdrop-blur-sm transition-all hover:bg-charcoal hover:text-cream hover:border-charcoal focus:outline-none sm:right-2"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Dots — thinner, brass active */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {products.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`الانتقال إلى المنتج ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-6 bg-brass"
                  : "w-1.5 bg-clay/60 hover:bg-gray-light"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
