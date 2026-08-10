import Link from "next/link";

/**
 * 404 page — shown when a route is not found.
 */
export default function NotFound() {
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
            fontSize: 28,
            fontWeight: 700,
            color: "#1C1815",
            marginBottom: 12,
          }}
        >
          404
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
          الصفحة التي تبحث عنها غير موجودة.
        </p>
        <Link
          href="/"
          className="font-arabic"
          style={{
            display: "inline-block",
            background: "#1C1815",
            color: "#FAF8F4",
            borderRadius: 9999,
            padding: "12px 32px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
