import { NextResponse } from "next/server";
import { getSheetBaseUrl } from "@/lib/sheet";
import { FALLBACK_SHIPPING } from "@/lib/shipping";

// GET /api/shipping → shipping company prices from Google Apps Script
// Falls back to hardcoded FALLBACK_SHIPPING when no sheet is configured.
export async function GET() {
  const base = getSheetBaseUrl();
  if (!base) {
    // No sheet configured — return fallback shipping data
    return NextResponse.json({ ok: true, shipping: FALLBACK_SHIPPING, source: "fallback" });
  }
  try {
    const url = `${base}?action=shipping`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Sheet returned ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(
      { ok: true, shipping: Array.isArray(data) ? data : [], source: "sheet" },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    // Network error — fall back to hardcoded prices
    return NextResponse.json(
      { ok: true, shipping: FALLBACK_SHIPPING, source: "fallback" },
    );
  }
}
