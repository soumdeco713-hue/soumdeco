import { NextResponse } from "next/server";
import { getSheetBaseUrl } from "@/lib/sheet";

// Cloudflare edge runtime + KV cache (3 minutes)
export const runtime = "edge";

// GET /api/stock → Stock tab as CSV (from Google Apps Script, cached in KV)
export async function GET(req: Request) {
  const env = (req as any).env || (globalThis as any).env;

  // 1. Check KV cache
  if (env?.CATALOG_KV) {
    try {
      const cached = await env.CATALOG_KV.get("stock", "text");
      if (cached) {
        return new Response(cached, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      }
    } catch {}
  }

  const base = getSheetBaseUrl();
  if (!base) {
    return new Response('"Product Name","Status"\n', {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  try {
    const url = `${base}?action=stock`;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      // NOTE: 'cache' field is not supported on Cloudflare Pages edge runtime.
      // Removed 'cache: "no-store"' which caused HTTP 500.
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Sheet returned ${res.status}` }, { status: 502 });
    }
    const text = await res.text();

    // Cache in KV for 3 minutes
    if (env?.CATALOG_KV) {
      try {
        await env.CATALOG_KV.put("stock", text, { expirationTtl: 180 });
      } catch {}
    }

    return new Response(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
