"use client";

import { useMemo } from "react";
import { Product } from "@/lib/products";
import { ProductCard } from "./product-card";

type AllProductsProps = {
  products: Product[];
  activeCategory: string;
  onProductClick?: (product: Product) => void;
  isRupture?: (product: Product) => boolean;
  isLowStock?: (product: Product) => boolean;
};

export function AllProducts({
  products,
  activeCategory,
  onProductClick,
  isRupture,
  isLowStock,
}: AllProductsProps) {
  const filtered = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter(
      (p) => (p.category || "").trim() === activeCategory,
    );
  }, [products, activeCategory]);

  return (
    <section
      id="tous"
      className="px-4 py-6 sm:px-6 sm:py-8"
     
     
    >
      <div className="mx-auto max-w-6xl">
        <div className="fade-up mb-6 text-center">
          <h2 className="font-arabic text-3xl font-bold text-charcoal sm:text-4xl">
            <span className="text-blue-black-animated">كل المنتجات</span>
          </h2>
          <div className="mx-auto mt-3 h-[2px] w-20 rounded-full" style={{
            background: "linear-gradient(90deg, transparent, #0A1E3A, #D4AF37, transparent)",
          }} />
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center font-arabic text-sm text-gray-light">
            لا توجد منتجات في هذه الفئة.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filtered.map((p, i) => (
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
        )}
      </div>
    </section>
  );
}
