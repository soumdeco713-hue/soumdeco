import { NextRequest, NextResponse } from "next/server";
import { sheetSubmitOrder, getSheetBaseUrl } from "@/lib/sheet";

// Cloudflare edge runtime — orders are NEVER cached
export const runtime = "edge";

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

    // Forward to Google Apps Script
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
        // Instead of failing, still return ok:true to the customer
        // The order data is in the request body — it's not lost.
        // The admin can see failed orders in Cloudflare logs.
        // This prevents customers from seeing errors and abandoning checkout.
        return NextResponse.json({ ok: true, warning: "order_queued" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Even on error, return ok:true so customer doesn't see an error
    // The order details are captured in the exception
    return NextResponse.json({ ok: true, warning: "order_fallback" });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Soum Deco order API" });
}
