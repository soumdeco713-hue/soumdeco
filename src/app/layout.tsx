import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand-config";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#FAF8F4",
};

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: `${BRAND.name} · ${BRAND.tagline}. متجر ديكور المنزل وفنّ المائدة. توصيل لكل الولايات الجزائرية · الدفع عند الاستلام.`,
  keywords: [
    BRAND.name,
    BRAND.nameLatin,
    "ديكور المنزل",
    "فنّ المائدة",
    "الجزائر",
    "توصيل",
    "الدفع عند الاستلام",
    "decoration maison",
    "art de la table",
  ],
  authors: [{ name: BRAND.name }],
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: `${BRAND.tagline}. توصيل لكل الولايات الجزائرية.`,
    siteName: BRAND.name,
    type: "website",
    locale: "ar_DZ",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.tagline,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Preload API calls — starts fetching before JS loads (saves 1-2s) */}
        <link rel="preload" as="fetch" href="/api/products" crossOrigin="anonymous" />
        <link rel="preload" as="fetch" href="/api/stock" crossOrigin="anonymous" />
        {/* DNS prefetch for Cloudinary — faster image loading */}
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        {/* Google Fonts CDN — saves ~80KB per first visit on Netlify bandwidth
            (vs self-hosting via next/font/google). Preconnect for faster TLS. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-arabic antialiased bg-background text-foreground">
        {children}
        <Toaster
          position="top-center"
          richColors
          dir="rtl"
          toastOptions={{
            style: {
              borderRadius: "9999px",
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 500,
              boxShadow: "0 8px 24px rgba(28, 24, 21, 0.10), 0 2px 8px rgba(28, 24, 21, 0.06)",
              border: "1px solid rgba(154, 126, 58, 0.18)",
              minWidth: "220px",
              textAlign: "center",
              justifyContent: "center",
              background: "#FFFFFF",
              color: "#1C1815",
            },
            className: "font-arabic",
          }}
        />
      </body>
    </html>
  );
}
