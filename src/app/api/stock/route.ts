import { NextResponse } from "next/server";
import { getSheetBaseUrl } from "@/lib/sheet";

// Cache this route's GET response at the server/CDN level for 30 minutes (Netlify ISR).
export const revalidate = 1800;

// GET /api/stock → Stock tab as CSV (proxied from Google Apps Script)
export async function GET() {
  const base = getSheetBaseUrl();
  if (!base) {
    return new NextResponse('"Product Name","Status"\n', {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  try {
    const url = `${base}?action=stock`;
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
    const text = await res.text();
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // Browser caches for 60s, then serves stale while revalidating.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}
