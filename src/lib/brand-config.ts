// ============================================================
//  BRAND CONFIG — SOUM DECO
// ============================================================
//  French-Algerian home decor boutique (boutique de décoration).
//  Tagline: "L'art de sublimer votre intérieur"
//  Instagram: @soumdecodz · Based in Alger · COD in 58 wilayas.
//  Phone: 0541 645 727 (as shown on soumdeco.netlify.app)
// ============================================================

export const BRAND = {
  /** Brand name — displayed in header, footer, menu, etc. */
  name: "SOUM DECO",
  nameLatin: "SoumDecoDZ",
  /** Brand tagline — shown under the logo in the hero. */
  tagline: "L'art de sublimer votre intérieur",
  /** Admin password — change before going live. */
  adminPassword: "007",
  /** Logo file path (relative to /public). */
  logoPath: "/logo.svg",

  /** Contact info — Instagram primary (replaces TikTok). */
  contact: {
    instagram: "soumdecodz",
    instagramUrl: "https://www.instagram.com/soumdecodz/",
    facebook: "soumdeco",
    facebookUrl: "https://www.facebook.com/soumdeco",
    phone: "0541645727",
    phoneDisplay: "0541 645 727",
    email: "soumdecorationdz@gmail.com",
    address: "Alger, Algérie",
  },

  /** Brand story — shown on the home page (Arabic primary, like El Miizaan). */
  story: {
    title: "حكايتنا",
    paragraphs: [
      "في متجر SOUM DECO، نؤمن أن البيت العصري يستحق منتجات تجمع بين الجودة والذوق الرفيع. نختار لك بعناية كل قطعة من مجموعتنا لتكون عملية وأنيقة في آن واحد، من أدوات المائدة إلى قطع الديكور التي تمنح منزلك لمسة دافئة ومميزة.",
      "نوفّر لك تجربة مميزة، مع الدفع عند الاستلام في 58 ولاية عبر الجزائر، وفريق خدمة عملاء جاهز للرد على استفساراتك في أي وقت. كل قطعة في مجموعتنا مختارة بعناية لتجمع بين الأناقة والجودة.",
      "مرحباً بكم في عالمنا ✨",
    ],
    stats: [
      { value: "58", label: "ولاية مغطاة" },
      { value: "+100", label: "عميل سعيد" },
      { value: "24h", label: "في خدمتك" },
    ],
  },

  /** localStorage keys — fresh namespace for the new brand. */
  storage: {
    catalog: "soumdeco_catalog_v1",
    cart: "soumdeco_cart_v1",
    adminAuth: "soumdeco_admin_authed",
    freeShipping: "soumdeco_free_shipping_v1",
  },

  /** Default Cloudinary upload preset (configure in Cloudinary dashboard). */
  cloudinaryUploadPreset: "soumdeco",
} as const;
