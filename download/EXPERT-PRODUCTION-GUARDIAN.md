# EXPERT PRODUCTION GUARDIAN PROTOCOL

## MISSION
Ensure the website NEVER goes down — not on cold start, not under load, not on any browser, not on any network. Zero timeouts, zero crashes, zero white screens. Every visitor sees content within 2 seconds or sees a graceful fallback.

## THE 10 COMMANDMENTS (never violate)

1. **HTML must render WITHOUT JavaScript.** The server-rendered HTML always shows meaningful content (logo, brand name, tagline, skeleton loaders). If JS fails entirely, the page still looks alive — not a blank white screen.

2. **Never block rendering.** No synchronous `localStorage.getItem` during SSR. No `await` in the render path. All data fetching happens in `useEffect` (after paint). The initial paint is always instant.

3. **Every fetch has a timeout.** No fetch hangs forever. 10s for data, 5s for manifest/seed. If it times out, fall back to cache/seed. The user never waits more than 10 seconds.

4. **Cache is king.** localStorage (instant) → IndexedDB (large) → seed (bundled). If ALL network fails, the user still sees products. The site is NEVER empty.

5. **No infinite loops.** No `while(true)`, no recursive `setTimeout` chains that can spiral. Polling is bounded and cleaned up on unmount.

6. **All state is try/caught.** `JSON.parse`, `localStorage.getItem`, `fetch` — every external operation is wrapped in try/catch. A corrupted cache never crashes the app.

7. **The ErrorBoundary is the last line of defense.** If React throws during render, the user sees a friendly "refresh" button — not a white screen.

8. **LoadingFallback catches stuck pages.** If skeletons show for >6 seconds or the screen is blank, a refresh button appears. Auto-reload after 15 seconds (once, via sessionStorage guard).

9. **No service workers.** They cause more problems than they solve (stuck loading, stale cache). HTTP headers (`_headers` file) handle cache-busting on ALL browsers.

10. **Push to GitHub only AFTER local verification.** Build → wrangler dev → Playwright test → if all green → push. Never push untested code.

## EXECUTION CHECKLIST (run before EVERY push)

```
1. npx next build (0 errors)
2. npx @cloudflare/next-on-pages@1 (0 errors)
3. wrangler pages dev → Playwright test (0 errors, 0 stuck skeletons)
4. git push origin main
5. Wait 90s → production Playwright test (0 errors)
```

## THE GOLDEN RULE
> If a change could introduce a new bug, don't make it. The simplest fix that works is better than the smartest fix that might break something.
