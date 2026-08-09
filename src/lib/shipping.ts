// Shipping data for SOUM DECO — copied EXACTLY from soumdeco.netlify.app
// Two options per delivery type (stop_desk / home):
// - express: faster, more expensive (Yalidine Express)
// - economique: slower, cheaper (Économique)

export type ShippingSpeed = "express" | "economique";
export type DeliveryType = "stop_desk" | "home";

type WilayaShipping = {
  express: { stopDesk: number; home: number; delay: number };
  economique: { stopDesk: number; home: number; delay: number };
};

// 58 wilayas — prices in DA, delay in days
// Prices copied EXACTLY from soumdeco.netlify.app reference site
const SHIPPING_TABLE: Record<number, WilayaShipping> = {
  1:  { express: { stopDesk: 900,  home: 1300,  delay: 4 }, economique: { stopDesk: 750, home: 1100, delay: 4 } }, // Adrar
  2:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 680, delay: 1 } }, // Chlef
  3:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 500, home: 800, delay: 3 } }, // Laghouat
  4:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 680, delay: 1 } }, // Oum El Bouaghi
  5:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 700, delay: 1 } }, // Batna
  6:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Béjaïa
  7:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 500, home: 800, delay: 3 } }, // Biskra
  8:  { express: { stopDesk: 650,  home: 1000,  delay: 4 }, economique: { stopDesk: 700, home: 1000, delay: 4 } }, // Béchar
  9:  { express: { stopDesk: 400,  home: 600,  delay: 2 }, economique: { stopDesk: 350, home: 500, delay: 2 } }, // Blida
  10:  { express: { stopDesk: 450,  home: 700,  delay: 2 }, economique: { stopDesk: 400, home: 600, delay: 2 } }, // Bouira
  11:  { express: { stopDesk: 1050,  home: 1500,  delay: 5 }, economique: { stopDesk: 1050, home: 1500, delay: 5 } }, // Tamanrasset
  12:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 450, home: 720, delay: 2 } }, // Tébessa
  13:  { express: { stopDesk: 500,  home: 900,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Tlemcen
  14:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Tiaret
  15:  { express: { stopDesk: 450,  home: 700,  delay: 2 }, economique: { stopDesk: 400, home: 600, delay: 2 } }, // Tizi Ouzou
  16:  { express: { stopDesk: 300,  home: 400,  delay: 1 }, economique: { stopDesk: 300, home: 400, delay: 1 } }, // Alger
  17:  { express: { stopDesk: 500,  home: 900,  delay: 2 }, economique: { stopDesk: 500, home: 800, delay: 2 } }, // Djelfa
  18:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Jijel
  19:  { express: { stopDesk: 450,  home: 750,  delay: 1 }, economique: { stopDesk: 400, home: 680, delay: 1 } }, // Sétif
  20:  { express: { stopDesk: 500,  home: 900,  delay: 2 }, economique: { stopDesk: 450, home: 730, delay: 2 } }, // Saïda
  21:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Skikda
  22:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Sidi Bel Abbès
  23:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 450, home: 700, delay: 1 } }, // Annaba
  24:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 700, delay: 1 } }, // Guelma
  25:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 680, delay: 1 } }, // Constantine
  26:  { express: { stopDesk: 450,  home: 750,  delay: 2 }, economique: { stopDesk: 400, home: 600, delay: 2 } }, // Médéa
  27:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Mostaganem
  28:  { express: { stopDesk: 500,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // M'Sila
  29:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Mascara
  30:  { express: { stopDesk: 600,  home: 900,  delay: 3 }, economique: { stopDesk: 550, home: 900, delay: 3 } }, // Ouargla
  31:  { express: { stopDesk: 450,  home: 700,  delay: 2 }, economique: { stopDesk: 400, home: 580, delay: 2 } }, // Oran
  32:  { express: { stopDesk: 600,  home: 1000,  delay: 3 }, economique: { stopDesk: 700, home: 970, delay: 3 } }, // El Bayadh
  33:  { express: { stopDesk: 1050,  home: 1500,  delay: 5 }, economique: { stopDesk: 1050, home: 1500, delay: 5 } }, // Illizi
  34:  { express: { stopDesk: 450,  home: 750,  delay: 1 }, economique: { stopDesk: 400, home: 680, delay: 1 } }, // Bordj Bou Arréridj
  35:  { express: { stopDesk: 450,  home: 700,  delay: 2 }, economique: { stopDesk: 350, home: 530, delay: 2 } }, // Boumerdès
  36:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 450, home: 730, delay: 1 } }, // El Tarf
  37:  { express: { stopDesk: 750,  home: 1100,  delay: 5 }, economique: { stopDesk: 750, home: 1100, delay: 5 } }, // Tindouf
  38:  { express: { stopDesk: 520,  home: 850,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Tissemsilt
  39:  { express: { stopDesk: 650,  home: 900,  delay: 3 }, economique: { stopDesk: 550, home: 900, delay: 3 } }, // El Oued
  40:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Khenchela
  41:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 450, home: 730, delay: 1 } }, // Souk Ahras
  42:  { express: { stopDesk: 450,  home: 700,  delay: 2 }, economique: { stopDesk: 350, home: 530, delay: 2 } }, // Tipaza
  43:  { express: { stopDesk: 450,  home: 800,  delay: 1 }, economique: { stopDesk: 400, home: 700, delay: 1 } }, // Mila
  44:  { express: { stopDesk: 450,  home: 850,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Aïn Defla
  45:  { express: { stopDesk: 600,  home: 1000,  delay: 4 }, economique: { stopDesk: 550, home: 930, delay: 4 } }, // Naâma
  46:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Aïn Témouchent
  47:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 500, home: 850, delay: 3 } }, // Ghardaïa
  48:  { express: { stopDesk: 450,  home: 800,  delay: 2 }, economique: { stopDesk: 400, home: 700, delay: 2 } }, // Relizane
  49:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 550, home: 930, delay: 3 } }, // El M'ghair
  50:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 500, home: 850, delay: 3 } }, // El Menia
  51:  { express: { stopDesk: 550,  home: 900,  delay: 3 }, economique: { stopDesk: 500, home: 800, delay: 3 } }, // Ouled Djellal
  52:  { express: { stopDesk: 1050,  home: 1500,  delay: 4 }, economique: { stopDesk: 750, home: 1000, delay: 4 } }, // Bordj Baji Mokhtar
  53:  { express: { stopDesk: 900,  home: 1000,  delay: 4 }, economique: { stopDesk: 950, home: 1400, delay: 4 } }, // Béni Abbès
  54:  { express: { stopDesk: 900,  home: 1300,  delay: 5 }, economique: { stopDesk: 750, home: 1100, delay: 5 } }, // Timimoun
  55:  { express: { stopDesk: 600,  home: 900,  delay: 3 }, economique: { stopDesk: 550, home: 930, delay: 3 } }, // Touggourt
  56:  { express: { stopDesk: 1050,  home: 1500,  delay: 5 }, economique: { stopDesk: 1050, home: 1500, delay: 5 } }, // Djanet
  57:  { express: { stopDesk: 1120,  home: 1400,  delay: 5 }, economique: { stopDesk: 550, home: 930, delay: 5 } }, // In Salah
  58:  { express: { stopDesk: 1120,  home: 1400,  delay: 5 }, economique: { stopDesk: 500, home: 850, delay: 5 } }, // In Guezzam
};

