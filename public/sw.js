// ============================================================
//  SERVICE WORKER — Auto-clear stale cache on every visit
// ============================================================
//  This service worker ensures the client ALWAYS sees the latest
//  version of the website. It:
//  1. Clears old cached versions on activation
//  2. Serves static assets from cache (fast)
//  3. Always fetches fresh HTML from the network (no stale content)
//  4. Falls back to cache if the network fails (offline support)
// ============================================================

const CACHE_NAME = "soumdeco-v2";

// Files to cache immediately (app shell)
const APP_SHELL = [
  "/",
  "/logo.jpg",
  "/image-manifest.json",
  "/stock-seed.json",
];

// Install — cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Ignore failures — we'll cache on demand
      });
    })
  );
  self.skipWaiting(); // activate immediately
});

// Activate — clear OLD caches (from previous versions)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // take control immediately
});

// Fetch — network-first for HTML, cache-first for assets
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin requests (Apps Script, Cloudinary)
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML documents (always get fresh HTML)
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed — serve from cache (offline support)
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          // Cache the response for future
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // Network-first for JSON files (manifest, stock-seed)
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }
});
