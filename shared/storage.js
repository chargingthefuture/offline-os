/* Offline OS — shared storage layer.
 *
 * Drop-in replacement for the non-standard `window.storage` bridge the apps
 * were prototyped against. Backed by localStorage so it actually persists on
 * a real device (iPhone home-screen PWA included).
 *
 * Every key is namespaced with a prefix so:
 *   - apps can't collide with each other or with anything else on the origin
 *     (GitHub Pages project sites all share one origin), and
 *   - the dashboard can export/import EVERY app's data in one shot.
 *
 * API (promise-based, matches what the apps already call):
 *   await window.storage.get(key)   -> { value } | null
 *   await window.storage.set(key, value)
 *   await window.storage.remove(key)
 *
 * Backup helpers (used by the dashboard's Export / Import):
 *   window.storage.exportAll()      -> { "<key>": "<value>", ... }
 *   window.storage.importAll(obj, { merge })   merge=false wipes OS data first
 */
(function () {
  var PREFIX = 'oos:';

  function get(key) {
    var v = localStorage.getItem(PREFIX + key);
    return Promise.resolve(v === null ? null : { value: v });
  }
  function set(key, value) {
    localStorage.setItem(PREFIX + key, String(value));
    return Promise.resolve();
  }
  function remove(key) {
    localStorage.removeItem(PREFIX + key);
    return Promise.resolve();
  }

  function keys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out.push(k);
    }
    return out;
  }

  function exportAll() {
    var data = {};
    keys().forEach(function (k) {
      data[k.slice(PREFIX.length)] = localStorage.getItem(k);
    });
    return data;
  }

  function importAll(obj, opts) {
    opts = opts || {};
    if (opts.merge === false) {
      keys().forEach(function (k) { localStorage.removeItem(k); });
    }
    Object.keys(obj || {}).forEach(function (k) {
      localStorage.setItem(PREFIX + k, String(obj[k]));
    });
  }

  window.storage = {
    get: get,
    set: set,
    remove: remove,
    exportAll: exportAll,
    importAll: importAll,
    PREFIX: PREFIX
  };
})();
