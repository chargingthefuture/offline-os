// Entry point: wait for the DOM, then start the game on the single canvas.
import { Game } from './game.js';

function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  // Exposed for debugging and smoke tests; not used by the game itself.
  window.__glowline = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Register the service worker so the game installs and plays offline. Relative
// path so it works under any base path (for example a GitHub Pages subpath).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No service worker (for example opened from the file system) — the game
      // still runs, it just will not be installable or available offline.
    });
  });
}
