import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// This app lives inside the Offline OS monorepo. The source is here
// (sources/chess/) and `npm run build` writes the deployable app to
// ../../apps/chess/, which GitHub Pages serves as-is at
// https://chargingthefuture.github.io/offline-os/apps/chess/.
//
// The base is RELATIVE ('./') so every built asset URL (JS, CSS, the engine
// worker + wasm, the manifest, the service worker) resolves against wherever
// the app is served from — the Pages sub-path above, or a local static server
// started from the offline-os repo root. The engine worker URL uses
// import.meta.env.BASE_URL, so it picks this up automatically.
const BASE = './'

export default defineConfig({
  base: BASE,
  build: {
    // The deployable app lands next to the other OS apps; the source of truth
    // for its contents is this folder, so wiping it on each build is safe.
    outDir: '../../apps/chess',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      // Auto-update the service worker in the background; no update prompt needed
      // for a personal single-user app.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Chess Coach',
        short_name: 'Chess',
        description: 'Offline chess vs Stockfish with optional AI coaching.',
        lang: 'en',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        // Relative start_url and scope resolve against the manifest's own URL,
        // so the installed app stays scoped to apps/chess/ wherever it is served.
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell AND the default engine (worker JS + ~7 MB wasm) so the whole
        // app plays fully offline. The wasm is far over Workbox's 2 MiB default, so raise the
        // per-file cap to precache it.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,webmanifest}'],
        // Do NOT precache the ~10 MB no-WebAssembly fallback engine for everyone — only the
        // (rare) browsers that block WebAssembly need it. It is runtime-cached below instead,
        // so it downloads once, on first use, for those browsers only.
        globIgnores: ['**/stockfish-18-asm.js'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Cache the fallback engine the first time it's fetched, then serve it offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/engine/stockfish-18-asm.js'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'engine-asm-fallback',
              expiration: { maxEntries: 1 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Single-page app: serve the (base-prefixed) index.html for navigations when offline.
        navigateFallback: 'index.html',
      },
    }),
  ],
})
