/* Offline OS — service worker registration helper.
 * Each page calls: registerPWA('sw.js')  (path relative to the page). */
function registerPWA(swPath) {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swPath).catch(function (e) {
      console.warn('[offline-os] service worker registration failed:', e);
    });
  });
}

/* External links open in the device's browser, not inside the installed app.
 * An installed app (display: standalone) otherwise loads an off-site link in
 * its own window or an in-app browser sheet. One delegated click handler covers
 * every page that loads this file, including links added after load. */
(function () {
  var ios = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = navigator.standalone === true ||
    (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  function openOutside(href) {
    // iOS 17+ hands x-safari-https:// links to Safari. Older iOS ignores the
    // scheme, so if the page is still visible shortly after, fall back.
    if (ios && standalone) {
      var left = false;
      function onHide() { if (document.hidden) left = true; }
      document.addEventListener('visibilitychange', onHide);
      location.href = 'x-safari-' + href;
      setTimeout(function () {
        document.removeEventListener('visibilitychange', onHide);
        if (!left) window.open(href, '_blank', 'noopener');
      }, 800);
      return;
    }
    window.open(href, '_blank', 'noopener');
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin) return;
    e.preventDefault();
    openOutside(url.href);
  });
})();
