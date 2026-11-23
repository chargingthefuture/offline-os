/* Hush was renamed Noise Cleanup (apps/noise-cleanup/). This worker replaces
 * the old one for anyone who opened Hush: it deletes the old offline copy
 * (including the 34 MB model) and unregisters itself, so the redirect page
 * loads from the network. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n.indexOf('hush-') === 0; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.registration.unregister(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (clients) { clients.forEach(function (c) { c.navigate(c.url); }); }));
});
