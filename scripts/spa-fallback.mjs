/**
 * GitHub Pages is a plain static file server: it knows nothing about client
 * routes, so a deep link like /melina/train/intervals/hearing has no file
 * behind it and Pages falls back to 404.html.
 *
 * Shipping a byte-for-byte copy of index.html under that name turns the
 * fallback into the app itself — it boots at the requested URL and React
 * Router renders the right route. (The response still carries a 404 status,
 * which browsers render regardless; the service worker's navigateFallback
 * takes over on every later visit.)
 */
import { copyFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

const dist = new URL('../dist/', import.meta.url)

await copyFile(new URL('index.html', dist), new URL('404.html', dist))

console.log(`spa-fallback: wrote ${fileURLToPath(new URL('404.html', dist))}`)
