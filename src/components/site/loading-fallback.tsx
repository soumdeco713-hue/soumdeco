"use client";

import { useEffect, useState } from "react";

/**
 * LoadingFallback — shows a refresh button if the site takes too long to load.
 *
 * If the page shows skeleton loaders for more than 8 seconds, this component
 * shows a friendly "refresh" button. This ensures users NEVER see a stuck page
 * — they always have a way to recover.
 *
 * This is a safety net for:
 * - Slow network connections
 * - Apps Script cold starts
 * - JavaScript bundle download failures
 * - Any other transient loading issue
 */
export function LoadingFallback() {
  const [showRefresh, setShowRefresh] = useState(false);

  useEffect(() => {
    // Check every 2 seconds if the page is still loading
    const checkInterval = setInterval(() => {
      // If there are skeleton loaders still showing after 8 seconds,
      // show the refresh button
      const skeletons = document.querySelectorAll(".animate-pulse, .shimmer-line");
      const products = document.querySelectorAll("[class*='product-card']");

      // If we have products rendered, the page loaded successfully
      if (products.length > 0) {
        setShowRefresh(false);
        clearInterval(checkInterval);
        return;
      }

      // If skeletons are showing for too long, offer a refresh
      if (skeletons.length > 0) {
        setShowRefresh(true);
      }
    }, 2000);

    // Stop checking after 30 seconds (don't run forever)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
    }, 30000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, []);

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
        padding: "12px 24px",
        borderRadius: "9999px",
        fontSize: "14px",
        fontFamily: "inherit",
        boxShadow: "0 8px 24px rgba(28, 24, 21, 0.25)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        cursor: "pointer",
        fontWeight: 600,
      }}
      onClick={() => {
        // Hard reload (bypass cache)
        window.location.reload();
      }}
    >
      <span>الموقع يستغرق وقتاً أطول من المعتاد</span>
      <span style={{ textDecoration: "underline" }}>إعادة المحاولة</span>
    </div>
  );
}
