import { NextRequest, NextResponse } from "next/server";
import { sheetSubmitOrder, getSheetBaseUrl } from "@/lib/sheet";

const PHONE_REGEX = /^0[567]\d{8}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate phone
    const phone = (body?.phone || "").toString().trim();
    if (!PHONE_REGEX.test(phone)) {
      return NextResponse.json(
        { ok: false, error: "Numéro de téléphone invalide" },
        { status: 400 },
      );
    }

    const required = ["fullName", "wilaya", "delivery"];
    for (const key of required) {
      if (!body?.[key]) {
        return NextResponse.json(
          { ok: false, error: `Champ manquant: ${key}` },
          { status: 400 },
        );
      }
    }

    // Forward to Google Apps Script.
    // If no sheet URL is configured (dev mode), the order is accepted but not saved.
    // If the sheet URL IS configured but submission fails, return an error.
    const sheetUrl = getSheetBaseUrl();
    if (sheetUrl) {
      const ok = await sheetSubmitOrder({
        product: body.product || "",
        quantity: String(body.quantity || "1"),
        price:
          body.price === null || body.price === undefined
            ? null
            : Number(body.price),
        shippingPrice: Number(body.shippingPrice) || 0,
        grandTotal: Number(body.grandTotal) || 0,
        shippingCompanyLabel: body.shippingCompanyLabel || "",
        fullName: body.fullName || "",
        phone,
        wilaya: body.wilaya || "",
        commune: body.commune || "",
        deliveryLabel: body.deliveryLabel || "",
        notes: body.notes || "",
      });

      if (!ok) {
        console.error("[order] sheetSubmitOrder returned false");
        return NextResponse.json(
          { ok: false, error: "Failed to submit order to sheet" },
          { status: 502 },
        );
      }
    } else {
      // Dev mode — no sheet configured. Log the order but accept it.
      console.log("[order] No sheet URL configured — order accepted but not saved:", {
        product: body.product,
        fullName: body.fullName,
        phone,
        wilaya: body.wilaya,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[order] error:", e);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Soum Deco order API" });
}
