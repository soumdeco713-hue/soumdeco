"use client";

import { useEffect, useState } from "react";

/**
 * LoadingFallback — bulletproof safety net for stuck loading.
 *
 * Detects TWO failure modes:
 * 1. Skeleton loaders showing for too long
 * 2. Blank screen (no interactive content at all)
 *
 * In both cases, shows a friendly "refresh" button so users NEVER see a
 * permanently stuck page. Runs for the ENTIRE session (no 30s cutoff).
 */
export function LoadingFallback() {
  const [showRefresh, setShowRefresh] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    let stuckCounter = 0;
    const CHECK_INTERVAL = 3000; // check every 3 seconds
    const STUCK_THRESHOLD = 2; // show refresh after 2 consecutive stuck checks (6s)

    const checkInterval = setInterval(() => {
      setCheckCount((c) => c + 1);

      // Check for skeleton loaders
      const skeletons = document.querySelectorAll(".animate-pulse, .shimmer-line");

      // Check for interactive content (product cards, images, text)
      const products = document.querySelectorAll(
        "[class*='product-card'], [class*='product-card-h'], article, .product-image",
      );

      // Check if the page has ANY real content (not just empty divs)
      const bodyText = document.body?.innerText?.trim() || "";
      const hasContent = bodyText.length > 100; // at least 100 chars of text

      // If we have products OR meaningful content, page loaded successfully
      if (products.length > 0 || hasContent) {
        stuckCounter = 0;
        setShowRefresh(false);
        return;
      }

      // If skeletons are showing OR screen is blank, increment stuck counter
      if (skeletons.length > 0 || !hasContent) {
        stuckCounter++;
        if (stuckCounter >= STUCK_THRESHOLD) {
          setShowRefresh(true);
        }
      }
    }, CHECK_INTERVAL);

    // Run for the entire session (no cutoff — user safety net)
    return () => clearInterval(checkInterval);
  }, []);

  // Auto-reload once if stuck for too long (15 seconds)
  useEffect(() => {
    if (!showRefresh) return;
    const reloadTimer = setTimeout(() => {
      // Only auto-reload once (check sessionStorage to prevent loop)
      const key = "soumdeco_auto_reloaded";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }, 15000);

    return () => clearTimeout(reloadTimer);
  }, [showRefresh]);

  // Don't render anything unless we need to show the refresh button
  if (!showRefresh) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1C1815",
        color: "#FAF8F4",
        padding: "14px 28px",
        borderRadius: "9999px",
        fontSize: "14px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxShadow: "0 8px 24px rgba(28, 24, 21, 0.25)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        cursor: "pointer",
        fontWeight: 600,
        maxWidth: "90vw",
      }}
      onClick={() => {
        sessionStorage.removeItem("soumdeco_auto_reloaded");
        window.location.reload();
      }}
    >
      <span>الموقع يستغرق وقتاً أطول من المعتاد</span>
      <span style={{ textDecoration: "underline" }}>إعادة المحاولة</span>
    </div>
  );
}
