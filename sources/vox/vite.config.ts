import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// This app lives inside the Offline OS monorepo. The source is here (sources/vox/)
// and `npm run build` writes the deployable app to ../../apps/vox/, which GitHub
// Pages serves as-is at https://chargingthefuture.github.io/offline-os/apps/vox/.
// The base is RELATIVE ('./') so every asset URL resolves against wherever the app
// is served from — the Pages sub-path above, or a local static server started from
// the offline-os repo root.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000, // phaser is one big chunk; that is expected
    // The deployable app lands next to the other OS apps; this folder is the
    // source of truth for its contents, so wiping it on each build is safe.
    outDir: '../../apps/vox',
    emptyOutDir: true,
  },
  plugins: [
    // Offline + always-fresh. A service worker precaches the whole game (one JS bundle plus a
    // handful of static files), so it plays with no network once loaded. `autoUpdate` fetches a
    // new deploy in the background and applies it on the next load — no manual cache clearing,
    // no stale versions. skipWaiting/clientsClaim let the new worker take over immediately.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered explicitly in src/main.ts
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
