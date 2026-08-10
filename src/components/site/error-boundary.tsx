"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

/**
 * Top-level Error Boundary — prevents white-screen crashes.
 *
 * If ANY child component throws during render, this boundary catches it
 * and shows a friendly "something went wrong" message with a refresh button.
 * The error is also logged to the console for debugging.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    // Force a full reload to clear any corrupted state
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
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
              حدث خطأ غير متوقع
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
              نعتذر عن هذا الإزعاج. يرجى تحديث الصفحة للمتابعة.
              <br />
              إذا استمرت المشكلة، تواصل معنا عبر إنستغرام @soumdecodz
            </p>
            <button
              onClick={this.handleReload}
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
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(28,24,21,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              تحديث الصفحة
            </button>
            {this.state.error && (
              <details
                style={{
                  marginTop: 24,
                  padding: 12,
                  background: "rgba(154,126,58,0.06)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "#6B5D4F",
                  textAlign: "left",
                  direction: "ltr",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  تفاصيل الخطأ (للمطور)
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {this.state.error.message}
                  {this.state.error.stack && "\n\n" + this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
