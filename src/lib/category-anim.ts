// Category-specific animation class helper.
// Maps an Arabic/French/English category name to a subtle hover animation class.
// Each class is defined in globals.css (.cat-anim-*).
//
// The animations are intentionally SIMPLE — a small transform on hover.
// This makes each category feel distinct without being complex or distracting.

export type CategoryAnim =
  | "auto"
  | "device"
  | "tool"
  | "decor"
  | "furniture"
  | "textile"
  | "kids"
  | "garden"
  | "beauty"
  | "art"
  | "default";

/**
 * Returns the cat-anim-* class name for a given product category.
 * Falls back to "default" (standard lift) when no match is found.
 */
export function getCategoryAnimClass(category: string): string {
  // Normalize: lowercase + strip Latin diacritics + strip Arabic diacritics
  // (hamza, tanwin, harakat) so that "أجهزة" matches "اجہزة" etc.
  const key = (category || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Latin combining marks
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // Arabic harakat + dagger alef + tatweel
    .replace(/[أإآا]/g, "ا") // normalize alef variants → bare alef
    .replace(/ى/g, "ي") // normalize alef maqsura → ya
    .replace(/ة/g, "ه") // normalize ta marbuta → ha
    .trim();

  // ---- AUTO / CAR ACCESSORIES ----
  // FR: voiture, auto, voiture
  // EN: car, auto, vehicle
  // AR: سيارة, إكسسوارات السيارة, اكسسوارات
  if (
    key.includes("voiture") ||
    key.includes("auto") ||
    key.includes("car ") ||
    key.includes("vehicle") ||
    key.includes("سياره") ||
    key.includes("السياره") ||
    key.includes("اكسسوارات") ||
    key.includes("اكسسوارات")
  ) {
    return "cat-anim-auto";
  }

  // ---- ELECTRONICS / DEVICES / APPLIANCES ----
  // FR: électroménager, electromenager, électrique, appareil, appareils
  // EN: electronic, appliance, electric, device
  // AR: أجهزة, كهربائي, جهاز
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
    return "cat-anim-device";
  }

  // ---- HOME TOOLS / UTENSILS / KITCHEN ----
  // FR: ustensile, cuisine, cuisson, four, marmite, casserole, outils
  // EN: kitchen, utensil, cookware, cook, pot, pan, tools
  // AR: مطبخ, أدوات, أدوات المنزل, قدر, طنجرة
  if (
    key.includes("ustens") ||
    key.includes("cuisin") ||
    key.includes("cuiss") ||
    key.includes("four") ||
    key.includes("marmit") ||
    key.includes("casser") ||
    key.includes("outils") ||
    key.includes("kitchen") ||
    key.includes("utensil") ||
    key.includes("cookware") ||
    key.includes("cook") ||
    key.includes("pot") ||
    key.includes("pan") ||
    key.includes("tools") ||
    key.includes("مطبخ") ||
    key.includes("ادوات") ||
    key.includes("ادوات المنزل") ||
    key.includes("قدر") ||
    key.includes("طنجره")
  ) {
    return "cat-anim-tool";
  }

  // ---- DECORATION / LAMPS / CANDLES ----
  // FR: déco, decoration, lampe, bougie, photophore, luminaire
  // EN: decor, lamp, light, candle, lighting
  // AR: ديكور, مصباح, شمعة
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
    return "cat-anim-decor";
  }

  // ---- FURNITURE / LIVING ROOM ----
  // FR: salon, mobilier, meuble, canapé, chaise
  // EN: salon, furniture, sofa, chair, living
  // AR: صالون, أثاث, كنبة, كرسي
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
    return "cat-anim-furniture";
  }

  // ---- TEXTILES / LINENS / CUSHIONS ----
  // FR: textile, linge, coussin, rideau, tapis, nappe, serviette
  // EN: textile, linen, cushion, curtain, rug, carpet, towel
  // AR: منسوجات, وسادة, ستارة, سجاد
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
    return "cat-anim-textile";
  }

  // ---- KIDS / TOYS / NURSERY ----
  // FR: enfant, bébé, jouet, chambre
  // EN: kid, child, baby, toy, nursery
  // AR: أطفال, رضع, ألعاب
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
    return "cat-anim-kids";
  }

  // ---- GARDEN / OUTDOOR / PLANTS ----
  // FR: jardin, plante, extérieur, nature
  // EN: garden, plant, outdoor, nature
  // AR: حديقة, نباتات
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
    return "cat-anim-garden";
  }

  // ---- BEAUTY / PERFUME / SCENT ----
  // FR: parfum, senteur, beauté, cosmétique
  // EN: perfume, scent, beauty, cosmetic
  // AR: عطر, جمال
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
    return "cat-anim-beauty";
  }

  // ---- ART / FRAMES / WALL ----
  // FR: art, cadre, tableau, mur, mural
  // EN: art, frame, painting, wall
  // AR: فن, إطار, لوحة
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
    return "cat-anim-art";
  }

  // ---- DEFAULT ----
  return "cat-anim-default";
}

/**
 * Returns the cat-active-* class name for a given product category.
 * This is applied when the category is SELECTED (active) in the category selector.
 * The class applies a simple, elegant transform that aligns with the category name.
 */
export function getCategoryActiveClass(category: string): string {
  // Reuse the same matching logic but return the active variant.
  const animClass = getCategoryAnimClass(category);
  // Convert "cat-anim-auto" → "cat-active-auto"
  return animClass.replace("cat-anim-", "cat-active-");
}
