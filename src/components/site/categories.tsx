"use client";

import { useMemo } from "react";
import { getCategoryActiveClass } from "@/lib/category-anim";

type CategoriesProps = {
  products: { category: string }[];
  active: string; // "" = all
  onSelect: (category: string) => void;
};

function CategoryIcon({ name }: { name: string }) {
  // Same Arabic normalization as category-anim.ts so icons match correctly
  const key = (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
  const common = "h-5 w-5";
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  // PLATES / TABLEWARE / DISHES
  if (
    key.includes("table") ||
    key.includes("assiet") ||
    key.includes("plat") ||
    key.includes("vaissel") ||
    key.includes("porcel") ||
    key.includes("ceram") ||
    key.includes("cerâm") ||
    key.includes("service") ||
    key.includes("dish") ||
    key.includes("plate") ||
    key.includes("dinner") ||
    key.includes("صحون") ||
    key.includes("طبق") ||
    key.includes("مائده") ||
    key.includes("سفره")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    );
  }

  // KITCHEN / COOKWARE / UTENSILS
  if (
    key.includes("ustens") ||
    key.includes("cuisin") ||
    key.includes("cuiss") ||
    key.includes("four") ||
    key.includes("marmit") ||
    key.includes("casser") ||
    key.includes("pole") ||
    key.includes("mixeur") ||
    key.includes("mixer") ||
    key.includes("blend") ||
    key.includes("kitchen") ||
    key.includes("cook") ||
    key.includes("pot") ||
    key.includes("pan") ||
    key.includes("utensil") ||
    key.includes("مطبخ") ||
    key.includes("ادوات") ||
    key.includes("قدر") ||
    key.includes("طنجره")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M4 9h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
        <path d="M2 9h20M8 9V6M16 9V6M10 4h4" />
      </svg>
    );
  }

  // ELECTRONICS / APPLIANCES — includes "أجهزة" (devices)
  if (
    key.includes("electrom") ||
    key.includes("electr") ||
    key.includes("appareil") ||
    key.includes("menager") ||
    key.includes("ménag") ||
    key.includes("electronic") ||
    key.includes("appliance") ||
    key.includes("electric") ||
    key.includes("device") ||
    key.includes("كهربائي") ||
    key.includes("اجهزه") ||
    key.includes("جهاز")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
    );
  }

  // DECORATION / LAMPS / CANDLES
  if (
    key.includes("deco") ||
    key.includes("decor") ||
    key.includes("lampe") ||
    key.includes("bougie") ||
    key.includes("photoph") ||
    key.includes("lumin") ||
    key.includes("light") ||
    key.includes("candle") ||
    key.includes("ديكور") ||
    key.includes("مصباح") ||
    key.includes("شمعه")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M9 2h6l3 7H6l3-7Z" />
        <path d="M12 9v9M9 22h6" />
      </svg>
    );
  }

  // FURNITURE / SOFA / LIVING ROOM
  if (
    key.includes("salon") ||
    key.includes("mobil") ||
    key.includes("meuble") ||
    key.includes("canap") ||
    key.includes("chaise") ||
    key.includes("furnitur") ||
    key.includes("sofa") ||
    key.includes("chair") ||
    key.includes("living") ||
    key.includes("صالون") ||
    key.includes("اثاث") ||
    key.includes("كنبه") ||
    key.includes("كرسي")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M3 12v6h18v-6M3 12a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2M6 10V7h12v3M5 18v2M19 18v2" />
      </svg>
    );
  }

  // TEXTILES / LINENS / CUSHIONS
  if (
    key.includes("textile") ||
    key.includes("linge") ||
    key.includes("coussin") ||
    key.includes("rideau") ||
    key.includes("tapis") ||
    key.includes("nappe") ||
    key.includes("serviett") ||
    key.includes("linen") ||
    key.includes("cushion") ||
    key.includes("curtain") ||
    key.includes("rug") ||
    key.includes("carpet") ||
    key.includes("towel") ||
    key.includes("منسوجات") ||
    key.includes("وساده") ||
    key.includes("ستاره") ||
    key.includes("سجاد")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M3 6h18v12H3zM3 6l3-3h12l3 3M3 18l3 3h12l3-3M6 3v18M18 3v18" />
      </svg>
    );
  }

  // CAR / AUTO ACCESSORIES — includes "إكسسوارات السيارة"
  if (
    key.includes("voiture") ||
    key.includes("auto") ||
    key.includes("car ") ||
    key.includes("سياره") ||
    key.includes("السياره") ||
    key.includes("اكسسوارات") ||
    key.includes("اكسسوارات")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M3 12h18M5 12l2-5h10l2 5M5 12v5h2v-2h10v2h2v-5" />
        <circle cx="8" cy="14" r="1" />
        <circle cx="16" cy="14" r="1" />
      </svg>
    );
  }

  // WINDOW / SCREEN / INSECT PROTECTION — includes "موستيكير", "شبك"
  if (
    key.includes("fenetre") ||
    key.includes("fenêtr") ||
    key.includes("window") ||
    key.includes("screen") ||
    key.includes("moustiqu") ||
    key.includes("magnetic") ||
    key.includes("insect") ||
    key.includes("نافذه") ||
    key.includes("نوافذ") ||
    key.includes("شبك") ||
    key.includes("حشرات")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </svg>
    );
  }

  // BATHROOM / WELLNESS
  if (
    key.includes("bain") ||
    key.includes("spa") ||
    key.includes("bien-etre") ||
    key.includes("bienetre") ||
    key.includes("bath") ||
    key.includes("wellness") ||
    key.includes("حمام") ||
    key.includes("سبا")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M4 12h16a2 2 0 0 1 2 2v2H2v-2a2 2 0 0 1 2-2zM5 12V8a3 3 0 0 1 3-3h2M19 12V8M7 18v2M17 18v2" />
      </svg>
    );
  }

  // KIDS / TOYS / NURSERY
  if (
    key.includes("enfant") ||
    key.includes("bebe") ||
    key.includes("bébé") ||
    key.includes("jouet") ||
    key.includes("kid") ||
    key.includes("child") ||
    key.includes("baby") ||
    key.includes("toy") ||
    key.includes("nursery") ||
    key.includes("اطفال") ||
    key.includes("رضع") ||
    key.includes("العاب")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
      </svg>
    );
  }

  // PLANTS / GARDEN / OUTDOOR
  if (
    key.includes("jardin") ||
    key.includes("plante") ||
    key.includes("exterior") ||
    key.includes("exterieur") ||
    key.includes("nature") ||
    key.includes("garden") ||
    key.includes("plant") ||
    key.includes("outdoor") ||
    key.includes("حديقه") ||
    key.includes("نباتات")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M12 22V12M12 12c0-4 3-7 7-7-1 4-3 7-7 7zM12 12c0-4-3-7-7-7 1 4 3 7 7 7z" />
      </svg>
    );
  }

  // STORAGE / ORGANIZATION
  if (
    key.includes("rangement") ||
    key.includes("organisation") ||
    key.includes("stockage") ||
    key.includes("boite") ||
    key.includes("boîte") ||
    key.includes("storage") ||
    key.includes("organization") ||
    key.includes("box") ||
    key.includes("container") ||
    key.includes("تخزين") ||
    key.includes("تنظيم")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
      </svg>
    );
  }

  // BEDROOM / BEDDING
  if (
    key === "lit" ||
    key.includes("lit ") ||
    key.includes("lit-") ||
    key.includes("chambre") ||
    key.includes("literie") ||
    key.includes("bedroom") ||
    key.includes("bed") ||
    key.includes("غرفه نوم") ||
    key.includes("سرير")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M3 7v10M3 12h18a2 2 0 0 1 2 2v3M3 17h20M7 12V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
      </svg>
    );
  }

  // PERFUME / SCENT / BEAUTY
  if (
    key.includes("parfum") ||
    key.includes("senteur") ||
    key.includes("beaute") ||
    key.includes("beauté") ||
    key.includes("cosmet") ||
    key.includes("perfume") ||
    key.includes("scent") ||
    key.includes("beauty") ||
    key.includes("cosmetic") ||
    key.includes("عطر") ||
    key.includes("جمال")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <path d="M9 3h6M10 3v4h4V3M8 7h8l2 14H6L8 7z" />
      </svg>
    );
  }

  // ART / FRAMES / WALL
  if (
    key === "art" ||
    key.includes("art ") ||
    key.includes("art-") ||
    key.includes("art/") ||
    key.includes("cadre") ||
    key.includes("tableau") ||
    key.includes("mur") ||
    key.includes("frame") ||
    key.includes("painting") ||
    key.includes("wall") ||
    key.includes("فن") ||
    key.includes("اطار") ||
    key.includes("لوحه")
  ) {
    return (
      <svg viewBox="0 0 24 24" className={common} {...stroke}>
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M8 4v-2M16 4v-2M8 22v-2M16 22v-2M4 8h-2M4 16h-2M22 8h-2M22 16h-2" />
      </svg>
    );
  }

  // DEFAULT: tag icon
  return (
    <svg viewBox="0 0 24 24" className={common} {...stroke}>
      <path d="M3 7v5l9 9 7-7-9-9H5a2 2 0 0 0-2 2Z" />
      <circle cx="7.5" cy="9.5" r="1" />
    </svg>
  );
}

export function Categories({ products, active, onSelect }: CategoriesProps) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [products]);

  if (categories.length === 0) return null;

  return (
    <section
      id="categories"
      className="px-4 py-4 sm:px-6 sm:py-6"
     
     
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          <button
            type="button"
            onClick={() => onSelect("")}
            className={`cat-btn ${active === "" ? "cat-active-default" : "cat-glow"} flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 font-arabic text-xs font-medium ${
              active === ""
                ? "border-blue-mid bg-blue-mid/10 text-blue-mid"
                : "border-clay/40 bg-white text-gray hover:border-gray/50 hover:text-charcoal"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelect(cat)}
                className={`cat-btn ${isActive ? activeAnim : "cat-glow"} flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 font-arabic text-xs font-medium ${
                  isActive
                    ? "border-blue-mid bg-blue-mid/10 text-blue-mid"
                    : "border-clay/40 bg-white text-gray hover:border-gray/50 hover:text-charcoal"
                }`}
              >
                <CategoryIcon name={cat} />
                <span className="line-clamp-1 text-center">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
