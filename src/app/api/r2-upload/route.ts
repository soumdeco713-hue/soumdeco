import { NextRequest, NextResponse } from "next/server";
import { uploadImagesToR2, isR2Configured } from "@/lib/r2-upload";

// Cloudflare edge runtime — needed for R2 binding access
export const runtime = "edge";

/**
 * POST /api/r2-upload — upload images to R2 (server-side).
 *
 * Body: { productId: string, images: string[] (base64 data URLs) }
 * Returns: { ok: true, urls: string[] } on success
 *
 * The client (admin panel) uses this route when R2 is configured.
 * Falls back to client-side Cloudinary upload if R2 is not available.
 */
export async function POST(req: NextRequest) {
  try {
    const env = (req as any).env || (globalThis as any).env;

    if (!isR2Configured(env)) {
      return NextResponse.json(
        { ok: false, error: "R2 not configured — use Cloudinary client-side upload instead" },
        { status: 501 },
      );
    }

    const body = await req.json();
    const productId = String(body?.productId ?? "").trim();
    const images: string[] = Array.isArray(body?.images)
      ? body.images.filter((s: any) => typeof s === "string" && s.startsWith("data:"))
      : [];

    if (!productId || images.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing productId or images" },
        { status: 400 },
      );
    }

    // Limit to 8 images max (matches admin panel MAX_PHOTOS)
    const toUpload = images.slice(0, 8);

    const urls = await uploadImagesToR2(env, toUpload, productId);

    if (urls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "All uploads failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, urls });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}

/**
 * GET /api/r2-upload — check if R2 is configured.
 * Returns: { ok: true, configured: boolean }
 */
export async function GET(req: NextRequest) {
  const env = (req as any).env || (globalThis as any).env;
  return NextResponse.json({
    ok: true,
    configured: isR2Configured(env),
  });
}
