"use client";

import { useEffect, useState } from "react";
import { X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Product, formatPrice, getProductImages } from "@/lib/products";
import { ProductImage } from "./product-image";
import { CodOrderForm, OrderItem } from "./cod-order-form";

type ProductDetailModalProps = {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (item: {
    productId: string;
    name: string;
    price: number | null;
    image: string;
  }) => void;
  rupture?: boolean;
};

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  rupture,
}: ProductDetailModalProps) {
  const [added, setAdded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setAdded(false);
    setActiveIdx(0);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [product, onClose]);

  if (!product) return null;

  const images = getProductImages(product);
  const currentImage = images[activeIdx] || images[0] || "";
  const hasMultiple = images.length > 1;

  const go = (dir: number) => {
    if (!hasMultiple) return;
    setActiveIdx((i) => (i + dir + images.length) % images.length);
  };

  const orderItems: OrderItem[] = [
    {
      name: product.name,
      price: product.price,
      quantity: 1,
    },
  ];

  const handleAdd = () => {
    onAddToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: currentImage,
    });
    setAdded(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
     
     
    >
      <div onClick={onClose} className="fixed inset-0 bg-ink/55" />

      <div className="relative z-10 my-4 w-full max-w-3xl rounded-2xl border border-clay/50 bg-paper shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-cream/90 text-charcoal shadow-sm transition-colors hover:bg-sand"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative flex flex-col">
            <div className="relative aspect-square w-full bg-stone/30 md:aspect-auto md:min-h-[420px]">
              {currentImage ? (
                <ProductImage
                  src={currentImage}
                  alt={product.name}
                  fit="contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-arabic text-sm text-gray-light">
                  لا توجد صورة
                </div>
              )}

              {rupture && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
                  <span className="rounded-full bg-terracotta px-4 py-1.5 font-arabic text-sm font-semibold text-white">
                    نفدت الكمية
                  </span>
                </div>
              )}

              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="الصورة السابقة"
                    className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 text-charcoal shadow-md backdrop-blur-sm transition-colors hover:bg-emerald hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="الصورة التالية"
                    className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-paper/85 text-charcoal shadow-md backdrop-blur-sm transition-colors hover:bg-emerald hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>

                  <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink/40 px-2 py-1 backdrop-blur-sm">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`الصورة ${i + 1}`}
                        onClick={() => setActiveIdx(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === activeIdx
                            ? "w-4 bg-cream"
                            : "w-1.5 bg-cream/50 hover:bg-cream/80"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {hasMultiple && (
              <div className="flex gap-1.5 overflow-x-auto p-2 no-scrollbar">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-label={`الصورة ${i + 1}`}
                    className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border bg-stone/40 transition-all ${
                      i === activeIdx
                        ? "border-brass ring-1 ring-brass/40"
                        : "border-clay/50 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <ProductImage
                      src={img}
                      alt={`صورة ${i + 1}`}
                      fit="cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col p-5 sm:p-6">
            <div>
              <h2 className="font-arabic text-2xl font-bold leading-tight text-charcoal">
                {product.name}
              </h2>
              {product.category && (
                <p className="mt-1 font-arabic text-xs uppercase tracking-wide text-gray-light">
                  {product.category}
                </p>
              )}
              <p className="mt-3 font-arabic text-xl font-bold text-emerald">
                {formatPrice(product.price)}
              </p>
              <p className="mt-3 font-arabic text-sm leading-loose text-gray">
                {product.description}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={rupture}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 font-arabic text-sm font-semibold transition-colors disabled:opacity-50 ${
                added
                  ? "bg-emerald-bright text-white"
                  : "bg-emerald text-white hover:bg-emerald-deep"
              }`}
            >
              {added ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={3} />
                  تمت الإضافة
                </>
              ) : (
                <>أضف إلى السلة</>
              )}
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-clay/50" />
              <span className="font-arabic text-xs text-gray-light">
                أو اطلب مباشرة
              </span>
              <div className="h-px flex-1 bg-clay/50" />
            </div>

            <CodOrderForm
              items={orderItems}
              rupture={rupture}
              onContinueShopping={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
