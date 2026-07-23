# 🚀 Netlify Free Tier Survival Guide

> **What this is:** A mandatory configuration guide for deploying this Next.js architecture (Google Sheet + Cloudinary) to Netlify's free tier without hitting the 300-credit monthly limit.
>
> **When to apply:** Apply these settings to ANY website built from the SoumDecoDZ( elmiizaan in this case) master template before deploying to Netlify. Without these, 10,000 visits/month will exhaust Netlify's free tier limits.

---

## The Problem: Netlify's April 2026 Policy (300 Credits/Month)

Netlify's free plan (as of April 2026) operates on a 300-credit monthly system:

| Resource | Credit Cost | Max If All 300 Credits Used |
| :--- | :--- | :--- |
| **Production Deploys** | 15 credits per deploy | 20 deploys/month |
| **Bandwidth** | 20 credits per GB | **15 GB total** |
| **Web Requests** | 2 credits per 10,000 requests | 1.5 million requests/month |
| **Compute (Functions/Build)** | 10 credits per GB-hour | 30 GB-hours/month |
| **AI Inference** | 180 credits per $1 USD of AI | $1.66 of AI usage/month |

**The Trap:** A Next.js website with API routes (serverless functions) that fetches from a Google Sheet on every visit will burn through these limits in days if traffic spikes.

---

## The Solution: 4 Mandatory Optimizations

These 4 optimizations drop your monthly credit usage from **~339 credits (FAIL)** to **~181 credits (SAFE)**, with a 120-credit safety margin for traffic spikes.

### Optimization 1: 30-Minute Server Cache (ISR)

**What it does:** Caches API route responses at the CDN edge for 30 minutes. 10,000 visitors in 30 minutes share 1 single function call.

**How to apply:** Add `export const revalidate = 1800;` to the top of every API route that fetches from the Google Sheet.

**File:** `src/app/api/products/route.ts`
```typescript
// Cache this route's GET response at the server/CDN level for 30 minutes.
// This means thousands of visitors will share 1 single function invocation.
export const revalidate = 1800;

// GET /api/products → list all products from the sheet
export async function GET() {
  const products = await sheetListProducts();
  return NextResponse.json(
    { ok: true, products },
    {
      headers: {
        // Browser caches for 60s, then serves stale while revalidating.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
```

**File:** `src/app/api/stock/route.ts`
```typescript
export const revalidate = 1800;
```

**Impact:** Reduces function invocations and compute runtime by 99%. The single biggest credit saver.

---

### Optimization 2: 30-Minute Client Polling

**What it does:** The browser hooks (`use-catalog.ts`, `use-stock.ts`) poll the server every 30 minutes instead of every 5.5 minutes. Background tabs stop polling entirely after 1 hour.

**How to apply:** Update the polling constants in both hooks.

**File:** `src/hooks/use-catalog.ts`
```typescript
const POLL_MS = 1_800_000; // poll every 30 minutes when visible
const HIDDEN_POLL_MS = 3_600_000; // 1 hour when tab is hidden
const HIDDEN_STOP_MS = 3_600_000; // 1 hour — stop polling entirely if hidden this long
```

**File:** `src/hooks/use-stock.ts`
```typescript
const POLL_MS = 1_800_000; // 30 minutes
const HIDDEN_POLL_MS = 3_600_000; // 1 hour when tab is hidden
const HIDDEN_STOP_MS = 3_600_000; // 1 hour — stop polling entirely if hidden this long
```

**Impact:** Reduces web requests by 80%. Eliminates background-tab drain.

---

### Optimization 3: Google Fonts CDN (Instead of next/font)

**What it does:** Loads fonts directly from Google's CDN instead of self-hosting them through Netlify. Saves ~80KB per first visit.

**How to apply:**

1. Remove `next/font/google` imports from `src/app/layout.tsx`.
2. Add `<link>` tags to the `<head>` in `layout.tsx`:

```tsx
<head>
  {/* Google Fonts CDN — saves ~80KB per first visit on Netlify bandwidth */}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap"
    rel="stylesheet"
  />
</head>
```

3. Update `src/app/globals.css` to use the font names directly instead of CSS variables:

```css
@theme inline {
  --font-sans: 'Inter', sans-serif;
  --font-serif: 'Cormorant Garamond', serif;
  --font-arabic: 'Noto Sans Arabic', sans-serif;
}
```

**Impact:** Saves ~80KB per first visit. For 40,000 first visits/month, this saves ~3.2 GB of Netlify bandwidth (64 credits).

---

### Optimization 4: 24-Hour Static Asset Cache

**What it does:** Tells the browser to cache CSS, JS, and static images for 24 hours. Repeat visitors within 24 hours download zero static assets from Netlify.

**How to apply:** Add `headers()` configuration to `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // 24-hour client cache for static assets (CSS, JS, images)
  // Saves bandwidth on repeat visits — browser doesn't re-download files
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, immutable",
          },
        ],
      },
      {
        source: "/products/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Impact:** Cuts bandwidth by 50%+ for returning visitors.

---

## Before vs After (77,500 visits/month scenario)

| Resource | Before (Unoptimized) | After (Optimized) | Savings |
| :--- | :--- | :--- | :--- |
| Bandwidth | ~10.8 GB (216 credits) | ~4.5 GB (90 credits) | 58% |
| Deploys | 75 credits | 75 credits | 0% |
| Web Requests | 47 credits | ~15 credits | 68% |
| Compute | 1 credit | <1 credit | 99% |
| **Total** | **339 / 300** ❌ | **~181 / 300** ✅ | **47%** |

**Safety margin: 120 credits.** You can handle traffic spikes 60% larger than expected and still survive the month.

---

## Trade-offs (What the customer experiences)

1. **New products/stock changes take up to 30 minutes to appear** for public visitors. (Admin panel sees them instantly.)
2. **Future code changes (colors, text) take up to 24 hours to appear** for returning visitors (unless they hard-refresh with Ctrl+F5).
3. Orders and admin actions remain instant and unaffected.

---

## Checklist for New Websites

When building a new client website from the SoumDecoDZ template, apply these 4 optimizations BEFORE deploying to Netlify:

- [ ] Add `export const revalidate = 1800;` to all API routes (`/api/products`, `/api/stock`).
- [ ] Set `POLL_MS = 1_800_000` in `use-catalog.ts` and `use-stock.ts`.
- [ ] Move fonts from `next/font/google` to Google Fonts CDN `<link>` tags.
- [ ] Update `globals.css` to use font names directly (`'Inter'`, etc.) instead of CSS variables.
- [ ] Add 24-hour `Cache-Control` headers in `next.config.ts`.
- [ ] Verify `.env` variables are set in Netlify dashboard (not just local `.env`).
- [ ] Test the site after deploy to confirm products, orders, and stock sync work.

---

## Emergency Protocol (If You Hit the Limit Anyway)

If Netlify pauses your site mid-month due to credit exhaustion:

1. **Don't panic.** Your Google Sheet, Cloudinary images, and Apps Script are untouched. No data is lost.
2. The site will come back online automatically on the 1st of the next month.
3. If you need it back immediately, consider migrating to **Cloudflare Pages** (unlimited bandwidth on free tier). The code adaptation takes ~1 hour.
4. To migrate to Cloudflare: extract the source archive, remove the `next.config.ts` headers config, and deploy as a Cloudflare Pages project with the same `.env` variables.

