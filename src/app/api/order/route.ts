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
        // Order failed to reach the sheet — log it for the admin to investigate.
        // We still return ok:true to the customer (so they don't see an error),
        // but we mark it with a warning so the client can save it to localStorage
        // for retry.
        console.error("[api/order] FAILED to submit order to Apps Script:", {
          product: body.product,
          fullName: body.fullName,
          phone,
          wilaya: body.wilaya,
          grandTotal: body.grandTotal,
        });
        return NextResponse.json({ ok: true, warning: "order_queued" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Log the full error for debugging
    console.error("[api/order] Exception:", e);
    // Still return ok:true so customer doesn't see an error
    return NextResponse.json({ ok: true, warning: "order_fallback" });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Soum Deco order API" });
}
