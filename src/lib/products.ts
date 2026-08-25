// Product type, seed data, localStorage helpers
// Supports multi-image (up to ~8 images), variations, and Arabic descriptions.

import { BRAND } from "./brand-config";

export type Variation = {
  /** Variation name — e.g. "اللون", "الحجم", "السعة" */
  name: string;
  /** Options — e.g. ["أبيض", "أسود", "ذهبي"] */
  options: string[];
};

/** Simpler per-variant model — a single color, size, or custom variable
 * entry with optional price adjustment. */
export type ProductVariant = {
  /** Variant type: "color", "size", or any custom string (e.g. "weight", "material") */
  type: string;
  name: string;
  /** Added to the base price (can be 0 or negative). Optional. */
  priceAdjustment?: number;
  /** Optional per-variant stock count.
   *  - null/undefined = unlimited/unknown (use product-level stock)
   *  - 0 = out of stock (variant shows "نفدت الكمية")
   *  - N = N items left (triggers low-stock badge if 1-3)
   * Encoded in the variants string with a `|` separator: type:name:priceAdjustment|stock
   * Backward compatible — old 3-field strings (no `|`) parse with stock = undefined. */
  stock?: number | null;
};

/** Quantity tier — a special offer triggered by the customer's order quantity.
 * A tier can combine a free-shipping benefit AND a discount amount (or just one, or both).
 *
 * Two modes:
 *  - `mode: "exact"`   → triggers ONLY at exactly `qty` (e.g. "buy exactly 2 → free desk shipping")
 *  - `mode: "min"`     → triggers at `qty` OR MORE (e.g. "buy 2+ → free shipping")
 *
 * The `mode` field is optional — if absent, the tier is treated as "exact" (backward compat).
 * Sheet encoding: `qty:freeShipping:discountAmount:mode`
 *   e.g. `2:both:0:min` = buy 2 or more → free shipping (both) + no discount
 *        `3:none:500:exact` = buy exactly 3 → 500 DA discount, no free shipping
 *        `2:desk:0` = buy exactly 2 → free desk shipping (legacy format, no mode = "exact")
 */
export type QuantityTier = {
  /** The quantity that triggers this tier (e.g. 2, 3, 4) */
  qty: number;
  /** Whether the tier triggers at exactly `qty` ("exact") or `qty` and above ("min"). */
  mode?: "exact" | "min";
  /** Free-shipping benefit. "none" = no free shipping, just discount. */
  freeShipping: "none" | "desk" | "home" | "both";
  /** Optional discount amount in DA (0 / undefined = no discount) */
  discountAmount?: number;
};

/** Old benefit values used by the previous tier format. Kept for backward-compat parsing. */
type LegacyTierBenefit = "free_desk" | "free_home" | "free_both" | "discount";

/** Map an old-format tier benefit to the new {freeShipping, discountAmount} shape. */
function migrateLegacyBenefit(
  benefit: LegacyTierBenefit,
  discountAmount?: number,
): { freeShipping: QuantityTier["freeShipping"]; discountAmount?: number } {
  switch (benefit) {
    case "free_desk":
      return { freeShipping: "desk" };
    case "free_home":
      return { freeShipping: "home" };
    case "free_both":
      return { freeShipping: "both" };
    case "discount":
    default:
      return { freeShipping: "none", discountAmount };
  }
}

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  /** Optional old price (shown with strikethrough, smaller, to show a discount). */
  oldPrice?: number | null;
  image: string;
  images?: string[];
  featured: boolean;
  inStock: boolean;
  /** Whether this product is shown in the "Special Offers" section on the home page. */
  isSpecialOffer?: boolean;
  /** Optional variations (color, size, etc.) — empty array if none. Kept for backward-compat. */
  variations?: Variation[];
  /** Simpler per-variant list (colors + sizes with optional price adjustments).
   * Replaces `variations` in the admin UI. */
  variants?: ProductVariant[];
  /** Optional stock count — null = unlimited/unknown, 0 = out of stock. */
  stock?: number | null;
  /** Optional bullet highlights (key selling points) shown on the product page. */
  highlights?: string[];
  /** Sort order — lower = appears first in catalog. Default 999 (bottom). */
  sortOrder?: number;
  /** Optional badge text (e.g. "عرض خاص") displayed on cards and product page. */
  badge?: string;
  /** Optional quantity tiers — special offers at specific quantities */
  quantityTiers?: QuantityTier[];
};

export const CATALOG_STORAGE_KEY = BRAND.storage.catalog; // e.g. "rokn_catalog_v2"
export const CART_STORAGE_KEY = BRAND.storage.cart;

/** Hard cap on the total images string length, to fit Google Sheets' 50K cell limit. */
export const IMAGES_TOTAL_CHAR_CAP = 47000;

/** Separator for multiple images in the sheet cell (triple tilde) */
export const IMAGE_SEPARATOR = "~~~";

/** Separator for variations in the sheet cell (double semicolon) */
export const VARIATIONS_SEPARATOR = ";;";

/** Separator between variation name and options (double colon) */
export const VARIATION_NAME_SEP = "::";

/** Separator between options within a variation (double comma) */
export const VARIATION_OPT_SEP = ",,";

/** Separator between variants in the sheet cell (single comma — names can't
 * contain commas in practice; if they do, swap for a different token). */
export const VARIANT_SEP = ",";

