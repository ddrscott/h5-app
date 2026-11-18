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
        // The page itself (index.html) is not precached. Pages come from the network so Cloudflare
        // can add its Web Analytics beacon to every visit; see the NetworkFirst rule below.
        globPatterns: ['h5/**/*.{js,css,svg,png,ico,webmanifest,woff2}'],
        globIgnores: ['h5/sw.js', 'h5/workbox-*.js'],
        // Precache URLs are relative to the service worker (/h5/sw.js), so make them absolute.
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.map((e) => ({ ...e, url: `/${e.url}` })),
            warnings: [],
          }),
        ],
        // No navigateFallback: it would answer page loads from a cached copy without the beacon.
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Page loads under /h5: network first (fresh HTML with the analytics beacon), and the
            // last good copy only when the network is down or slower than 3 seconds.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && /^\/h5(\/|$)/.test(url.pathname) && !url.pathname.startsWith(`${BASE}/api/`),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'h5-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [200] },
            },
          },
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
