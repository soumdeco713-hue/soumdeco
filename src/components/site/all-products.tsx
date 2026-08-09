"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import { CategoryIcon } from "./category-icon";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AllProductsProps = {
  products: Product[];
  activeCategory: string;
  onProductClick?: (product: Product) => void;
  onSelectCategory?: (category: string) => void;
  isRupture?: (product: Product) => boolean;
  isLowStock?: (product: Product) => boolean;
};

/** The label used for products that have no category assigned. */
const OTHER_CATEGORY = "منتجات أخرى";

/**
 * AllProducts — horizontal category sections.
 *
 * Each category is shown as a small elegant header (icon + name + count + divider),
 * with its products in a horizontal scrollable row below (with left/right arrows).
 *
 * Products without a category are grouped under "منتجات أخرى" (Other Products),
 * which is treated as a regular category — it appears in the category buttons
 * and can be filtered like any other category.
 *
 * Edge cases handled:
 *  - Empty category → not rendered (no empty sections)
 *  - Product with no category → goes to "منتجات أخرى" section
 *  - Deleting last product in a category → category section disappears automatically
 *  - Adding a new category → new section appears automatically
 *  - Category filter active → shows ONLY that category's products (correct filtering)
 *  - No products at all → shows empty state message
 */
export function AllProducts({
  products,
  activeCategory,
  onProductClick,
  onSelectCategory,
  isRupture,
  isLowStock,
}: AllProductsProps) {
  // Group products by category — preserve insertion order
  // Products with no category are assigned to OTHER_CATEGORY
  const { categorized, categoryOrder } = useMemo(() => {
    const map = new Map<string, Product[]>();
    const order: string[] = [];

    // Sort products by sortOrder DESCENDING — newest products appear first.
    const sorted = [...products].sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));

    for (const p of sorted) {
      const cat = (p.category || "").trim() || OTHER_CATEGORY;
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat)!.push(p);
    }

    // Sort category sections by product count (most products first).
    // "منتجات أخرى" (Other) always appears last.
    order.sort((a, b) => {
      if (a === OTHER_CATEGORY) return 1;
      if (b === OTHER_CATEGORY) return -1;
      return (map.get(b)?.length ?? 0) - (map.get(a)?.length ?? 0);
    });

    return { categorized: map, categoryOrder: order };
  }, [products]);

  // If a category filter is active, show only that category's products
  const isFiltered = activeCategory !== "";

  // Get the products for the filtered category (or all if not filtered)
  const filteredProducts = useMemo(() => {
    if (!isFiltered) return products;
    if (activeCategory === OTHER_CATEGORY) {
      return products.filter((p) => !((p.category || "").trim()));
    }
    return products.filter((p) => (p.category || "").trim() === activeCategory);
  }, [products, activeCategory, isFiltered]);

  return (
    <section
      id="tous"
      className="px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section title */}
        <div className="fade-up mb-6 text-center">
          <h2 className="font-arabic text-3xl font-bold text-charcoal sm:text-4xl">
            <span className="text-blue-black-animated">كل المنتجات</span>
          </h2>
          <div className="mx-auto mt-3 h-[2px] w-20 rounded-full" style={{
            background: "linear-gradient(90deg, transparent, #0A1E3A, #D4AF37, transparent)",
          }} />
        </div>

        {products.length === 0 ? (
          /* Empty state — no products at all */
          <p className="py-10 text-center font-arabic text-sm text-gray-light">
            لا توجد منتجات.
          </p>
        ) : isFiltered ? (
          /* Filtered view — show selected category's products in a VERTICAL GRID
             (different from the default horizontal-scroll layout) */
          filteredProducts.length === 0 ? (
            <p className="py-10 text-center font-arabic text-sm text-gray-light">
              لا توجد منتجات في هذه الفئة.
            </p>
          ) : (
            <div>
              {/* Category header */}
              <div className="cat-section-header mb-4">
                <div className="cat-icon-wrap">
                  {activeCategory === OTHER_CATEGORY ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  ) : (
                    <CategoryIcon name={activeCategory} />
                  )}
                </div>
                <h3>{activeCategory}</h3>
                <span className="cat-count">({filteredProducts.length})</span>
                <div className="cat-divider" />
              </div>
              {/* Vertical grid — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {filteredProducts.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    index={i}
                    onClick={onProductClick}
                    rupture={isRupture?.(p)}
                    lowStock={isLowStock?.(p)}
                  />
                ))}
              </div>
            </div>
          )
        ) : (
          /* Default view — all categories as horizontal sections */
          <div className="space-y-8">
            {categoryOrder.map((cat) => {
              const catProducts = categorized.get(cat) || [];
              if (catProducts.length === 0) return null; // skip empty categories
              return (
                <CategoryRow
                  key={cat}
                  name={cat}
                  products={catProducts}
                  onProductClick={onProductClick}
                  onShowAll={onSelectCategory}
                  isRupture={isRupture}
                  isLowStock={isLowStock}
                  isOther={cat === OTHER_CATEGORY}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * CategoryRow — a single category section with:
 *  - Small elegant header (icon + name + count + divider)
 *  - Horizontal scrollable row of product cards with left/right arrows
 */
type CategoryRowProps = {
  name: string;
  products: Product[];
  onProductClick?: (product: Product) => void;
  onShowAll?: (category: string) => void;
  isRupture?: (product: Product) => boolean;
  isLowStock?: (product: Product) => boolean;
  isOther?: boolean; // true for "منتجات أخرى"
};

function CategoryRow({
  name,
  products,
  onProductClick,
  onShowAll,
  isRupture,
  isLowStock,
  isOther,
}: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position to show/hide arrows
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    // Re-check on resize
    const onResize = () => checkScroll();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [products]);

  // Scroll by one card width (with smooth behavior)
  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(".product-card-h")?.getBoundingClientRect().width ?? 150;
    const gap = 12; // 0.75rem gap
    el.scrollBy({
      left: dir === "left" ? -(cardWidth + gap) : cardWidth + gap,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <div className="fade-up">
      {/* Category header — small, elegant, with icon */}
      <div className="cat-section-header">
        <div className="cat-icon-wrap">
          {isOther ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          ) : (
            <CategoryIcon name={name} />
          )}
        </div>
        <h3>{name}</h3>
        <span className="cat-count">({products.length})</span>
        <div className="cat-divider" />
        {onShowAll && (
          <button
            type="button"
            onClick={() => onShowAll(name)}
            className="font-arabic text-[11px] text-brass-deep hover:text-brass transition-colors whitespace-nowrap mr-2"
          >
            عرض الكل ←
          </button>
        )}
      </div>

      {/* Horizontal scrollable product row with arrows */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy("left")}
            aria-label="السابق"
            className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-clay/50 bg-white/90 text-charcoal shadow-md backdrop-blur-sm transition-all hover:bg-charcoal hover:text-cream hover:border-charcoal focus:outline-none"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy("right")}
            aria-label="التالي"
            className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-clay/50 bg-white/90 text-charcoal shadow-md backdrop-blur-sm transition-all hover:bg-charcoal hover:text-cream hover:border-charcoal focus:outline-none"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        )}

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="cat-row-scroll"
        >
          {products.map((p, i) => (
            <div key={p.id} className="product-card-h">
              <ProductCard
                product={p}
                index={i}
                onClick={onProductClick}
                rupture={isRupture?.(p)}
                lowStock={isLowStock?.(p)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
