import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project site from a subdirectory, so the production
// build is rooted at /melina/. Dev and tests stay at / — the deploy workflow
// can override this for a fork or a user-page (`/`) deployment.
const BASE = process.env.VITE_BASE_PATH ?? '/melina/'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'melina — ear training & composition',
        short_name: 'melina',
        description:
          'Interval, dictation, harmony and counterpoint exercises — preparation for composition studies.',
        lang: 'en',
        theme_color: '#0d6e6e',
        background_color: '#fcfcfa',
        display: 'standalone',
        orientation: 'any',
        // start_url and scope are deliberately absent: the plugin fills them
        // from Vite's base, so they follow the subdirectory automatically.
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts are self-hosted, so they precache with everything else.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Verovio is ~7 MB of wasm embedded in JavaScript. Precaching it
        // would mean every visitor downloads an engraver before seeing the
        // homescreen, so it is excluded here and cached on first use by the
        // runtime rule below instead. 404.html is a byte-for-byte copy of
        // index.html for GitHub Pages' deep-link fallback; precaching it
        // would only duplicate the shell.
        globIgnores: ['**/verovio-*.js', '**/404.html'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/verovio-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'melina-engraver',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Instrument samples, streamed by smplr. Cached on first use so
            // an instrument you have practised with still plays offline.
            // Never precached: the piano alone is tens of megabytes, and
            // which instrument you use is your choice, not the installer's.
            urlPattern: ({ url }) =>
              url.origin === 'https://smpldsnds.github.io' ||
              url.origin === 'https://gleitz.github.io',
            handler: 'CacheFirst',
            options: {
              cacheName: 'melina-samples',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Give Verovio a predictable filename so the service worker rules
        // above can single it out.
        manualChunks: (id) =>
          id.includes('node_modules/verovio') ? 'verovio' : undefined,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
}))