export const SEED_PRODUCTS: Product[] = [
  {
    id: "nouveau-5bzz3",
    name: "Service a table Blanc Luxe",
    description: "Service a table 24p \nModel: Blanc luxe \nMatière: Porcelaine \nProduit : Importation ",
    category: "arts de la table",
    price: 16600,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035210/nouveau-5bzz3-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783035210/nouveau-5bzz3-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035210/nouveau-5bzz3-2.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035211/nouveau-5bzz3-3.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035211/nouveau-5bzz3-4.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035212/nouveau-5bzz3-5.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 1,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-8a9wk",
    name: "Service a table Blanc luxe doré",
    description: "Service a table 24p \nModel: Blanc luxe doré \nMatière: Porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035768/nouveau-8a9wk-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783035768/nouveau-8a9wk-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036606/nouveau-8a9wk-2.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036607/nouveau-8a9wk-3.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036607/nouveau-8a9wk-4.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 2,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-ee3tk",
    name: "Service a table Blanc luxe avec reliefs",
    description: "Service a table 24p \nModel: Blanc Luxe avec reliefs \nMatière: porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 15500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783035898/nouveau-ee3tk-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783035898/nouveau-ee3tk-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036645/nouveau-ee3tk-2.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036646/nouveau-ee3tk-3.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036646/nouveau-ee3tk-4.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 3,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-q7hs2",
    name: "Service a table Blanc cassé gris",
    description: "Service a table 24p \nModel: Blanc cassé gris \nMatière: Porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 14500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036231/nouveau-q7hs2-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783036231/nouveau-q7hs2-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036671/nouveau-q7hs2-2.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036672/nouveau-q7hs2-3.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036672/nouveau-q7hs2-4.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 4,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-c8e66",
    name: "Service a table beige luxe",
    description: "Service a table 24p \nModel: Beige luxe \nMatière: Céramique \nProduit importation ",
    category: "arts de la table",
    price: 16000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036302/nouveau-c8e66-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783036302/nouveau-c8e66-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036694/nouveau-c8e66-2.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036695/nouveau-c8e66-3.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783036695/nouveau-c8e66-4.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 5,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-7tdxy",
    name: "Service a café au lait A",
    description: "Service a café au lait 15P \nModel: A\nMatière: Porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 10000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783037715/nouveau-7tdxy-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783037715/nouveau-7tdxy-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 6,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-ve70v",
    name: "Service a table avec motifs",
    description: "Service a table de 24 pièces \nMatière porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 11400,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783130816/nouveau-ve70v-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783130816/nouveau-ve70v-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 7,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-fudxe",
    name: "Service a table motif gris",
    description: "Service a table de 24 pièces \nMatière porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 11400,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783131054/nouveau-fudxe-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783131054/nouveau-fudxe-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 8,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-lbzkm",
    name: "Service a table Blue",
    description: "Service a table 24p \nModel: Blue\nMatière: Porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783589977/nouveau-lbzkm-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783589977/nouveau-lbzkm-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1783589978/nouveau-lbzkm-2.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 9,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-qy4gc",
    name: "Service a table Blanc luxe doré ref02",
    description: "Service a table 24p \nModel: Blanc luxe doré \nMatière: Porcelaine \nProduit importation ",
    category: "arts de la table",
    price: 11400,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784566494/nouveau-qy4gc-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784566494/nouveau-qy4gc-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 10,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-n9bpq",
    name: "Service a table 24p vert",
    description: "Apportez une touche d'élégance et de modernité à votre table avec ce magnifique service à table de 24 pièces en céramique de haute qualité. Son design raffiné, sa finition brillante et ses différentes couleurs s'intègrent parfaitement à tous les styles de décoration, du classique au contemporain.\nFabriqué en céramique résistante, ce service est conçu pour un usage quotidien tout en conservant son éclat et sa solidité au fil du temps. Grâce à sa finition soignée et à sa qualité supérieure, il est idéal aussi bien pour les repas en famille que pour recevoir vos invités.\nCaractéristiques :\n✔️ Service à table complet de 24 pièces\n✔️ Matière : Céramique premium\n✔️ Produit d'importation\n✔️ Disponible en différentes couleurs\n✔️ Finition brillante et élégante\n✔️ Très bonne résistance aux rayures et à l'usage quotidien\n✔️ Facile à nettoyer\n✔️ Convient à un usage quotidien et aux occasions spéciales\n✔️ Design moderne et intemporel\n✔️ Excellente qualité de fabrication\n✨ Disponible en stock.\n🚚 Livraison disponible dans toutes les wilayas.",
    category: "arts de la table",
    price: 16500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784840229/nouveau-n9bpq-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784840229/nouveau-n9bpq-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 11,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-wlcgv",
    name: "Coussin de voyage (Rose)",
    description: "Matière : silicone en fibre \nProduit local de très bonne qualité très souple ",
    category: "Coussins",
    price: 1200,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783103366/nouveau-wlcgv-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783103366/nouveau-wlcgv-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 12,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-662bx",
    name: "Coussin de voyage (Marron)",
    description: "Matière : silicone en fibre \nProduit local de très bonne qualité très souple ",
    category: "Coussins",
    price: 1200,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783103424/nouveau-662bx-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783103424/nouveau-662bx-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 13,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-jo3g2",
    name: "Mixeur plongeant Cristor HB- K55GN",
    description: "Vous rêvez d'une cuisine plus simple, rapide et efficace ? Ne cherchez plus ! Découvrez le compagnon idéal de toutes vos préparations culinaires : le Mixeur Plongeant 3-en-1 de Cristor. \n🥣✨\nQue ce soit pour de délicieux soupes, des smoothies vitaminés ou des pâtisseries réussies, il sait TOUT faire !\n\n💡 Pourquoi vous allez l'adorer ? (Ses caractéristiques)\nModèle performant : Référence HB-K55GN, conçu pour durer.\nMultifonction 3-en-1 : Un seul appareil pour trois actions indispensables :\n\nMélanger (pour vos veloutés, sauces et smoothies lisses).\n\nCouper / Hacher (grâce à son mini-hachoir inclus, parfait pour les oignons, herbes et viandes).\n\nFouetter (avec son fouet ballon pour des blancs en neige et des crèmes bien fermes).\n\nAccessoires inclus : Livré avec son verre doseur pratique pour mesurer et mixer directement dedans.\n\nDesign ergonomique : Une prise en main confortable et un look moderne gris/inox qui sublime votre cuisine.\n\nGarantie Sérénité : Profitez d'une garantie de 12 mois (1 an) pour cuisiner l'esprit tranquille ! 🛡️\n\n📦 Contenu de la boîte :\nLe bloc moteur du mixeur plongeant (Cristor)\nLe pied mixeur en inox\nLe bol hachoir avec ses lames performantes\nLe fouet adaptable\nLe verre doseur transparent\n\n📲 Commandez dès maintenant !\n📩 Prix et commande en DM (Message Privé) ou laissez un commentaire sous ce post !\n\n🚚 Livraison disponible (préciser vos conditions de livraison, ex: Livraison 58 wilayas disponible / Paiement à la livraison).\n\n#Cristor #MixeurPlongeant #CuisineFacile #RobotCuisine Electromenager Mixeur3en1 AstuceCuisine CuisineAlgérie EquipementMaison SmoothieTime Garantie1An RobotMultifonction",
    category: "Électroménager",
    price: 6000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784652947/nouveau-jo3g2-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784652947/nouveau-jo3g2-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 14,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-0brgt",
    name: "🍹 CRISTOR BLEND-IT : Noir",
    description: "Votre nouvel allié fraîcheur & cuisine ! 🌟\nVous rêvez de smoothies parfaits, de jus vitaminés ou d'épices fraîchement moulues en un clin d'œil ? Le mixeur Cristor Blend-it est fait pour vous !\n\nDisponible en deux coloris élégants (Noir chic 🖤 ou Blanc épuré 🤍) pour s'adapter parfaitement à votre cuisine.\n\nPourquoi vous allez l'adorer ?\n\n💪 Puissance optimale : 600W pour mixer sans effort tous vos ingrédients.\n\n🍹 Grande capacité : Un bol de 1.5 Litres, idéal pour toute la famille.\n\n⚙️ Multi-vitesses : 2 niveaux de vitesse pour un contrôle total de vos textures.\n\n🔪 Haute qualité : Lames en acier inoxydable ultra-résistantes.\n\n🔒 Sécurité garantie : Équipé d'un système de verrouillage de sécurité.\n\n☕ Le petit + : Livré avec son moulin à épices/café intégré !\n\n🛡️ Sérénité : Garantie de 12 mois (1 an).\n\n👉 Commandez le vôtre dès maintenant ! Les stocks sont limités.\n",
    category: "Électroménager",
    price: 6500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784653111/nouveau-0brgt-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784653111/nouveau-0brgt-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 15,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-emw96",
    name: "🍹 CRISTOR BLEND-IT : Blanc",
    description: "🍹 CRISTOR BLEND-IT : \nVotre nouvel allié fraîcheur & cuisine ! 🌟\nVous rêvez de smoothies parfaits, de jus vitaminés ou d'épices fraîchement moulues en un clin d'œil ? Le mixeur Cristor Blend-it est fait pour vous !\n\nDisponible en deux coloris élégants (Noir chic 🖤 ou Blanc épuré 🤍) pour s'adapter parfaitement à votre cuisine.\n\nPourquoi vous allez l'adorer ?\n\n💪 Puissance optimale : 600W pour mixer sans effort tous vos ingrédients.\n\n🍹 Grande capacité : Un bol de 1.5 Litres, idéal pour toute la famille.\n\n⚙️ Multi-vitesses : 2 niveaux de vitesse pour un contrôle total de vos textures.\n\n🔪 Haute qualité : Lames en acier inoxydable ultra-résistantes.\n\n🔒 Sécurité garantie : Équipé d'un système de verrouillage de sécurité.\n\n☕ Le petit + : Livré avec son moulin à épices/café intégré !\n\n🛡️ Sérénité : Garantie de 12 mois (1 an).\n\n👉 Commandez le vôtre dès maintenant ! Les stocks sont limités.\n",
    category: "Électroménager",
    price: 6500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784653167/nouveau-emw96-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784653167/nouveau-emw96-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 16,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-9h0mz",
    name: "Cocotte minute 06 litres Ref 01",
    description: "Cocotte-Minute NARDI – Qualité Italienne 🇮🇹\n\nDécouvrez la cocotte-minute NARDI, conçue en acier inoxydable de haute qualité pour une cuisson rapide, sûre et économique. Disponible en 6 L, 8 L, 10 L et 12 L, avec panier vapeur ou couscoussier selon le modèle. Compatible avec tous les types de feux, y compris l'induction, elle est dotée d'un système de sécurité renforcé et de poignées ergonomiques. \n\nUn choix idéal pour préparer facilement couscous, viandes, légumes, soupes et bien plus encore.\n\n✔️ Marque italienne\n✔️ Acier inoxydable de haute qualité\n✔️ 6L, 8L, 10L et 12L\n✔️ Avec panier vapeur ou couscoussier\n✔️ Compatible tous feux, y compris induction\n✔️ Garantie 12 mois",
    category: "Cuisine",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783965686/nouveau-9h0mz-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783965686/nouveau-9h0mz-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 17,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-cxtbh",
    name: "Cocotte minute 06 Litres Ref 01",
    description: "Cocotte-Minute NARDI – Qualité Italienne 🇮🇹\n\nDécouvrez la cocotte-minute NARDI, conçue en acier inoxydable de haute qualité pour une cuisson rapide, sûre et économique. Disponible en 6 L, 8 L, 10 L et 12 L, avec panier vapeur ou couscoussier selon le modèle. Compatible avec tous les types de feux, y compris l'induction, elle est dotée d'un système de sécurité renforcé et de poignées ergonomiques.\n Un choix idéal pour préparer facilement couscous, viandes, légumes, soupes et bien plus encore.\n\n✔️ Marque italienne\n✔️ Acier inoxydable de haute qualité\n✔️ 6L, 8L, 10L et 12L\n✔️ Avec panier vapeur ou couscoussier\n✔️ Compatible tous feux, y compris induction\n✔️ Garantie 12 mois",
    category: "Cuisine",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784032383/nouveau-cxtbh-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784032383/nouveau-cxtbh-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 18,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-a7qtb",
    name: "Cocotte minute 06 Litres Ref 03",
    description: "Cocotte-Minute NARDI – Qualité Italienne 🇮🇹\n\nDécouvrez la cocotte-minute NARDI, conçue en acier inoxydable de haute qualité pour une cuisson rapide, sûre et économique. Disponible en 6 L, 8 L, 10 L et 12 L, avec panier vapeur ou couscoussier selon le modèle. Compatible avec tous les types de feux, y compris l'induction, elle est dotée d'un système de sécurité renforcé et de poignées ergonomiques. \nUn choix idéal pour préparer facilement couscous, viandes, légumes, soupes et bien plus encore.\n\n✔️ Marque italienne\n✔️ Acier inoxydable de haute qualité\n✔️ 6L, 8L, 10L et 12L\n✔️ Avec panier vapeur ou couscoussier\n✔️ Compatible tous feux, y compris induction\n✔️ Garantie 12 mois",
    category: "Cuisine",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784033455/nouveau-a7qtb-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784033455/nouveau-a7qtb-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 19,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-bxauf",
    name: "Cocotte minute 06 Litres Ref 04",
    description: "Cocotte-Minute NARDI – Qualité Italienne 🇮🇹\n\nDécouvrez la cocotte-minute NARDI, conçue en acier inoxydable de haute qualité pour une cuisson rapide, sûre et économique. Disponible en 6 L, 8 L, 10 L et 12 L, avec panier vapeur ou couscoussier selon le modèle. Compatible avec tous les types de feux, y compris l'induction, elle est dotée d'un système de sécurité renforcé et de poignées ergonomiques. \n\nUn choix idéal pour préparer facilement couscous, viandes, légumes, soupes et bien plus encore.\n\n✔️ Marque italienne\n✔️ Acier inoxydable de haute qualité\n✔️ 6L, 8L, 10L et 12L\n✔️ Avec panier vapeur ou couscoussier\n✔️ Compatible tous feux, y compris induction\n✔️ Garantie 12 mois",
    category: "Cuisine",
    price: 15000,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784034124/nouveau-bxauf-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784034124/nouveau-bxauf-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 20,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-44rrv",
    name: "Miroir Noir",
    description: "MIROIR\nÉlégance et Simplicité\n\nCe miroir allie simplicité et élégance grâce à son cadre en résine de haute qualité avec une finition noire. Son design moderne et intemporel s'intègre parfaitement à tous les styles de décoration. Idéal pour agrandir visuellement votre espace tout en apportant une touche d'élégance à votre intérieur.\n\nDimensions :\n30 × 90 cm\nCadre : Résine, finition noire\nStyle : Moderne & intemporel\n\n\nUtilisation : Chambre, entrée, salon, dressing, couloir, bureau.\n",
    category: "Miroirs",
    price: 3750,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784811313/nouveau-44rrv-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784811313/nouveau-44rrv-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 21,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-pmr6e",
    name: "Jarr Terracotta",
    description: "Jarre décorative en poterie – Terre cuite\n\nApportez une touche authentique et chaleureuse à votre intérieur avec cette magnifique jarre décorative en terre cuite. \n\nSon style artisanal, sa finition texturée effet vieilli et sa teinte terracotta en font une pièce de décoration idéale pour les salons, les entrées, les terrasses couvertes ou les espaces bohèmes et méditerranéens.\n\nElle est parfaite pour accueillir des fleurs séchées, des épis de blé, des pampas ou être exposée seule comme objet décoratif.\n\nCaractéristiques :\nMatière : Poterie en terre cuite\nHauteur : 50 cm\nCouleur : Terracotta effet vieilli\nStyle : Rustique, bohème, méditerranéen\nUtilisation : Décoration intérieure et extérieure abritée\nIdéale pour : Fleurs séchées, pampas, épis de blé ou décoration seule\nUne pièce élégante et intemporelle qui apportera du charme et du caractère à votre décoration.",
    category: "Décoration",
    price: 4250,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784803055/nouveau-pmr6e-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784803055/nouveau-pmr6e-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 22,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-lzuvt",
    name: "Vase décoratif en poterie texturée – Blanc –",
    description: "\nApportez une touche de pureté et d'élégance à votre décoration intérieure avec ce magnifique vase décoratif en poterie. Sa couleur blanche intemporelle et sa finition texturée en relief en font une pièce raffinée qui s'intègre parfaitement dans tous les styles d'intérieur.\n\nHauteur : 50 cm (sans les fleurs ni les tiges décoratives)\nMatière : Poterie de haute qualité\nCouleur : Blanc\nFinition : Effet texturé en relief\nStyle : Moderne, minimaliste et contemporain\n\nUtilisation : Idéal pour accueillir des fleurs séchées, des branches décoratives ou comme objet de décoration à lui seul.\n\nEntretien : Se nettoie facilement avec un chiffon doux et sec.\n\nAvec son design sobre et élégant, ce vase est parfait pour embellir un salon, une chambre, une entrée ou un bureau. Associé à des fleurs séchées ou des tiges décoratives, il apporte une ambiance chic, chaleureuse et harmonieuse à votre intérieur.",
    category: "Décoration",
    price: 2500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784835618/nouveau-lzuvt-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784835618/nouveau-lzuvt-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 23,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-1scst",
    name: "Veilleuse cylindrique BB",
    description: "Veilleuse cylindrique en céramique Abat jour en tissu plessis lavable Model: 16c\nHauteur: 35cm ",
    category: "Lampe de chevet",
    price: 4500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784483906/nouveau-1scst-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784483906/nouveau-1scst-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 24,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-jpc5h",
    name: "Veilleuse OVNI",
    description: "Veilleuse décorative OVNI en céramique – Blanc neige – 50 cm\n\nApportez une touche de luminosité et d'élégance à votre intérieur avec cette magnifique veilleuse décorative en céramique. Son design en forme d'OVNI, sa finition blanc neige et ses accessoires dorés lui confèrent un style chic et intemporel, parfait pour sublimer tous les espaces de votre maison.\n\nCaractéristiques :\nHauteur totale : 50 cm\nMatière du pied : Céramique de haute qualité\nCouleur : Blanc neige\nDesign : Forme OVNI\nFinition : Accessoires métalliques dorés\nAbat-jour : Cylindrique\nMatière de l'abat-jour : Tissu plissé lavable\nOrigine : Produit d'importation\n\nAvec son design moderne et ses finitions soignées, cette veilleuse apporte une ambiance chaleureuse et raffinée à votre salon, votre chambre ou votre bureau. Élégante aussi bien allumée qu'éteinte, elle constitue un véritable objet de décoration qui s'harmonise parfaitement avec tous les styles d'intérieur.",
    category: "Lampe de chevet",
    price: 6200,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784826143/nouveau-jpc5h-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784826143/nouveau-jpc5h-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1784826143/nouveau-jpc5h-2.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 25,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-vbva0",
    name: "Veilleuse BB8",
    description: "Veilleuse de table BB8 – Petit modèle\n\nApportez une touche d'élégance et de douceur à votre intérieur avec cette magnifique veilleuse BB8 petit modèle. Elle est dotée d'un pied en céramique composé de deux sphères à la finition brillante, sublimé par des détails dorés qui lui donnent un style chic et intemporel.\n\nSon abat-jour conique en tissu plissé, de couleur blanc cassé, diffuse une lumière douce et agréable. Le tissu est lavable, ce qui facilite son entretien tout en conservant son aspect élégant.\n\nCaractéristiques :\n- Modèle : BB8 – Petit modèle\n- Hauteur 45cm \n- Pied : Double céramique de haute qualité\n- Abat-jour : Conique en tissu plissé lavable\n- Couleur de l'abat-jour : Blanc cassé\n- Finition : Dorée\n- Style : Moderne, élégant et raffiné\n\nIdéale pour : Salon, chambre à coucher, table de chevet, bureau ou espace de décoration.\n\nCette veilleuse s'intègre parfaitement à tous les styles d'intérieur et apporte une ambiance chaleureuse et raffinée à votre maison.",
    category: "Lampe de chevet",
    price: 5800,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784826250/nouveau-vbva0-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784826250/nouveau-vbva0-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1784826251/nouveau-vbva0-2.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 26,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-t6wy8",
    name: "Porte manteaux (Rose)",
    description: "Matière bois rouge de très bonne qualité \nDimensions 52*11cm \nCouleur : Blanc Rose ",
    category: "Meubes",
    price: 2200,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1783103521/nouveau-t6wy8-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1783103521/nouveau-t6wy8-1.jpg"],
    featured: false,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 27,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-c3bjf",
    name: "Meuble de salle de bain et cuisine en bois – Élégance & praticité",
    description: "\nApportez une touche chaleureuse et naturelle à votre salle de bain avec ce magnifique meuble de rangement au design moderne et épuré. Conçu pour allier esthétique et fonctionnalité, il offre une grande capacité de rangement tout en sublimant votre espace.\n\nCaractéristiques :\n\n📏 Dimensions : 110 × 110 cm (hauteur × largeur)\n\n🌳 Structure et portes : Bois de hêtre robuste et résistant\n\n🪵 Étagères : MDF de très haute qualité, solide et durable\n\n🚪 2 portes pour un rangement discret et organisé\n\n🧺 2 paniers de rangement en tissu inclus\n\n📚 Étagères ouvertes pour un rangement pratique\n\n🎨 Style : Scandinave, moderne et naturel\n\n🏡 Idéal pour : Salle de bain, buanderie ou espace de rangement.\n\n🚚 Livraison disponible dans les 58 wilayas.\n\n✨ SOUM DÉCO – L'élégance au cœur de votre maison.",
    category: "Meubes",
    price: 17250,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784832581/nouveau-c3bjf-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784832581/nouveau-c3bjf-1.jpg", "https://res.cloudinary.com/anhvhy4j/image/upload/v1784832581/nouveau-c3bjf-2.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 28,
    badge: "",
    stock: null,
  },
  {
    id: "nouveau-nbcsa",
    name: "Meuble de rangements Ref01",
    description: "Meuble de rangements de trois étages \nMatière : Mdf \nHauteur : 1m03cm \nLargeur: 35cm \nProfondeur: 35 \nPoids: 22 kilos \nÉtagères: 31*30*30cm ",
    category: "Meubes",
    price: 15500,
    image: "https://res.cloudinary.com/anhvhy4j/image/upload/v1784832741/nouveau-nbcsa-1.jpg",
    images: ["https://res.cloudinary.com/anhvhy4j/image/upload/v1784832741/nouveau-nbcsa-1.jpg"],
    featured: true,
    inStock: true,
    isSpecialOffer: false,
    variations: [],
    variants: [],
    highlights: [],
    sortOrder: 29,
    badge: "",
    stock: null,
  },
];

