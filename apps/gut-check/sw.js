/* Gut Check — service worker. Precaches the app shell (including the shared
 * theme + storage) so it opens fully offline. Bump VERSION to push updates. */
var VERSION = 'gut-check-v4';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  '../../shared/fonts.css',
  '../../shared/storage.js',
  '../../shared/pwa.js',
  '../../shared/fonts/barlow-semi-condensed-500.woff2',
  '../../shared/fonts/barlow-semi-condensed-600.woff2',
  '../../shared/fonts/barlow-semi-condensed-700.woff2',
  '../../shared/fonts/inter-var.woff2',
  '../../shared/icons/icon.svg',
  '../../shared/icons/icon-180.png',
  '../../shared/icons/icon-192.png',
  '../../shared/icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        if (n !== VERSION && n.indexOf('gut-check') === 0) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

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
