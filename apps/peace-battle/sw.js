/* Peace-Battle — service worker. Precaches the shell (incl. shared assets) so it
 * runs fully offline. Bump VERSION to push updates.
 *
 * The book in sources/peace-battle/ is deliberately NOT listed here. It is committed so
 * the numbers can be checked, not shipped — precaching 232K of text would make every
 * install pay for something the game only quotes four lines of. */
var VERSION = 'peace-battle-v4';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
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
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }));
});
self.addEventListener('activate', function (e) {
  // Only this app's own caches, matched on the full 'peace-battle-v' prefix. Every app
  // here shares one origin, so an unscoped sweep would delete the other apps' shells —
  // and a bare 'peace-battle' prefix also matches 'peace-battle-2-v1', which would have
  // wiped Peace-Battle 2's cache every time this one activated.
  e.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.map(function (n) {
      if (n !== VERSION && n.indexOf('peace-battle-v') === 0) return caches.delete(n);
    }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Navigations network-first (avoids the iOS SW-update download bug).
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req).then(function (h) { return h || caches.match('./index.html'); }); }));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    }));
  }
});
