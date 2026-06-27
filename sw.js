/* Offline OS — dashboard service worker.
 * Precaches the launcher shell and runtime-caches fonts so the dashboard
 * opens with zero network once it has been visited once. */
var VERSION = 'oos-dash-v1';
var SHELL = [
  './',
  './index.html',
  './apps.json',
  './manifest.webmanifest',
  './shared/theme.css',
  './shared/storage.js',
  './shared/pwa.js',
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

  // Fonts (Google Fonts CSS + files): stale-while-revalidate.
  if (url.hostname.indexOf('fonts.googleapis.com') !== -1 ||
      url.hostname.indexOf('fonts.gstatic.com') !== -1) {
    e.respondWith(
      caches.open('oos-fonts').then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { c.put(req, res.clone()); return res; })
            .catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // App shell / same-origin: cache-first, fall back to network.
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