export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "السعر عند الطلب";
  // Guard against NaN (from Number("abc") or malformed sheet data)
  if (typeof price !== "number" || isNaN(price)) return "السعر عند الطلب";
  return `${price.toLocaleString("fr-FR")} دج`;
}

/**
 * Get all images for a product (always returns at least one entry,
 * or an empty array if the product has no image at all).
 */
export function getProductImages(p: Product): string[] {
  if (Array.isArray(p.images) && p.images.length > 0) {
    return p.images.filter((i) => i && i.trim() !== "");
  }
  if (p.image && p.image.trim() !== "") return [p.image];
  return [];
}

/**
 * Split the `images` string from the sheet into an array of image URLs.
 * Handles triple-tilde (new), triple-pipe (legacy), and comma-separated formats.
 */
function splitImageStrings(s: string): string[] {
  if (!s) return [];
  const trimmed = s.trim();
  if (!trimmed) return [];

  if (trimmed.includes("~~~")) {
    return trimmed.split("~~~").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("|||")) {
    return trimmed.split("|||").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("|")) {
    return trimmed.split("|").map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes("data:")) {
    return trimmed.split(/,(?=data:)/).map((x) => x.trim()).filter((x) => x !== "");
  }
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((x) => x.trim()).filter((x) => x !== "");
  }
  return [trimmed];
}

