import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // NOTE: 24h Cache-Control headers temporarily REMOVED for dev.
  // Will be re-applied when pushing to production. See NETLIFY-OPTIMIZATION-GUIDE.md.
};

export default nextConfig;
