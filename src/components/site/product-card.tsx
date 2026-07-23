"use client";

import { Product, formatPrice } from "@/lib/products";
import { ProductImage } from "./product-image";

type ProductCardProps = {
  product: Product;
  onClick?: (product: Product) => void;
  rupture?: boolean;
  lowStock?: boolean;
  index?: number;
};

export function ProductCard({ product, onClick, rupture, lowStock, index = 0 }: ProductCardProps) {
  const priceLabel = formatPrice(product.price);

  return (
    <button
      type="button"
      onClick={() => onClick?.(product)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-clay/40 bg-white text-left transition-transform duration-300 hover:-translate-y-1.5 hover:border-gray/40 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-mid/40 active:scale-[0.98]"
      style={{
        boxShadow: "0 2px 12px -4px rgba(74, 85, 104, 0.15)",
        transitionDelay: `${Math.min(index * 30, 240)}ms`,
      }}
     
     
    >
      {/* Hover elegant gray glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle at center, rgba(74, 85, 104, 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative aspect-square w-full overflow-hidden bg-stone">
        <ProductImage src={product.image} alt={product.name} fit="contain" />
        {product.category && (
          <span className="badge-glow absolute right-2 top-2 rounded-full border border-clay/50 bg-white/95 px-2 py-0.5 font-arabic text-[10px] font-semibold text-gray shadow-sm">
            {product.category}
          </span>
        )}
        {product.badge && (
          <span
            className="absolute left-2 top-2 rounded-full border border-neon-magenta/50 bg-white px-2 py-0.5 font-arabic text-[10px] font-bold text-neon-magenta shadow-sm"
            style={{ boxShadow: "0 2px 8px rgba(194, 91, 126, 0.20)" }}
          >
            ⚡ {product.badge}
          </span>
        )}
        {/* Low-stock badge — from Stock tab (1-3 items) */}
        {lowStock && !rupture && (
          <span className="absolute bottom-2 left-2 rounded-full bg-terracotta/95 px-2 py-0.5 font-arabic text-[10px] font-semibold text-white shadow-sm">
            متبقي القليل
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
          <span className="text-blue-black-animated">{product.name}</span>
        </h3>
        <p
          className={`font-arabic text-sm font-bold ${
            product.price === null ? "italic text-gray-light" : "text-emerald"
          }`}
        >
          {product.oldPrice != null && (
            <span className="ml-1 text-xs text-gray-light line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
          {priceLabel}
        </p>
      </div>
    </button>
  );
}