/**
 * Join an array of image URLs into a single string for sheet storage.
 * Uses ~~~ (triple tilde) — safe in base64 content and URLs.
 */
export function joinImageStrings(images: string[]): string {
  return images.filter((s) => s && s.trim() !== "").join("~~~");
}

/** Parse the variations string from the sheet into an array of Variation objects. */
export function parseVariations(s: string | undefined | null): Variation[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  try {
    const parts = trimmed.split(VARIATIONS_SEPARATOR).map((x) => x.trim()).filter(Boolean);
    const out: Variation[] = [];
    for (const part of parts) {
      const [name, optsStr] = part.split(VARIATION_NAME_SEP);
      if (!name || !optsStr) continue;
      const options = optsStr.split(VARIATION_OPT_SEP).map((o) => o.trim()).filter(Boolean);
      if (options.length > 0) out.push({ name: name.trim(), options });
    }
    return out;
  } catch {
    return [];
  }
}

/** Join an array of Variation objects into a single string for sheet storage. */
export function joinVariations(vars: Variation[] | undefined | null): string {
  if (!Array.isArray(vars) || vars.length === 0) return "";
  return vars
    .filter((v) => v && v.name && Array.isArray(v.options) && v.options.length > 0)
    .map((v) => `${v.name}${VARIATION_NAME_SEP}${v.options.join(VARIATION_OPT_SEP)}`)
    .join(VARIATIONS_SEPARATOR);
}

