import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, Noto_Naskh_Arabic, Jost } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand-config";
import { ManifestPreloader } from "@/components/site/manifest-preloader";
import { HealthMonitorStarter } from "@/components/site/health-monitor-starter";
import { LoadingFallback } from "@/components/site/loading-fallback";

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
        {/* Unregister old service worker (was causing "stuck at loading") */}
        <script src="/unregister-sw.js" async></script>
      </head>
      <body
        className={`${jost.variable} ${cormorant.variable} ${inter.variable} ${arabic.variable} font-arabic antialiased bg-background text-foreground`}
      >
        {/* ════════════════════════════════════════════════════════════
            ALGERIAN WIFI FIX: Inline loading screen
            Shows IMMEDIATELY when HTML loads — BEFORE JavaScript.
            On slow WiFi, visitors see this within 200ms instead of
            staring at a blank white page for 5-15 seconds.
            React removes this when it mounts (via the inline script below).
            ════════════════════════════════════════════════════════════ */}
        <div id="pre-react-loading" style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF8F4",
          zIndex: 99999,
          transition: "opacity 0.3s ease",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #9A7E3A, #D4AF37)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              animation: "pulse 1.5s ease-in-out infinite",
            }}>✦</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1815", marginBottom: 8, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              SOUM DECO
            </h1>
            <p style={{ fontSize: 14, color: "#6B5D4F", fontFamily: "system-ui, -apple-system, sans-serif" }}>
              جاري التحميل...
            </p>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.95); }
          }
        `}</style>
        {/* Tiny inline script: removes loading screen once React mounts.
            This runs BEFORE heavy JS chunks load, ensuring instant removal. */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener("load", function() {
            // Wait for React to mount (check for #pre-react-loading removal by React)
            var checkCount = 0;
            var checkInterval = setInterval(function() {
              checkCount++;
              // After 3 seconds OR if React has mounted (body has content), remove loading
              if (checkCount > 30 || document.querySelector("[data-react-root]")) {
                var el = document.getElementById("pre-react-loading");
                if (el) {
                  el.style.opacity = "0";
                  setTimeout(function() { el.remove(); }, 300);
                }
                clearInterval(checkInterval);
              }
            }, 100);
          });
        `}} />

        {/* G3 FIX: <noscript> fallback for JS-disabled users + failed bundle download */}
        <noscript>
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#FAF8F4",
              fontFamily: "system-ui, -apple-system, sans-serif",
              zIndex: 9999,
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #9A7E3A, #D4AF37)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                ✦
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1815", marginBottom: 8 }}>
                SOUM DECO
              </h1>
              <p style={{ fontSize: 14, color: "#6B5D4F", lineHeight: 1.6, marginBottom: 16 }}>
                يلزم تفعيل JavaScript لعرض الموقع بشكل صحيح.
                <br />
                Veuillez activer JavaScript pour voir le site.
              </p>
              <a
                href="/"
                style={{
                  display: "inline-block",
                  background: "#1C1815",
                  color: "#FAF8F4",
                  textDecoration: "none",
                  borderRadius: 9999,
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                إعادة المحاولة
              </a>
            </div>
          </div>
        </noscript>
        <ManifestPreloader />
        <HealthMonitorStarter />
        <LoadingFallback />
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
