import { NextResponse } from "next/server";

// Cloudflare edge runtime
export const runtime = "edge";

/**
 * GET /api/shipping → Returns empty array.
 *
 * This route previously called an Apps Script action ('shipping') that doesn't
 * exist. Shipping prices are handled entirely client-side via src/lib/shipping.ts
 * (hardcoded table with all 58 wilayas + delivery company prices).
 *
 * The route is kept as a no-op (returns empty) rather than deleted, because
 * removing the file entirely could break the build's _routes.json generation.
 * This is safer than deletion.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, shipping: [], source: "client-side" },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
