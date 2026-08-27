/* Cascade service worker.
 *
 * Strategy: network-first, cache fallback.
 *  - When online, every load fetches the freshest files from the network and
 *    refreshes the cache, so a new deploy is always picked up immediately.
 *  - When offline (no data), requests fall back to the last cached copy, so
 *    the game keeps working with no connection.
 */
const CACHE = "oos-cascade-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // Activate this worker as soon as it finishes installing.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop this app's caches from previous versions only. Caches are shared
      // per origin, so deleting every non-matching cache here would wipe the
      // dashboard's and the other apps' offline copies.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k.indexOf("oos-cascade") === 0)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        // Always try the network first (bypassing the HTTP cache) so the
        // latest version wins on every online load.
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        // Offline: serve whatever we cached last.
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === "navigate") {
          const index = await caches.match("./index.html");
          if (index) return index;
        }
        throw err;
      }
    })()
  );
});
