import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages: no 'standalone' output (Cloudflare uses its own build)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Cloudflare doesn't support next/image optimizer — we pre-optimize on upload
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
