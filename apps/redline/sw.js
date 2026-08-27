/* Service worker for Redline.
 *
 * Strategy: network-first. When you are online, every file is fetched fresh so
 * you always get the latest game — no hard refresh needed (mobile browsers make
 * that hard anyway). When you are offline, or the network is slow, it falls back
 * to the copy saved in the cache, so "add to home screen" still plays with no
 * connection. Each successful online fetch also refreshes the saved copy.
 *
 * When you add or rename a file the game loads, add it to FILES below so the very
 * first offline visit has it cached. Bumping CACHE_VERSION clears the old cache.
 */
const CACHE_VERSION = "oos-redline-v1";

const FILES = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/levels.js",
  "js/input.js",
  "js/audio.js",
  "js/game.js",
  "assets/favicon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
];

// How long to wait for the network before serving the cached copy, so a flaky
// mobile connection still loads the game quickly from cache.
const NETWORK_TIMEOUT = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Delete only this app's old caches: caches are shared per origin, so a
    // blanket delete would wipe the dashboard's and the other apps' offline copies.
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION && k.startsWith("oos-redline-")).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // don't touch cross-origin
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_VERSION);

  // Kick off the network request with "no-store" so it bypasses the browser's
  // HTTP cache and always pulls the newest file from the server — that is what
  // makes every online load a real refresh. On success it also saves the file
  // to the offline cache. It never rejects (resolves to null on failure) so
  // racing it is safe.
  const fromNetwork = fetch(req, { cache: "no-store" })
    .then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => null);

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT));

  // Prefer the network, but don't wait forever on a slow connection.
  const winner = await Promise.race([fromNetwork, timeout]);
  if (winner) return winner;

  // Network was slow, failed, or offline — serve the cached copy.
  const cached = await cache.match(req);
  if (cached) return cached;

  // Nothing cached for this request; wait out the network one last time, then
  // fall back to the app shell (covers navigations to unseen URLs).
  const late = await fromNetwork;
  if (late) return late;
  return (await cache.match("index.html")) || Response.error();
}
