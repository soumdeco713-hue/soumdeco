import { NextResponse } from "next/server";
import { getSheetBaseUrl } from "@/lib/sheet";

// Cloudflare edge runtime
export const runtime = "edge";

// GET /api/shipping → shipping company prices from Google Apps Script
// Falls back to empty array when no sheet is configured.
export async function GET() {
  const base = getSheetBaseUrl();
  if (!base) {
    // No sheet configured — return empty shipping data
    return NextResponse.json({ ok: true, shipping: [], source: "fallback" });
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
    // Network error — fall back to empty array
    return NextResponse.json(
      { ok: true, shipping: [], source: "fallback" },
    );
  }
}