// Daira codes 59-69 map to parent wilayas
const DAIRA_TO_WILAYA: Record<number, number> = {
  59: 3, 60: 5, 61: 7, 62: 12, 63: 13, 64: 14, 65: 17, 66: 17, 67: 26, 68: 28, 69: 32,
};

function resolveWilayaCode(code: string | number): number {
  const n = typeof code === "string" ? parseInt(code, 10) : code;
  if (isNaN(n)) return 0;
  if (DAIRA_TO_WILAYA[n]) return DAIRA_TO_WILAYA[n];
  return n;
}

export type ShippingPriceResult = {
  price: number;
  delay: number;
  speed: ShippingSpeed;
  deliveryLabel: string;
};

export function getShippingPrice(
  wilayaCode: string | number,
  speed: ShippingSpeed,
  deliveryType: DeliveryType,
): ShippingPriceResult | null {
  const resolved = resolveWilayaCode(wilayaCode);
  const row = SHIPPING_TABLE[resolved];
  if (!row) return null;
  const tier = row[speed];
  const key = deliveryType === "stop_desk" ? "stopDesk" : "home";
  return {
    price: tier[key],
    delay: tier.delay,
    speed,
    deliveryLabel: deliveryType === "stop_desk" ? "مكتب التوصيل" : "توصيل للمنزل",
  };
}

export const SHIPPING_SPEED_LABELS: Record<ShippingSpeed, string> = {
  express: "Yalidine Express",
  economique: "Économique",
};

export const SHIPPING_SPEED_LABELS_AR: Record<ShippingSpeed, string> = {
  express: "Yalidine Express",
  economique: "Économique",
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  stop_desk: "مكتب التوصيل",
  home: "توصيل للمنزل",
};

export const DELIVERY_TYPE_LABELS_AR: Record<DeliveryType, string> = {
  stop_desk: "مكتب التوصيل",
  home: "توصيل للمنزل",
};

