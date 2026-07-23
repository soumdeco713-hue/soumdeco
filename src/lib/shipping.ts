// Shipping data for الميزان — Yalidine Express + Économique
// Two options per delivery type (stop_desk / home):
// - express: faster, more expensive
// - economique: slower, cheaper
// Prices and delays extracted from the Guepex PDFs (Guelma departure)

export type ShippingSpeed = "express" | "economique";
export type DeliveryType = "stop_desk" | "home";

type WilayaShipping = {
  express: { stopDesk: number; home: number; delay: number };
  economique: { stopDesk: number; home: number; delay: number };
};

// 58 wilayas — prices in DA, delay in days
const SHIPPING_TABLE: Record<number, WilayaShipping> = {
  1:  { express: { stopDesk: 1750, home: 1850, delay: 4 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // Adrar
  2:  { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Chlef
  3:  { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 4 } }, // Laghouat
  4:  { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Oum El Bouaghi
  5:  { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Batna
  6:  { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Béjaïa
  7:  { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 2 } }, // Biskra
  8:  { express: { stopDesk: 1750, home: 1850, delay: 4 }, economique: { stopDesk: 1550, home: 1650, delay: 5 } }, // Béchar
  9:  { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Blida
  10: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Bouira
  11: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // Tamanrasset
  12: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Tébessa
  13: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Tlemcen
  14: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Tiaret
  15: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Tizi Ouzou
  16: { express: { stopDesk: 650,  home: 700,  delay: 1 }, economique: { stopDesk: 450,  home: 550,  delay: 2 } }, // Alger
  17: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Djelfa
  18: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Jijel
  19: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Sétif
  20: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Saïda
  21: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Skikda
  22: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Sidi Bel Abbès
  23: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Annaba
  24: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Guelma
  25: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Constantine
  26: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Médéa
  27: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Mostaganem
  28: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // M'Sila
  29: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Mascara
  30: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 4 } }, // Ouargla
  31: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Oran
  32: { express: { stopDesk: 1750, home: 1850, delay: 3 }, economique: { stopDesk: 1550, home: 1650, delay: 4 } }, // El Bayadh
  33: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // Illizi
  34: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Bordj Bou Arréridj
  35: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Boumerdès
  36: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // El Tarf
  37: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 5 } }, // Tindouf
  38: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Tissemsilt
  39: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 3 } }, // El Oued
  40: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Khenchela
  41: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Souk Ahras
  42: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Tipaza
  43: { express: { stopDesk: 850,  home: 900,  delay: 1 }, economique: { stopDesk: 600,  home: 700,  delay: 2 } }, // Mila
  44: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Aïn Defla
  45: { express: { stopDesk: 1750, home: 1850, delay: 4 }, economique: { stopDesk: 1550, home: 1650, delay: 5 } }, // Naâma
  46: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Aïn Témouchent
  47: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 4 } }, // Ghardaïa
  48: { express: { stopDesk: 850,  home: 900,  delay: 2 }, economique: { stopDesk: 600,  home: 700,  delay: 3 } }, // Relizane
  49: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 3 } }, // El M'ghair
  50: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 4 } }, // El Menia
  51: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 3 } }, // Ouled Djellal
  52: { express: { stopDesk: 1750, home: 1850, delay: 4 }, economique: { stopDesk: 1550, home: 1650, delay: 5 } }, // Bordj Baji Mokhtar
  53: { express: { stopDesk: 1750, home: 1850, delay: 4 }, economique: { stopDesk: 1550, home: 1650, delay: 4 } }, // Béni Abbès
  54: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // Timimoun
  55: { express: { stopDesk: 1000, home: 1050, delay: 3 }, economique: { stopDesk: 700,  home: 850,  delay: 4 } }, // Touggourt
  56: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // Djanet
  57: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // In Salah
  58: { express: { stopDesk: 1750, home: 1850, delay: 5 }, economique: { stopDesk: 1550, home: 1650, delay: 6 } }, // In Guezzam
};

// Daira codes 59-69 map to parent wilayas
const DAIRA_TO_WILAYA: Record<number, number> = {
  59: 3, 60: 5, 61: 7, 62: 12, 63: 13, 64: 14, 65: 17, 66: 17, 67: 26, 68: 28, 69: 32,
};

function resolveWilayaCode(wilayaCode: string | number): number {
  const code = typeof wilayaCode === "string" ? parseInt(wilayaCode, 10) : wilayaCode;
  if (Number.isNaN(code)) return 16;
  if (DAIRA_TO_WILAYA[code]) return DAIRA_TO_WILAYA[code];
  return code;
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
  express: "Express",
  economique: "Économique",
};

export const SHIPPING_SPEED_LABELS_AR: Record<ShippingSpeed, string> = {
  express: "توصيل سريع",
  economique: "توصيل عادي",
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  stop_desk: "مكتب التوصيل",
  home: "توصيل للمنزل",
};

export const DELIVERY_TYPE_LABELS_AR: Record<DeliveryType, string> = {
  stop_desk: "مكتب التوصيل",
  home: "توصيل للمنزل",
};
