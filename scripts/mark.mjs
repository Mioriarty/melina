/**
 * The melina mark: a dark-grey paint spot with the accent dot of the "i"
 * sitting on it. Same two ideas as the homescreen — paint and one accent —
 * reduced to something legible at 48px.
 *
 * Authored here rather than as a static file so the maskable variant can
 * reuse the geometry at a different scale (maskable icons lose their outer
 * ~10% to the platform's mask).
 */

export const INK = '#1c1c1e'
export const ACCENT = '#0d6e6e'
export const PAPER = '#fcfcfa'

const BLOB =
  'M50 2C70 2 85 16 89 34C93 51 78 55 80 69C82 85 63 98 45 96C25 93 8 79 6 59C4 39 14 21 30 9C36 4 43 2 50 2Z'

/**
 * @param {object} options
 * @param {number} options.size    output square size in px
 * @param {number} options.inset   fraction of the canvas left empty on each
 *                                 side (0.1 gives a maskable safe zone)
 * @param {boolean} options.background  paint the paper ground
 */
export function markSvg({ size, inset = 0.06, background = true }) {
  const box = 100
  const scale = 1 - inset * 2
  const offset = (box * inset).toFixed(3)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${box} ${box}">
  ${background ? `<rect width="${box}" height="${box}" fill="${PAPER}"/>` : ''}
  <g transform="translate(${offset} ${offset}) scale(${scale.toFixed(4)})">
    <path d="${BLOB}" fill="${INK}"/>
    <circle cx="50" cy="46" r="13" fill="${ACCENT}"/>
  </g>
</svg>`
}
