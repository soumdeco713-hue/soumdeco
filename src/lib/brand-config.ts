// ============================================================
//  BRAND CONFIG — مركز معلومات المتجر
// ============================================================
//  Placeholder values that will be replaced once the user
//  sends the real logo + TikTok handle in the next chat.
//
//  TODO: when the user provides the real assets, update ONLY
//  this file (and /public/logo.svg). No other file needs to
//  change.
// ============================================================

export const BRAND = {
  /** Brand name — displayed in the header, footer, menu, etc. */
  name: "الميزان",
  nameLatin: "El Miizaan",
  /** Brand tagline — shown under the logo in the hero. */
  tagline: "كل ما تحتاجه في مكانٍ واحد",
  /** Admin password — change before going live. */
  adminPassword: "007",
  /** Logo file path (relative to /public). */
  logoPath: "/logo.png",

  /** Contact info — only TikTok. */
  contact: {
    tiktok: "elmiizaan",
    tiktokUrl: "https://www.tiktok.com/@elmiizaan",
  },

  /** Brand story — shown on the home page. */
  story: {
    title: "حكايتنا",
    paragraphs: [
      "في متجر الميزان، نؤمن أن البيت العصري يستحق منتجات تجمع بين الجودة والذوق الرفيع. نختار لك بعناية كل قطعة من مجموعتنا لتكون عملية وأنيقة في آن واحد، من مستلزمات السيارة إلى أدوات الراحة المنزلية.",
      "نوفّر لك تجربة مميزة، مع الدفع عند الاستلام في 69 ولاية عبر الجزائر، وفريق خدمة عملاء جاهز للرد على استفساراتك في أي وقت.",
      "مرحبا🌹🌹🌹",
    ],
    stats: [
      { value: "69", label: "ولاية مغطاة" },
      { value: "+100", label: "عميل سعيد" },
      { value: "24h", label: "في خدمتك" },
    ],
  },

  /** localStorage keys — bumped to invalidate stale caches. */
  storage: {
    catalog: "rokn_catalog_v7",
    cart: "rokn_cart_v1",
    adminAuth: "rokn_admin_authed",
    freeShipping: "rokn_free_shipping_v1",
  },

  /** Default Cloudinary upload preset (configure in Cloudinary dashboard). */
  cloudinaryUploadPreset: "miizaan",
} as const;
