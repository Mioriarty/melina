import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { markSvg } from './mark.mjs'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/**
 * Regenerate the PWA icon set from the authored mark. Run `npm run icons`
 * after changing scripts/mark.mjs — the PNGs are committed so a plain
 * install/build needs no image toolchain.
 */
const TARGETS = [
  { file: 'pwa-192.png', size: 192, inset: 0.06 },
  { file: 'pwa-512.png', size: 512, inset: 0.06 },
  // Maskable icons are cropped by the platform; keep the mark inside the
  // inner 80% so a circular mask never clips it.
  { file: 'pwa-maskable-512.png', size: 512, inset: 0.18 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.08 },
]

await mkdir(publicDir, { recursive: true })

for (const { file, size, inset } of TARGETS) {
  const svg = markSvg({ size, inset, background: true })
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(publicDir, file))
  console.log(`wrote ${file} (${size}x${size})`)
}

// The favicon stays vector so it stays crisp in browser tabs.
await writeFile(
  join(publicDir, 'favicon.svg'),
  markSvg({ size: 32, inset: 0.04, background: false }),
  'utf8',
)
console.log('wrote favicon.svg')
