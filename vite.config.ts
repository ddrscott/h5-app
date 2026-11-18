import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The app is served from askscottpierce.com/h5. Keep in step with src/client/base.ts,
// src/worker/index.ts, and wrangler.jsonc.
//
// Vite's `base` option isn't used: the Cloudflare plugin would still write files to the build
// root while index.html points at /h5/…. Emitting files under h5/ makes file path equal URL.
const BASE = '/h5'

export default defineConfig({
  build: { assetsDir: 'h5/assets' },
  plugins: [
    react(),
    cloudflare(),
    // The PWA belongs to the browser build only, not the Worker's.
    ...VitePWA({
      registerType: 'autoUpdate',
      // Lands at /h5/sw.js, inside this app's routes.
      filename: 'h5/sw.js',
      scope: `${BASE}/`,
      // The web manifest is a plain file, public/h5/manifest.webmanifest. The plugin's generated one
      // adds precache entries that skip manifestTransforms and resolve to /h5/h5/….
      manifest: false,
      includeAssets: [],
      workbox: {
        // Only this app's files: the build root holds the Worker's output too.
        globPatterns: ['index.html', 'h5/**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        globIgnores: ['h5/sw.js', 'h5/workbox-*.js'],
        // Precache URLs are relative to the service worker (/h5/sw.js), so make them absolute.
        // index.html is served at /h5/ (single-page fallback); /index.html belongs to the main site.
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.map((e) => ({ ...e, url: e.url === 'index.html' ? `${BASE}/` : `/${e.url}` })),
            warnings: [],
          }),
        ],
        navigateFallback: `${BASE}/`,
        navigateFallbackAllowlist: [/^\/h5(\/|$)/],
        navigateFallbackDenylist: [/^\/h5\/api\//],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'h5-google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'h5-gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Room sockets and any future API calls always go to the network.
            urlPattern: /\/h5\/api\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }).map((p) => ({ ...p, applyToEnvironment: (env: { name: string }) => env.name === 'client' })),
  ],
})
