// Glowline 2 service worker — precache every file the game loads so it runs fully
// offline and installs as an app. The strategy is network-first: when there is a
// connection every load fetches the latest files (so the app always refreshes to
// the newest version), and the cache is only used as a fallback when the network is
// unavailable or too slow — so the game still opens with no data.
const CACHE = 'oos-glowline2-v1';

// How long to wait for the network before falling back to the cached copy, so a weak
// or dropped connection still opens the game quickly instead of hanging.
const NETWORK_TIMEOUT = 4000;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/style.css',
  './src/main.js',
  './src/game.js',
  './src/render.js',
  './src/hud.js',
  './src/input.js',
  './src/level.js',
  './src/levels.js',
  './src/ship.js',
  './src/vec.js',
  './src/audio.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Delete only this app's old caches: caches are shared per origin, so a
    // blanket delete would wipe the dashboard's and the other apps' offline copies.
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith('oos-glowline2-')).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first: try the network so every online load gets the newest files (the app
// always refreshes), storing each fresh response for offline use. If the network fails
// or is too slow, fall back to the cached copy so the game still opens with no data.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return; // leave other origins alone
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const fromCache = () => caches.match(request)
    .then((hit) => hit || (request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  // Race the network against a timeout so a weak connection falls back fast.
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(async () => resolve((await fromCache()) || null), NETWORK_TIMEOUT);
  });

  const network = fetch(request).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)); // refresh the offline copy
    }
    return res;
  });

  try {
    const winner = await Promise.race([network, timeout]);
    clearTimeout(timer);
    // If the timeout won with a cached copy, use it; otherwise use the network response.
    if (winner) return winner;
    return (await network); // timeout had nothing cached — wait for the network
  } catch (_) {
    clearTimeout(timer);
    // Network rejected (offline): serve whatever we cached, or the app shell.
    const cached = await fromCache();
    return cached || Response.error();
  }
}
