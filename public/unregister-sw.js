// Service Worker Un-Registration
// This runs on page load and UNREGISTERS any existing service worker.
// This is critical because the previous service worker (sw.js) was causing
// the "stuck at loading" issue for some users. We need to remove it from
// all clients who already registered it.
(function () {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Unregister ALL service workers
  navigator.serviceWorker
    .getRegistrations()
    .then(function (registrations) {
      for (var i = 0; i < registrations.length; i++) {
        registrations[i].unregister();
      }
    })
    .catch(function () {
      // Ignore errors
    });

  // Also clear ALL caches (from the old service worker)
  if ("caches" in window) {
    caches.keys().then(function (names) {
      for (var i = 0; i < names.length; i++) {
        caches.delete(names[i]);
      }
    });
  }
})();