/** Parse the `variants` string from the sheet into a `ProductVariant[]`.
 * Format: `type:name:priceAdjustment,type:name:priceAdjustment` (comma-separated).
 * The priceAdjustment is optional (defaults to 0). Type must be "color" or "size".
 * Names containing commas are NOT supported (would need a different separator). */
export function parseVariants(s: string | undefined | null): ProductVariant[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  const out: ProductVariant[] = [];
  for (const part of trimmed.split(VARIANT_SEP)) {
    const clean = part.trim();
    if (!clean) continue;

    // NEW: Extract optional `|stock` suffix BEFORE parsing the rest.
    // Format: type:name:priceAdjustment|stock
    // The `|` separator was chosen because:
    //  - Not used in any existing variant data (verified across all 9 products)
    //  - Doesn't conflict with `:` (within entries) or `,` (between entries)
    //  - Old strings without `|` → stock = undefined → unlimited (backward compat)
    let stock: number | null | undefined = undefined;
    let mainPart = clean;
    const pipeIdx = clean.lastIndexOf("|");
    if (pipeIdx >= 0) {
      const stockStr = clean.slice(pipeIdx + 1).trim();
      mainPart = clean.slice(0, pipeIdx).trim();
      if (stockStr === "" || stockStr.toLowerCase() === "null") {
        stock = null; // explicitly unlimited
      } else {
        const stockNum = Number(stockStr);
        if (!isNaN(stockNum) && stockNum >= 0) {
          stock = stockNum;
        }
        // If not a valid number, leave stock = undefined (treat as no stock field)
      }
    }

    // Split from the LEFT into at most 3 parts: type, name, priceAdjustment.
    // Names CAN contain colons (rare but possible); the priceAdjustment is the
    // LAST segment.
    const firstColon = mainPart.indexOf(":");
    if (firstColon < 0) continue;
    const type = mainPart.slice(0, firstColon).trim();
    if (!type) continue; // accept any non-empty type (color, size, or custom)
    const rest = mainPart.slice(firstColon + 1);
    const lastColon = rest.lastIndexOf(":");
    let name: string;
    let adjustment = 0;
    if (lastColon < 0) {
      name = rest.trim();
    } else {
      const maybeNum = Number(rest.slice(lastColon + 1));
      if (isNaN(maybeNum)) {
        name = rest.trim();
      } else {
        name = rest.slice(0, lastColon).trim();
        adjustment = maybeNum;
      }
    }
    if (!name) continue;
    out.push({
      type: type as "color" | "size",
      name,
      priceAdjustment: adjustment,
      // Only include stock if it was explicitly set (undefined = not in string)
      ...(stock !== undefined ? { stock } : {}),
    });
  }
  return out;
}

