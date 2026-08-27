// Glowline service worker — precache everything so the app runs with no
// network, and serve network-first so every load picks up the latest version
// while still working offline.
// Bump CACHE when any asset changes so clients pull the new version.
const CACHE = "oos-glowline-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/main.js",
  "./js/game.js",
  "./js/story.js",
  "./js/dialogue.js",
  "./js/audio.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Delete only this app's old caches: caches are shared per origin, so a
    // blanket delete would wipe the dashboard's and the other apps' offline copies.
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith("oos-glowline-")).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: every load fetches the latest and refreshes the cache, so a
// new version is picked up as soon as there is a connection. When the network
// is unavailable, fall back to the cached copy (and the cached shell for
// navigations) so the app still runs fully offline with no data.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return; // no cross-origin at runtime
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)); // keep the offline copy current
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || (request.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});
