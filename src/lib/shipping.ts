// Shipping data for SOUM DECO — copied EXACTLY from soumdeco.netlify.app
// Two shipping companies:
// - zr_express: ZR Express
// - ecom_delivery: Ecom Delivery
// Each company has stopDesk + home prices per wilaya (no delay, no express/economique)

export type ShippingCompany = "zr_express" | "ecom_delivery";
export type DeliveryType = "stop_desk" | "home";

type WilayaShipping = {
  zr_express: { stopDesk: number; home: number };
  ecom_delivery: { stopDesk: number; home: number };
};

// 58 wilayas — prices in DA
// Prices copied EXACTLY from soumdeco.netlify.app reference site
const SHIPPING_TABLE: Record<number, WilayaShipping> = {
  1:  { zr_express: { stopDesk: 900,  home: 1300  }, ecom_delivery: { stopDesk: 750, home: 1100 } }, // Adrar
  2:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 680 } }, // Chlef
  3:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 800 } }, // Laghouat
  4:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 680 } }, // Oum El Bouaghi
  5:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Batna
  6:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Béjaïa
  7:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 800 } }, // Biskra
  8:  { zr_express: { stopDesk: 650,  home: 1000  }, ecom_delivery: { stopDesk: 700, home: 1000 } }, // Béchar
  9:  { zr_express: { stopDesk: 400,  home: 600  }, ecom_delivery: { stopDesk: 350, home: 500 } }, // Blida
  10:  { zr_express: { stopDesk: 450,  home: 700  }, ecom_delivery: { stopDesk: 400, home: 600 } }, // Bouira
  11:  { zr_express: { stopDesk: 1050,  home: 1500  }, ecom_delivery: { stopDesk: 1050, home: 1500 } }, // Tamanrasset
  12:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 450, home: 720 } }, // Tébessa
  13:  { zr_express: { stopDesk: 500,  home: 900  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Tlemcen
  14:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Tiaret
  15:  { zr_express: { stopDesk: 450,  home: 700  }, ecom_delivery: { stopDesk: 400, home: 600 } }, // Tizi Ouzou
  16:  { zr_express: { stopDesk: 300,  home: 400  }, ecom_delivery: { stopDesk: 300, home: 400 } }, // Alger
  17:  { zr_express: { stopDesk: 500,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 800 } }, // Djelfa
  18:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Jijel
  19:  { zr_express: { stopDesk: 450,  home: 750  }, ecom_delivery: { stopDesk: 400, home: 680 } }, // Sétif
  20:  { zr_express: { stopDesk: 500,  home: 900  }, ecom_delivery: { stopDesk: 450, home: 730 } }, // Saïda
  21:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Skikda
  22:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Sidi Bel Abbès
  23:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 450, home: 700 } }, // Annaba
  24:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Guelma
  25:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 680 } }, // Constantine
  26:  { zr_express: { stopDesk: 450,  home: 750  }, ecom_delivery: { stopDesk: 400, home: 600 } }, // Médéa
  27:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Mostaganem
  28:  { zr_express: { stopDesk: 500,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // M'Sila
  29:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Mascara
  30:  { zr_express: { stopDesk: 600,  home: 900  }, ecom_delivery: { stopDesk: 550, home: 900 } }, // Ouargla
  31:  { zr_express: { stopDesk: 450,  home: 700  }, ecom_delivery: { stopDesk: 400, home: 580 } }, // Oran
  32:  { zr_express: { stopDesk: 600,  home: 1000  }, ecom_delivery: { stopDesk: 700, home: 970 } }, // El Bayadh
  33:  { zr_express: { stopDesk: 1050,  home: 1500  }, ecom_delivery: { stopDesk: 1050, home: 1500 } }, // Illizi
  34:  { zr_express: { stopDesk: 450,  home: 750  }, ecom_delivery: { stopDesk: 400, home: 680 } }, // Bordj Bou Arréridj
  35:  { zr_express: { stopDesk: 450,  home: 700  }, ecom_delivery: { stopDesk: 350, home: 530 } }, // Boumerdès
  36:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 450, home: 730 } }, // El Tarf
  37:  { zr_express: { stopDesk: 750,  home: 1100  }, ecom_delivery: { stopDesk: 750, home: 1100 } }, // Tindouf
  38:  { zr_express: { stopDesk: 520,  home: 850  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Tissemsilt
  39:  { zr_express: { stopDesk: 650,  home: 900  }, ecom_delivery: { stopDesk: 550, home: 900 } }, // El Oued
  40:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Khenchela
  41:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 450, home: 730 } }, // Souk Ahras
  42:  { zr_express: { stopDesk: 450,  home: 700  }, ecom_delivery: { stopDesk: 350, home: 530 } }, // Tipaza
  43:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Mila
  44:  { zr_express: { stopDesk: 450,  home: 850  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Aïn Defla
  45:  { zr_express: { stopDesk: 600,  home: 1000  }, ecom_delivery: { stopDesk: 550, home: 930 } }, // Naâma
  46:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Aïn Témouchent
  47:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 850 } }, // Ghardaïa
  48:  { zr_express: { stopDesk: 450,  home: 800  }, ecom_delivery: { stopDesk: 400, home: 700 } }, // Relizane
  49:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 550, home: 930 } }, // El M'ghair
  50:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 850 } }, // El Menia
  51:  { zr_express: { stopDesk: 550,  home: 900  }, ecom_delivery: { stopDesk: 500, home: 800 } }, // Ouled Djellal
  52:  { zr_express: { stopDesk: 1050,  home: 1500  }, ecom_delivery: { stopDesk: 750, home: 1000 } }, // Bordj Baji Mokhtar
  53:  { zr_express: { stopDesk: 900,  home: 1000  }, ecom_delivery: { stopDesk: 950, home: 1400 } }, // Béni Abbès
  54:  { zr_express: { stopDesk: 900,  home: 1300  }, ecom_delivery: { stopDesk: 750, home: 1100 } }, // Timimoun
  55:  { zr_express: { stopDesk: 600,  home: 900  }, ecom_delivery: { stopDesk: 550, home: 930 } }, // Touggourt
  56:  { zr_express: { stopDesk: 1050,  home: 1500  }, ecom_delivery: { stopDesk: 1050, home: 1500 } }, // Djanet
  57:  { zr_express: { stopDesk: 1120,  home: 1400  }, ecom_delivery: { stopDesk: 550, home: 930 } }, // In Salah
  58:  { zr_express: { stopDesk: 1120,  home: 1400  }, ecom_delivery: { stopDesk: 500, home: 850 } }, // In Guezzam
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
  company: ShippingCompany;
  deliveryLabel: string;
};

export function getShippingPrice(
  wilayaCode: string | number,
  company: ShippingCompany,
  deliveryType: DeliveryType,
): ShippingPriceResult | null {
  const resolved = resolveWilayaCode(wilayaCode);
  const row = SHIPPING_TABLE[resolved];
  if (!row) return null;
  const tier = row[company];
  const key = deliveryType === "stop_desk" ? "stopDesk" : "home";
  return {
    price: tier[key],
    company,
    deliveryLabel: deliveryType === "stop_desk" ? "مكتب" : "توصيل للمنزل",
  };
}

export const SHIPPING_COMPANY_LABELS: Record<ShippingCompany, string> = {
  zr_express: "ZR Express",
  ecom_delivery: "Ecom Delivery",
};

export const SHIPPING_COMPANY_LABELS_AR: Record<ShippingCompany, string> = {
  zr_express: "ZR Express",
  ecom_delivery: "Ecom Delivery",
};

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  stop_desk: "مكتب",
  home: "توصيل للمنزل",
};

export const DELIVERY_TYPE_LABELS_AR: Record<DeliveryType, string> = {
  stop_desk: "مكتب",
  home: "توصيل للمنزل",
};

