"use client";

import { useMemo } from "react";
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

        {/* Horizontal scrollable category buttons — bigger + scrollable */}
        <div className="cat-row-scroll relative">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={`cat-btn ${active === "" ? "cat-active-default" : "cat-glow"} flex flex-col items-center gap-2 rounded-xl border px-4 py-4 font-arabic text-sm font-medium ${
              active === ""
                ? "border-blue-mid bg-blue-mid/10 text-blue-mid"
                : "border-clay/40 bg-white text-gray hover:border-gray/50 hover:text-charcoal"
            }`}
            style={{ minWidth: "110px" }}
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
                style={{ minWidth: "110px" }}
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
      </div>
    </section>
  );
}