/** Join a `ProductVariant[]` into a single string for sheet storage. */
export function joinVariants(variants: ProductVariant[] | undefined | null): string {
  if (!Array.isArray(variants) || variants.length === 0) return "";
  return variants
    .filter((v) => v && v.type && v.name)
    .map((v) => {
      const base = `${v.type}:${v.name}:${Number(v.priceAdjustment ?? 0)}`;
      // Only append `|stock` if stock is explicitly set (number, including 0)
      // null/undefined → omit (unlimited, backward compat with old strings)
      if (typeof v.stock === "number" && !isNaN(v.stock) && v.stock >= 0) {
        return `${base}|${v.stock}`;
      }
      return base;
    })
    .join(VARIANT_SEP);
}

/** Normalize a raw variants value (array from localStorage / sheet JSON or
 * encoded string) into a clean `ProductVariant[]`. */
export function normalizeVariants(raw: unknown): ProductVariant[] {
  if (Array.isArray(raw)) {
    return (raw as any[])
      .filter((v) => v && typeof v === "object" && v.name)
      .map((v) => {
        // Preserve any type string (color, size, or custom like "weight")
        const type = String(v.type || "custom");
        const adj =
          v.priceAdjustment == null
            ? undefined
            : Number(v.priceAdjustment);
        // Preserve stock field if present (null or number)
        const stockRaw = v.stock;
        let stock: number | null | undefined = undefined;
        if (stockRaw === null) {
          stock = null;
        } else if (stockRaw !== undefined && stockRaw !== "") {
          const s = Number(stockRaw);
          if (!isNaN(s) && s >= 0) stock = s;
        }
        return {
          type,
          name: String(v.name),
          priceAdjustment: typeof adj === "number" && !isNaN(adj) ? adj : undefined,
          ...(stock !== undefined ? { stock } : {}),
        };
      })
      .filter((v) => v.name.trim() !== "");
  }
  if (typeof raw === "string") {
    return parseVariants(raw);
  }
  return [];
}

