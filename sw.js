/* Offline OS — dashboard service worker.
 * Precaches the launcher shell and runtime-caches fonts so the dashboard
 * opens with zero network once it has been visited once. */
var VERSION = 'oos-dash-v5';
var SHELL = [
  './',
  './index.html',
  './apps.json',
  './manifest.webmanifest',
  './shared/theme.css',
  './shared/fonts.css',
  './shared/storage.js',
  './shared/pwa.js',
  './shared/fonts/barlow-semi-condensed-500.woff2',
  './shared/fonts/barlow-semi-condensed-600.woff2',
  './shared/fonts/barlow-semi-condensed-700.woff2',
  './shared/fonts/inter-var.woff2',
  './shared/icons/icon.svg',
  './shared/icons/icon-180.png',
  './shared/icons/icon-192.png',
  './shared/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        if (n !== VERSION && n.indexOf('oos-dash') === 0) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Page navigations: network-first. Serves fresh HTML with the correct
  // content-type when online (so the dashboard updates), and — importantly —
  // avoids an iOS Safari bug where a service-worker update makes a cached
  // navigation get downloaded instead of rendered. Falls back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (h) { return h || caches.match('./index.html'); });
      })
    );
    return;
  }

  // The app registry: network-first so newly added apps show up on reload
  // when online; fall back to the cached copy offline.
  if (url.origin === self.location.origin && /(^|\/)apps\.json$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // App shell / same-origin (fonts are now self-hosted): cache-first.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return caches.match('./index.html'); });
      })
    );
  }
});
