"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Hero } from "@/components/site/hero";
import { SiteMenu, SiteMenuButton } from "@/components/site/site-menu";
import { CartBarButton, CartDrawer } from "@/components/site/cart-bar";
import { FeaturedCarousel } from "@/components/site/featured-carousel";
import { Categories } from "@/components/site/categories";
import { AllProducts } from "@/components/site/all-products";
import { SpecialOffersSection } from "@/components/site/special-offers-section";
import { BrandStory } from "@/components/site/brand-story";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductPage } from "@/components/site/product-page";
import { CheckoutModal } from "@/components/site/checkout-modal";
import { AdminPanel } from "@/components/site/admin-panel";
import { ErrorBoundary } from "@/components/site/error-boundary";
import { useCatalog } from "@/hooks/use-catalog";
import { useCart } from "@/hooks/use-cart";
import { useStock } from "@/hooks/use-stock";
import { Product } from "@/lib/products";
import { BRAND } from "@/lib/brand-config";

type View =
  | { kind: "home" }
  | { kind: "product"; id: string }
  | { kind: "admin" };

function parseHash(): View {
  if (typeof window === "undefined") return { kind: "home" };
  // G7 FIX: Only lowercase the prefix (#admin, #product), NOT the product ID itself
  // (product IDs are case-sensitive — lowercasing them would break navigation)
  const h = window.location.hash;
  const hLower = h.toLowerCase();
  if (hLower === "#admin" || hLower.startsWith("#admin/")) return { kind: "admin" };
  // Format: #product/{id}
  const m = hLower.match(/^#product\/(.+)$/);
  if (m) {
    // G8 FIX: decodeURIComponent can throw URIError on malformed input — wrap in try/catch
    try {
      const id = decodeURIComponent(m[1]);
      return { kind: "product", id };
    } catch {
      return { kind: "home" }; // malformed URL — go home
    }
  }
  return { kind: "home" };
}

export default function Home() {
  const catalog = useCatalog();
  const cart = useCart();
  const stock = useStock();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [view, setView] = useState<View>({ kind: "home" });

  // Small logo in the header descends when the user scrolls past ~100px.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Saved scroll position — when user opens a product page, we record where
  // they were on the home page so we can restore it when they go back.
  const savedScrollRef = useRef<number>(0);

  // Detect hash changes (admin / product page navigation)
  useEffect(() => {
    const checkHash = () => setView(parseHash());
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  // Handle scroll behavior on view changes:
  // - home → product: scroll to top (so the product page starts at the top)
  // - product → home: RESTORE the saved scroll position (don't jump to top)
  // - admin: do nothing (admin has its own scroll handling)
  useEffect(() => {
    if (view.kind === "product") {
      // Entering a product page — start at the top.
      window.scrollTo({ top: 0, behavior: "auto" });
    } else if (view.kind === "home") {
      // Returning to home — restore the saved scroll position.
      // Use requestAnimationFrame so the home DOM is painted first.
      const y = savedScrollRef.current;
      requestAnimationFrame(() => {
        window.scrollTo({ top: y, behavior: "auto" });
      });
    }
  }, [view.kind, view.kind === "product" ? view.id : ""]);

  const exitToHome = useCallback(() => {
    try {
      history.pushState(
        "",
        document.title,
        window.location.pathname + window.location.search,
      );
    } catch {
      window.location.hash = "";
    }
    if (window.location.hash) {
      window.location.hash = "";
    }
    setView({ kind: "home" });
  }, []);

  const navigateToProduct = useCallback((p: Product) => {
    // Save current scroll position so we can restore it when the user
    // closes the product page and comes back to the home/catalog.
    savedScrollRef.current = window.scrollY;
    window.location.hash = `product/${encodeURIComponent(p.id)}`;
    setView({ kind: "product", id: p.id });
  }, []);

  const handleProductClick = useCallback(
    (p: Product) => {
      navigateToProduct(p);
    },
    [navigateToProduct],
  );

  const handleAddToCart = useCallback(
    (item: {
      productId: string;
      name: string;
      price: number | null;
      image: string;
      variantKey?: string;
    }) => {
      cart.addToCart(item, 1);
    },
    [cart],
  );

  const handleCartItemOpen = useCallback(
    (productId: string) => {
      const p = catalog.products.find((x) => x.id === productId);
      if (p) {
        setCartOpen(false);
        navigateToProduct(p);
      }
    },
    [catalog.products, navigateToProduct],
  );

  const handleCheckout = useCallback(() => {
    setCartOpen(false);
    setCheckoutOpen(true);
  }, []);

  const handleOrderSuccess = useCallback(() => {
    cart.clearCart();
  }, [cart]);

  // Filter out products with no image AND skip guidance/invalid rows
  // Memoized to avoid re-running the O(n) + regex filter on every render.
  const validProducts = useMemo(
    () =>
      catalog.products.filter(
        (p) =>
          p.image &&
          p.image.trim() !== "" &&
          // Skip products whose ID contains emojis or Arabic (guidance row leak)
          !/[\u0600-\u06FF\u{1F000}-\u{1FFFF}]/u.test(p.id || "") &&
          // Skip products whose image is not a valid URL or data URL
          (p.image.startsWith("http") || p.image.startsWith("data:") || p.image.startsWith("/")),
      ),
    [catalog.products],
  );

  // P0 FIX #3: Prune orphan cart items when catalog changes.
  // Removes cart items whose productId no longer exists in the live catalog.
  useEffect(() => {
    if (catalog.products.length > 0 && cart.hydrated) {
      const validIds = new Set(catalog.products.map((p) => p.id));
      cart.pruneOrphanItems(validIds);
    }
  }, [catalog.products, cart.hydrated, cart.pruneOrphanItems]);
  const featured = useMemo(() => validProducts.filter((p) => p.featured), [validProducts]);
  // Special offer products are shown ONLY in the special offers section, not in All Products
  const allProductsList = useMemo(
    () => validProducts.filter((p) => !p.isSpecialOffer),
    [validProducts],
  );
  // Show skeletons ONLY if we have NO data at all (no cached, no seed).
  // If we have ANY products (cached or fresh), show them immediately —
  // never show "stuck at loading" skeletons when we have data to display.
  const showSkeletons = catalog.loading && validProducts.length === 0 && !catalog.hydrated;

  // Rupture + low stock checks — from the Stock tab (polled every 5.5 min)
  const isRupture = useCallback(
    (product: Product) => stock.isRupture(product.name),
    [stock],
  );

  const isLowStock = useCallback(
    (product: Product) => stock.isLowStock(product.name),
    [stock],
  );

  // ===== ADMIN VIEW =====
  if (view.kind === "admin") {
    return (
      <ErrorBoundary>
        <AdminPanel
          products={catalog.products}
          onUpsert={catalog.upsertProduct}
          onDelete={catalog.deleteProduct}
          onAddBlank={catalog.addBlankProduct}
          onMove={catalog.moveProduct}
          onReset={catalog.resetCatalog}
          onClose={exitToHome}
          syncing={catalog.syncing}
        />
      </ErrorBoundary>
    );
  }

  // ===== PRODUCT PAGE VIEW =====
  if (view.kind === "product") {
    const product = catalog.products.find((p) => p.id === view.id);
    if (product) {
      // Related: same category, exclude current, limit 4
      const related = validProducts
        .filter((p) => p.id !== product.id && p.category === product.category)
        .slice(0, 4);
      // If not enough same-category, fill with other products
      const fill =
        related.length < 4
          ? validProducts
              .filter((p) => p.id !== product.id && !related.includes(p))
              .slice(0, 4 - related.length)
          : [];
      const relatedFinal = [...related, ...fill];

      return (
        <ErrorBoundary>
          <ProductPage
            product={product}
            onAddToCart={handleAddToCart}
            onBack={exitToHome}
            rupture={stock.isRupture(product.name)}
            relatedProducts={relatedFinal}
            onProductClick={handleProductClick}
            isVariantRupture={stock.isVariantRupture}
          />
        </ErrorBoundary>
      );
    }
    // Product not found (was deleted or doesn't exist) — show friendly message
    // instead of silently falling through to home
    if (catalog.hydrated && catalog.products.length > 0) {
      return (
        <ErrorBoundary>
          <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "#FAF8F4" }}>
            <div className="text-center" style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
              <h1 className="font-arabic" style={{ fontSize: 24, fontWeight: 700, color: "#1C1815", marginBottom: 12 }}>
                هذا المنتج لم يعد متاحاً
              </h1>
              <p className="font-arabic" style={{ fontSize: 14, color: "#6B5D4F", marginBottom: 24, lineHeight: 1.6 }}>
                ربما تم حذفه أو تعديله. تصفح بقية المنتجات المتاحة.
              </p>
              <button
                onClick={exitToHome}
                className="font-arabic"
                style={{
                  background: "#1C1815",
                  color: "#FAF8F4",
                  border: "none",
                  borderRadius: 9999,
                  padding: "12px 32px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                العودة للمتجر
              </button>
            </div>
          </div>
        </ErrorBoundary>
      );
    }
    // Catalog still loading — fall through to home (shows skeletons)
  }

  // ===== HOME VIEW =====
  return (
    <ErrorBoundary>
    <div className="flex min-h-screen flex-col">
      {/* Fixed header — constant height, no layout shift.
          overflow: visible so the logo is never clipped. */}
      <div
        className="safe-top fixed inset-x-0 top-0 z-40 flex items-center justify-between px-3 py-3 transition-all duration-300 sm:px-4"
        style={{
          height: "60px",
          backgroundColor: scrolled ? "rgba(255, 255, 255, 0.95)" : "transparent",
          boxShadow: scrolled ? "0 2px 12px -2px rgba(74, 85, 104, 0.15)" : "none",
          overflow: "visible",
        }}
      >
        <SiteMenuButton onClick={() => setMenuOpen(true)} />

        {/* Centered logo — fades in when scrolled, logo only (no text).
            No translate animation — just opacity for a clean fade.
            Positioned absolutely so it doesn't affect layout. */}
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="العودة للأعلى"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            opacity: scrolled ? 1 : 0,
            pointerEvents: scrolled ? "auto" : "none",
            transition: "opacity 0.3s ease-out",
          }}
        >
          <div className="neon-ring rounded-full p-[2px]" style={{ width: 44, height: 44 }}>
            <div className="h-full w-full overflow-hidden rounded-full bg-night">
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </button>

        <CartBarButton count={cart.count} onOpen={() => setCartOpen(true)} />
      </div>

      <main className="flex-1">
        <Hero />
        {showSkeletons ? (
          <>
            {/* Skeleton carousel */}
            <section className="px-4 py-8 sm:px-6 sm:py-12">
              <div className="mx-auto max-w-md">
                <div className="mb-5 text-center">
                  <div className="mx-auto h-3 w-32 animate-pulse rounded shimmer-line" />
                  <div className="mx-auto mt-3 h-7 w-48 animate-pulse rounded shimmer-line" />
                </div>
                <div className="mx-auto h-[380px] max-w-[340px] animate-pulse rounded-2xl shimmer-line" />
              </div>
            </section>
            {/* Skeleton grid */}
            <section className="px-4 py-10 sm:px-6 sm:py-12">
              <div className="mx-auto max-w-6xl">
                <div className="mx-auto mb-5 h-8 w-56 animate-pulse rounded shimmer-line" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col overflow-hidden rounded-xl border border-clay/30 bg-night-soft/50"
                    >
                      <div className="aspect-square w-full animate-pulse shimmer-line" />
                      <div className="flex flex-col gap-2 p-3">
                        <div className="h-3 w-3/4 animate-pulse rounded shimmer-line" />
                        <div className="h-3 w-1/3 animate-pulse rounded shimmer-line" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <FeaturedCarousel
              products={featured}
              onProductClick={handleProductClick}
              isRupture={isRupture}
            />
            <SpecialOffersSection
              products={validProducts}
              onProductClick={handleProductClick}
              isRupture={isRupture}
            />
            <Categories
              products={allProductsList}
              active={activeCategory}
              onSelect={setActiveCategory}
            />
            <AllProducts
              products={allProductsList}
              activeCategory={activeCategory}
              onProductClick={handleProductClick}
              onSelectCategory={setActiveCategory}
              isRupture={isRupture}
              isLowStock={isLowStock}
            />
          </>
        )}
        <BrandStory />
      </main>

      <SiteFooter />

      <SiteMenu open={menuOpen} onOpenChange={setMenuOpen} />
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cart.items}
        onUpdateQuantity={cart.updateQuantity}
        onRemove={cart.removeItem}
        onItemClick={handleCartItemOpen}
        onCheckout={handleCheckout}
      />

      <CheckoutModal
        open={checkoutOpen}
        items={cart.items}
        onClose={() => setCheckoutOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />
    </div>
    </ErrorBoundary>
  );
}
