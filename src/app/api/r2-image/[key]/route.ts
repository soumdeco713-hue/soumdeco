import { NextRequest, NextResponse } from "next/server";

// Cloudflare edge runtime — needed for R2 binding access
export const runtime = "edge";

/**
 * GET /api/r2-image/{key} — serve an image from R2.
 *
 * This is a fallback for when R2_PUBLIC_BASE_URL is not set
 * (e.g. in development, or before a custom domain is configured).
 *
 * In production, prefer serving R2 images directly via a custom domain
 * or Cloudflare Worker for better performance.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const env = (req as any).env || (globalThis as any).env;
  const { key } = await params;

  if (!env?.PRODUCT_IMAGES) {
    return NextResponse.json(
      { ok: false, error: "R2 not configured" },
      { status: 501 },
    );
  }

  if (!key) {
    return NextResponse.json(
      { ok: false, error: "Missing key" },
      { status: 400 },
    );
  }

  try {
    const object = await env.PRODUCT_IMAGES.get(key);
    if (!object) {
      return NextResponse.json(
        { ok: false, error: "Image not found" },
        { status: 404 },
      );
    }

    // Determine content type from the key extension
    const ext = key.split(".").pop()?.toLowerCase() || "";
    const contentType =
      ext === "webp" ? "image/webp"
      : ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "gif" ? "image/gif"
      : "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(object.body, { headers });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