/** Parse the highlights string from the sheet (newline-separated). */
export function parseHighlights(s: string | undefined | null): string[] {
  if (!s || typeof s !== "string") return [];
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Join an array of highlight strings into a single string for sheet storage. */
export function joinHighlights(items: string[] | undefined | null): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.filter((x) => x && x.trim()).join("\n");
}

/** Parse the quantityTiers string from the sheet into an array of QuantityTier objects.
 * New format with mode: "2:both:0:min,3:desk:500:exact" (qty:freeShipping:discountAmount:mode)
 * New format without mode: "2:both:200,3:desk:0" (mode defaults to "exact")
 * Legacy format (still supported for back-compat with existing sheet rows):
 *   "2:free_both:0,3:discount:200" (qty:benefit:discountAmount) */
export function parseQuantityTiers(s: string | undefined | null): QuantityTier[] {
  if (!s || typeof s !== "string") return [];
  const trimmed = s.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(",").map((x) => x.trim()).filter(Boolean);
  const out: QuantityTier[] = [];
  const newShippingTokens: QuantityTier["freeShipping"][] = ["none", "desk", "home", "both"];
  const legacyBenefits: LegacyTierBenefit[] = ["free_desk", "free_home", "free_both", "discount"];
  const modeTokens: QuantityTier["mode"][] = ["exact", "min"];
  for (const part of parts) {
    const [qtyStr, middle, discountStr, modeStr] = part.split(":");
    const qty = Number(qtyStr);
    if (isNaN(qty) || qty < 1) continue;
    const discount = Number(discountStr) || 0;
    const mode: QuantityTier["mode"] =
      modeStr === "min" ? "min" : modeStr === "exact" ? "exact" : "exact";
    if (newShippingTokens.includes(middle as QuantityTier["freeShipping"])) {
      out.push({
        qty,
        mode,
        freeShipping: middle as QuantityTier["freeShipping"],
        discountAmount: discount > 0 ? discount : undefined,
      });
    } else if (legacyBenefits.includes(middle as LegacyTierBenefit)) {
      const migrated = migrateLegacyBenefit(middle as LegacyTierBenefit, discount > 0 ? discount : undefined);
      out.push({
        qty,
        mode,
        freeShipping: migrated.freeShipping,
        discountAmount: migrated.discountAmount,
      });
    } else {
      // Unknown token — default to no benefit so the tier is still preserved.
      out.push({
        qty,
        mode,
        freeShipping: "none",
        discountAmount: discount > 0 ? discount : undefined,
      });
    }
  }
  return out;
}

/** Normalize a raw quantityTiers value (from localStorage, sheet JSON, or the API)
 * into the new QuantityTier shape. Handles:
 *  - arrays already in the new format ({qty, freeShipping, discountAmount?, mode?})
 *  - arrays in the legacy format ({qty, benefit, discountAmount?}) → migrate
 *  - string in new or legacy sheet format → parseQuantityTiers
 */
export function normalizeTiers(raw: unknown): QuantityTier[] {
  if (Array.isArray(raw)) {
    const newShippingTokens: QuantityTier["freeShipping"][] = ["none", "desk", "home", "both"];
    const legacyBenefits: LegacyTierBenefit[] = ["free_desk", "free_home", "free_both", "discount"];
    return (raw as any[])
      .filter((t) => t && typeof t.qty === "number")
      .map((t) => {
        const qty = Number(t.qty);
        const discount = t.discountAmount == null ? undefined : Number(t.discountAmount);
        const mode: QuantityTier["mode"] =
          t.mode === "min" ? "min" : t.mode === "exact" ? "exact" : "exact";
        if (typeof t.freeShipping === "string" && newShippingTokens.includes(t.freeShipping)) {
          return { qty, mode, freeShipping: t.freeShipping, discountAmount: discount } as QuantityTier;
        }
        if (typeof t.benefit === "string" && legacyBenefits.includes(t.benefit)) {
          const migrated = migrateLegacyBenefit(t.benefit as LegacyTierBenefit, discount);
          return { qty, mode, ...migrated } as QuantityTier;
        }
        // Unknown shape — preserve qty + discount, no shipping benefit.
        return { qty, mode, freeShipping: "none" as const, discountAmount: discount } as QuantityTier;
      });
  }
  if (typeof raw === "string" && raw.trim()) {
    return parseQuantityTiers(raw);
  }
  return [];
}

export function loadCatalog(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const products = parsed.map(normalizeProduct).filter(Boolean) as Product[];
    const seen = new Set<string>();
    return products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch {
    return [];
  }
}

/**
 * Async catalog loader — checks localStorage first, then IndexedDB.
 * Use this for initial load (handles large catalogs that overflow localStorage).
 * The sync loadCatalog() is kept for backward compat (admin operations).
 */
