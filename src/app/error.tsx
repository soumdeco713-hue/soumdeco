"use client";

/**
 * Route-level error boundary — catches errors thrown by server components
 * and route segments. Augments (does not replace) the top-level ErrorBoundary.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: "#FAF8F4" }}
    >
      <div className="text-center" style={{ maxWidth: 420 }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #9A7E3A, #D4AF37)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          ✦
        </div>
        <h1
          className="font-arabic"
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#1C1815",
            marginBottom: 12,
          }}
        >
          حدث خطأ في تحميل الصفحة
        </h1>
        <p
          className="font-arabic"
          style={{
            fontSize: 14,
            color: "#6B5D4F",
            marginBottom: 24,
            lineHeight: 1.6,
          }}
        >
          يرجى المحاولة مرة أخرى. إذا استمرت المشكلة، تواصل معنا.
        </p>
        <button
          onClick={reset}
          className="font-arabic"
          style={{
            background: "#1C1815",
            color: "#FAF8F4",
            border: "none",
            borderRadius: 9999,
            padding: "12px 32px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
