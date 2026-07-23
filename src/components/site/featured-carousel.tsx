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

const ROTATE_MS = 3500;

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

  const current = products[index];
  const rupture = isRupture?.(current);

  return (
    <section
      id="vedettes"
      className="relative px-4 py-4 sm:px-6 sm:py-6"
      aria-label="منتجات مميزة"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="fade-up mb-4 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="text-emerald text-sm">✧</span>
            <span className="font-arabic text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald">
              المختارات
            </span>
            <span className="text-emerald text-sm">✧</span>
          </div>
          <h2 className="font-arabic text-3xl font-bold text-charcoal sm:text-4xl">
            <span className="text-blue-black-animated">منتجات مميّزة</span>
          </h2>
        </div>

        {/* Carousel */}
        <div
          className="relative flex items-center justify-center"
          onMouseEnter={() => (pausedRef.current = true)}
          onMouseLeave={() => (pausedRef.current = false)}
        >
          {/* Right arrow */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="السابق"
            className="absolute right-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-clay/50 bg-white text-gray shadow-lg transition-all hover:border-gray hover:bg-gray hover:text-white focus:outline-none sm:right-2"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Card — SOLID white, full image visible, title+price in elegant section below */}
          <div className="w-full max-w-[320px] sm:max-w-[360px]">
            {/* CSS-only fade transition — key swap re-triggers the animation */}
            <button
              key={current.id}
              type="button"
              onClick={() => onProductClick?.(current)}
              className="carousel-fade block w-full overflow-hidden rounded-2xl border border-clay/40 bg-white transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-mid/40"
              style={{
                boxShadow:
                  "0 8px 32px -8px rgba(74, 85, 104, 0.25), 0 0 0 1px rgba(74, 85, 104, 0.10), 0 0 24px -6px rgba(74, 85, 104, 0.20)",
              }}
            >
              {/* Image section — full frame, no dark overlay */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone">
                <ProductImage
                  src={current.image}
                  alt={current.name}
                  fit="cover"
                  priority={index === 0}
                />

                {current.category && (
                  <span className="absolute right-3 top-3 rounded-full border border-clay/50 bg-white/95 px-2.5 py-1 font-arabic text-[10px] font-semibold text-gray shadow-sm">
                    {current.category}
                  </span>
                )}
                {current.badge && (
                  <span
                    className="absolute left-3 top-3 rounded-full border border-neon-magenta/50 bg-white px-2.5 py-1 font-arabic text-[10px] font-bold text-neon-magenta shadow-sm"
                    style={{ boxShadow: "0 2px 8px rgba(194, 91, 126, 0.20)" }}
                  >
                    ⚡ {current.badge}
                  </span>
                )}

                {rupture && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <span className="rounded-full bg-terracotta px-4 py-1.5 font-arabic text-xs font-semibold text-white shadow-md">
                      نفدت الكمية
                    </span>
                  </div>
                )}
              </div>

              {/* Title + price section — SOLID white, elegant, evident */}
              <div className="bg-white px-5 py-4 text-center">
                <h3 className="name-reveal font-arabic text-lg font-bold leading-snug">
                  <span className="text-blue-black-animated">{current.name}</span>
                </h3>
                {current.price !== null && (
                  <p className="mt-2 font-arabic text-xl font-bold text-emerald">
                    {current.oldPrice != null && (
                      <span className="ml-2 text-xs text-gray-light line-through">
                        {formatPrice(current.oldPrice)}
                      </span>
                    )}
                    {formatPrice(current.price)}
                  </p>
                )}
                {current.price === null && (
                  <p className="mt-2 font-arabic text-sm italic text-gray">
                    السعر عند الطلب
                  </p>
                )}
              </div>
            </button>
          </div>

          {/* Left arrow */}
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="التالي"
            className="absolute left-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-clay/50 bg-white text-gray shadow-lg transition-all hover:border-gray hover:bg-gray hover:text-white focus:outline-none sm:left-2"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Dots */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {products.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`الانتقال إلى المنتج ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index
                  ? "w-7 bg-emerald shadow-[0_0_8px_rgba(42, 125, 91,0.6)]"
                  : "w-2 bg-clay/60 hover:bg-gray-light"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
