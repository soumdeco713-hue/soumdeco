"use client";

import { useMemo } from "react";
import { Product } from "@/lib/products";
import { ProductCard } from "./product-card";
import { CategoryIcon } from "./category-icon";

type AllProductsProps = {
  products: Product[];
  activeCategory: string;
  onProductClick?: (product: Product) => void;
  isRupture?: (product: Product) => boolean;
  isLowStock?: (product: Product) => boolean;
};

/**
 * AllProducts — horizontal category sections.
 *
 * Each category is shown as a small elegant header (icon + name + count + divider),
 * with its products in a horizontal scrollable row below.
 *
 * Products without a category are grouped under "منتجات أخرى" (Other Products).
 *
 * Edge cases handled:
 *  - Empty category → not rendered (no empty sections)
 *  - Product with no category → goes to "Other Products" section
 *  - Deleting last product in a category → category section disappears automatically
 *  - Adding a new category → new section appears automatically
 *  - No products at all → shows empty state message
 */
export function AllProducts({
  products,
  activeCategory,
  onProductClick,
  isRupture,
  isLowStock,
}: AllProductsProps) {
  // Group products by category — preserve insertion order
  const { categorized, uncategorized, categoryOrder } = useMemo(() => {
    const map = new Map<string, Product[]>();
    const order: string[] = [];
    const uncategorized: Product[] = [];

    for (const p of products) {
      const cat = (p.category || "").trim();
      if (!cat) {
        uncategorized.push(p);
        continue;
      }
      if (!map.has(cat)) {
        map.set(cat, []);
        order.push(cat);
      }
      map.get(cat)!.push(p);
    }

    return { categorized: map, uncategorized, categoryOrder: order };
  }, [products]);

  // If a category filter is active, show only that category (horizontal row)
  // Otherwise, show all categories as horizontal sections
  const isFiltered = activeCategory !== "";

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
          /* Filtered view — show single category as horizontal row */
          <CategoryRow
            name={activeCategory}
            products={products}
            onProductClick={onProductClick}
            isRupture={isRupture}
            isLowStock={isLowStock}
          />
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
                  isRupture={isRupture}
                  isLowStock={isLowStock}
                />
              );
            })}

            {/* Uncategorized products — "منتجات أخرى" (Other Products) */}
            {uncategorized.length > 0 && (
              <CategoryRow
                name="منتجات أخرى"
                products={uncategorized}
                onProductClick={onProductClick}
                isRupture={isRupture}
                isLowStock={isLowStock}
                forceIcon="other"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * CategoryRow — a single category section with:
 *  - Small elegant header (icon + name + count + divider)
 *  - Horizontal scrollable row of product cards
 */
type CategoryRowProps = {
  name: string;
  products: Product[];
  onProductClick?: (product: Product) => void;
  isRupture?: (product: Product) => boolean;
  isLowStock?: (product: Product) => boolean;
  forceIcon?: "other"; // for uncategorized products
};

function CategoryRow({
  name,
  products,
  onProductClick,
  isRupture,
  isLowStock,
  forceIcon,
}: CategoryRowProps) {
  if (products.length === 0) return null;

  return (
    <div className="fade-up">
      {/* Category header — small, elegant, with icon */}
      <div className="cat-section-header">
        <div className="cat-icon-wrap">
          {forceIcon === "other" ? (
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
      </div>

      {/* Horizontal scrollable product row */}
      <div className="cat-row-scroll">
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
  );
}
