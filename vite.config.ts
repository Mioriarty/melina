import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
        start_url: '/',
        scope: '/',
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
        // runtime rule below instead.
        globIgnores: ['**/verovio-*.js'],
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
})
