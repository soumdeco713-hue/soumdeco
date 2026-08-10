import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Noto_Naskh_Arabic, Jost } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand-config";
import { ManifestPreloader } from "@/components/site/manifest-preloader";
import { HealthMonitorStarter } from "@/components/site/health-monitor-starter";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const arabic = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
    <html lang="ar" dir="ltr" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* DNS prefetch for Cloudinary + Apps Script — faster image + data loading */}
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://script.google.com" />
        <link rel="preconnect" href="https://script.google.com" />
      </head>
      <body
        className={`${jost.variable} ${cormorant.variable} ${inter.variable} ${arabic.variable} font-arabic antialiased bg-background text-foreground`}
      >
        <ManifestPreloader />
        <HealthMonitorStarter />
        {children}
        <Toaster
          position="top-center"
          richColors
         
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
