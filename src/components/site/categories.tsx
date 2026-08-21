"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { getCategoryActiveClass } from "@/lib/category-anim";
import { CategoryIcon } from "./category-icon";

type CategoriesProps = {
  products: { category: string }[];
  active: string; // "" = all
  onSelect: (category: string) => void;
};

/** The label used for products that have no category assigned. Must match AllProducts. */
const OTHER_CATEGORY = "منتجات أخرى";

export function Categories({ products, active, onSelect }: CategoriesProps) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    let hasUncategorized = false;
    products.forEach((p) => {
      const c = (p.category || "").trim();
      if (c) {
        set.add(c);
      } else {
        hasUncategorized = true;
      }
    });
    const arr = Array.from(set);
    // Add "Other Products" as a regular category if there are uncategorized products
    if (hasUncategorized) arr.push(OTHER_CATEGORY);
    return arr;
  }, [products]);

  // Scroll state for arrows
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check if we need to show arrows (content overflows)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const checkScroll = () => {
      // RTL scroll: scrollLeft is 0 at the right edge, negative as you scroll left
      // We use scrollWidth vs clientWidth to determine if there's overflow
      const hasOverflow = el.scrollWidth > el.clientWidth + 5; // 5px tolerance
      if (!hasOverflow) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }

      // For RTL, scrollLeft is typically 0 when scrolled to the "right" (start)
      // and negative when scrolled to the "left" (end)
      const scrollLeft = el.scrollLeft;
      const maxScroll = el.scrollWidth - el.clientWidth;

      // In RTL: scrollLeft 0 = at start (right side)
      // scrollLeft = -maxScroll = at end (left side)
      setCanScrollRight(scrollLeft > -maxScroll + 5); // can scroll more to the left
      setCanScrollLeft(scrollLeft < -5); // can scroll back to the right
    };

    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 200; // pixels to scroll
    // In RTL, scrolling "left" (visually) means decreasing scrollLeft
    // and scrolling "right" means increasing scrollLeft
    if (direction === "left") {
      el.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    } else {
      el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (categories.length === 0) return null;

  return (
    <section
      id="categories"
      className="px-4 py-4 sm:px-6 sm:py-6"
      dir="rtl"
      lang="ar"
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="fade-up mb-5 text-center"
        >
          <h2 className="font-arabic text-2xl font-bold text-charcoal sm:text-3xl">
            <span className="text-blue-black-animated">الفئات</span>
          </h2>
          <div className="mx-auto mt-2 h-[2px] w-12 rounded-full" style={{
            background: "linear-gradient(90deg, transparent, #4A9DA1, transparent)",
          }} />
        </div>

        {/* Horizontal scrollable category buttons with arrows */}
        <div className="relative">
          {/* Left Arrow (points right in RTL = scroll backward) */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-all hover:bg-white"
              aria-label="السابق"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            className="cat-row-scroll flex gap-3 overflow-x-auto scroll-smooth pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <button
              type="button"
              onClick={() => onSelect("")}
              className={`cat-btn ${active === "" ? "cat-active-default" : "cat-glow"} flex flex-col items-center gap-2 rounded-xl border px-4 py-4 font-arabic text-sm font-medium ${
                active === ""
                  ? "border-blue-mid bg-blue-mid/10 text-blue-mid"
                  : "border-clay/40 bg-white text-gray hover:border-gray/50 hover:text-charcoal"
              }`}
              style={{ minWidth: "110px", flexShrink: 0 }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>الكل</span>
            </button>
            {categories.map((cat) => {
              const isActive = active === cat;
              const activeAnim = isActive ? getCategoryActiveClass(cat) : "";
              const isOther = cat === OTHER_CATEGORY;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onSelect(cat)}
                  className={`cat-btn ${isActive ? activeAnim : "cat-glow"} flex flex-col items-center gap-2 rounded-xl border px-4 py-4 font-arabic text-sm font-medium ${
                    isActive
                      ? "border-blue-mid bg-blue-mid/10 text-blue-mid"
                      : "border-clay/40 bg-white text-gray hover:border-gray/50 hover:text-charcoal"
                  }`}
                  style={{ minWidth: "110px", flexShrink: 0 }}
                >
                  {isOther ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  ) : (
                    <CategoryIcon name={cat} />
                  )}
                  <span className="line-clamp-1 text-center">{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow (points left in RTL = scroll forward) */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-all hover:bg-white"
              aria-label="التالي"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