export async function loadCatalogAsync(): Promise<Product[]> {
  if (typeof window === "undefined") return [];
  // Import dynamically to avoid circular dependency issues
  const { adaptiveGet } = await import("./adaptive-storage");
  try {
    const raw = await adaptiveGet(CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const products = parsed.map(normalizeProduct).filter(Boolean) as Product[];
    const seen = new Set<string>();
    return products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch {
    return [];
  }
}

function normalizeProduct(p: any): Product | null {
  if (!p || typeof p !== "object") return null;
  const toStr = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && "fr" in v) return String(v.fr ?? "");
    if (typeof v === "object" && "ar" in v) return String(v.ar ?? "");
    return String(v);
  };
  const image = toStr(p.image);
  let images: string[] = [];
  if (Array.isArray(p.images)) {
    images = p.images.map(toStr).filter((s) => s.trim() !== "");
  } else if (typeof p.images === "string" && p.images.trim() !== "") {
    images = splitImageStrings(p.images);
  }
  images = Array.from(new Set(images));
  if (image && images[0] !== image) {
    images = [image, ...images.filter((i) => i !== image)];
  }

  let variations: Variation[] = [];
  if (Array.isArray(p.variations)) {
    variations = p.variations
      .filter((v: any) => v && typeof v === "object" && v.name)
      .map((v: any) => ({
        name: String(v.name),
        options: Array.isArray(v.options)
          ? v.options.map((o: any) => String(o)).filter(Boolean)
          : [],
      }))
      .filter((v: Variation) => v.options.length > 0);
  } else if (typeof p.variations === "string" && p.variations.trim()) {
    variations = parseVariations(p.variations);
  }

  const variants = normalizeVariants(p.variants);

  let highlights: string[] = [];
  if (Array.isArray(p.highlights)) {
    highlights = p.highlights.map((h: any) => String(h)).filter((h) => h.trim() !== "");
  } else if (typeof p.highlights === "string" && p.highlights.trim()) {
    highlights = parseHighlights(p.highlights);
  }

  return {
    id: String(p.id ?? ""),
    name: toStr(p.name),
    description: toStr(p.description ?? ""),
    category: toStr(p.category),
    price: (() => {
      if (p.price === null || p.price === undefined) return null;
      if (typeof p.price === "object" && p.price !== null) return null;
      const n = Number(p.price);
      // P0 FIX #4: Guard against NaN — treat as null (price-on-request)
      return isNaN(n) ? null : n;
    })(),
    oldPrice: (() => {
      if (p.oldPrice === null || p.oldPrice === undefined || p.oldPrice === "") return null;
      if (typeof p.oldPrice === "object" && p.oldPrice !== null) return null;
      const n = Number(p.oldPrice);
      // P0 FIX #4: Guard against NaN
      return isNaN(n) ? null : n;
    })(),
    image,
    images,
    variations,
    variants,
    stock: (() => {
      if (p.stock === null || p.stock === undefined || p.stock === "") return null;
      if (typeof p.stock === "object" && p.stock !== null) return null;
      const n = Number(p.stock);
      // P0 FIX #4: Guard against NaN
      return isNaN(n) ? null : n;
    })(),
    highlights,
    sortOrder:
      p.sortOrder === null || p.sortOrder === undefined
        ? 999
        : Number(p.sortOrder),
    badge:
      p.badge === null || p.badge === undefined
        ? ""
        : String(p.badge),
    quantityTiers: normalizeTiers(p.quantityTiers),
    featured: (p.featured === true ||
               p.featured === 1 ||
               p.featured === "1" ||
               (typeof p.featured === "string" &&
                p.featured.toLowerCase() === "true")),
    inStock: p.inStock !== false, // default true unless explicitly false
    isSpecialOffer: (p.isSpecialOffer === true ||
                     p.isSpecialOffer === 1 ||
                     p.isSpecialOffer === "1" ||
                     (typeof p.isSpecialOffer === "string" &&
                      p.isSpecialOffer.toLowerCase() === "true")),
  };
}

export function saveCatalog(products: Product[]): boolean {
  if (typeof window === "undefined") return false;
  const json = JSON.stringify(products);
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, json);
    // Verify it was actually saved (some browsers silently truncate)
    const check = window.localStorage.getItem(CATALOG_STORAGE_KEY);
    if (check && check.length === json.length) {
      return true;
    }
    // Verification failed — clear and fall through to IndexedDB
    window.localStorage.removeItem(CATALOG_STORAGE_KEY);
    console.warn("[saveCatalog] localStorage write verification failed, falling back to IndexedDB");
  } catch (e) {
    // localStorage quota exceeded — likely a large catalog.
    console.warn("[saveCatalog] localStorage quota exceeded, falling back to IndexedDB");
    try {
      window.localStorage.removeItem(CATALOG_STORAGE_KEY);
    } catch {}
  }
  // Fall back to IndexedDB (async, but we can't await here).
  // Fire-and-forget — callers that need guaranteed save should use saveCatalogAsync()
  import("./adaptive-storage")
    .then(({ adaptiveSet }) => adaptiveSet(CATALOG_STORAGE_KEY, json))
    .catch(() => {});
  return false; // localStorage failed — return false so callers know
}

/**
 * Async catalog saver — uses adaptive storage (localStorage + IndexedDB).
 * Use this for large catalogs that might overflow localStorage.
 */
export async function saveCatalogAsync(products: Product[]): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { adaptiveSet } = await import("./adaptive-storage");
  return adaptiveSet(CATALOG_STORAGE_KEY, JSON.stringify(products));
}

export function resetCatalog(): Product[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        CATALOG_STORAGE_KEY,
        JSON.stringify(SEED_PRODUCTS),
      );
    } catch {
      // ignore
    }
  }
  return SEED_PRODUCTS;
}

export function generateId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "product";
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}
