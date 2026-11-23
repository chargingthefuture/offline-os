/* Hush service worker. Precaches the page, the worker, the media libraries
 * and the 34 MB DeepFilterNet model so cleaning works with no connection.
 * Bump VERSION to update. */
var VERSION = 'hush-v1';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './worker.js',
  './vendor/mediabunny.min.mjs',
  './vendor/deepfilter.mjs',
  './vendor/aac-encoder.min.mjs',
  '../../shared/fonts.css',
  '../../shared/theme.css',
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
var MODEL = './vendor/df_bg.wasm';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // The model is large; a failed download must not stop the page installing.
    // It is fetched and cached again on first use.
    return c.addAll(SHELL).then(function () { return c.add(MODEL).catch(function () {}); });
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.map(function (n) {
      if (n !== VERSION && n.indexOf('hush-') === 0) return caches.delete(n);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Pages and the worker: network first, so a new deploy is picked up.
  if (req.mode === 'navigate' || /\/worker\.js$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (h) { return h || caches.match('./index.html'); });
    }));
    return;
  }
  // Everything else (libraries, model, fonts): cache first.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
