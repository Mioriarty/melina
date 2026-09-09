/**
 * Lift the note and rest outlines the keyboard draws out of Verovio.
 *
 * Leland ships inside the Verovio WebAssembly rather than as a web font, so
 * there is no file to subset. What there is instead is Verovio's own SVG
 * output, which embeds the outline of every glyph it drew — so this renders one
 * bar containing every value and copies them out.
 *
 * Run with `npm run glyphs` after changing which values the keyboard offers.
 * The result is committed: the keyboard has to draw before the engraver has
 * finished downloading.
 */
import { writeFileSync } from 'node:fs'

import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'

/** SMuFL codepoint to the name the keyboard knows it by. */
const WANTED = {
  E0A2: ['noteheadWhole', 'A whole note has no stem: the head is the glyph.'],
  E0A3: ['noteheadHalf', 'Hollow, and the only thing separating a half from a quarter.'],
  E0A4: ['noteheadBlack', 'Every value from a quarter down.'],
  E241: ['flag8thDown', 'Hangs off the bottom of a downward stem.'],
  E243: ['flag16thDown', 'Two hooks, drawn as one glyph rather than two.'],
  E4E3: ['restWhole', 'Hangs *below* its line.'],
  E4E4: ['restHalf', 'Sits *on* its line — the only thing telling the two apart.'],
  E4E5: ['restQuarter', ''],
  E4E6: ['rest8th', ''],
  E4E7: ['rest16th', ''],
}

const MEI = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
  <meiHead><fileDesc><titleStmt><title/></titleStmt><pubStmt/></fileDesc></meiHead>
  <music><body><mdiv><score>
    <scoreDef meter.count="60" meter.unit="4">
      <staffGrp><staffDef n="1" lines="1" clef.shape="perc" clef.line="1"/></staffGrp>
    </scoreDef>
    <section><measure n="1"><staff n="1"><layer n="1">
      <note dur="1" loc="0"/>
      <note dur="2" loc="0" stem.dir="down"/>
      <note dur="4" loc="0" stem.dir="down"/>
      <note dur="8" loc="0" stem.dir="down"/>
      <note dur="16" loc="0" stem.dir="down"/>
      <rest dur="1" loc="0"/><rest dur="2" loc="0"/><rest dur="4" loc="0"/>
      <rest dur="8" loc="0"/><rest dur="16" loc="0"/>
    </layer></staff></measure></section>
  </score></mdiv></body></music></mei>`

const toolkit = new VerovioToolkit(await createVerovioModule())
toolkit.setOptions({ font: 'Leland', header: 'none', footer: 'none', breaks: 'none' })
if (!toolkit.loadData(MEI)) throw new Error('Verovio could not parse the probe')

const defs = toolkit.renderToSVG(1).match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? ''
const found = {}
for (const [, code, body] of defs.matchAll(
  /<g id="(E[0-9A-F]{3})-[^"]*">([\s\S]*?)<\/g>/g,
)) {
  const paths = [...body.matchAll(/<path transform="scale\(1,-1\)" d="([^"]*)"/g)]
  if (paths.length > 0) found[code] = paths.map((match) => match[1]).join(' ')
}

const missing = Object.keys(WANTED).filter((code) => found[code] === undefined)
if (missing.length > 0) throw new Error(`Verovio did not draw: ${missing.join(', ')}`)

/**
 * Where a glyph's ink actually falls, in font units.
 *
 * Needed because these are anchored the way notation anchors them rather than
 * on their own middle: a notehead's origin is its **left edge**, which is where
 * a downward stem meets it, and a rest's origin is the line it hangs from or
 * sits on. A keyboard key has neither a staff nor a stem to refer to, so it has
 * to place them from measurements rather than by eye.
 *
 * Control points are counted along with the curve ends, which can overstate a
 * bounding box slightly. That is the safe direction: a glyph is never clipped.
 */
const ARITY = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0 }

function boundingBox(d) {
  const tokens = [...d.matchAll(/([A-Za-z])|(-?\d*\.?\d+(?:e-?\d+)?)/g)].map((match) =>
    match[1] === undefined ? Number(match[2]) : match[1],
  )

  const xs = []
  const ys = []
  let command
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let i = 0

  const at = (value) => typeof value === 'number'

  while (i < tokens.length) {
    if (!at(tokens[i])) {
      command = tokens[i]
      i += 1
      if (command.toUpperCase() === 'Z') {
        x = startX
        y = startY
      }
      continue
    }
    if (command === undefined) {
      i += 1
      continue
    }

    const upper = command.toUpperCase()
    const relative = command !== upper
    const count = ARITY[upper]
    const args = tokens.slice(i, i + count)
    i += count
    if (args.length < count || !args.every(at)) break

    const push = (px, py) => {
      xs.push(px)
      ys.push(py)
    }

    if (upper === 'H') {
      x = relative ? x + args[0] : args[0]
    } else if (upper === 'V') {
      y = relative ? y + args[0] : args[0]
    } else {
      // Curves: keep the control points too, then land on the end point.
      if (upper === 'C') {
        for (let k = 0; k < 4; k += 2) {
          push(relative ? x + args[k] : args[k], relative ? y + args[k + 1] : args[k + 1])
        }
      }
      const [ex, ey] = args.slice(-2)
      x = relative ? x + ex : ex
      y = relative ? y + ey : ey
      if (upper === 'M') {
        startX = x
        startY = y
      }
    }
    push(x, y)
  }

  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
}

const parts = [
  `/**
 * Note and rest outlines, taken from Leland.
 *
 * **Generated — run \`npm run glyphs\` rather than editing this.**
 *
 * Leland is the notation font inside the Verovio WebAssembly, so there is no
 * file to subset; \`scripts/extract-glyphs.mjs\` lifts these out of Verovio's own
 * SVG output instead. They are baked in because the keyboard has to draw before
 * 7 MB of engraver has finished downloading, and a key that arrives late is a
 * key that moves under a thumb.
 *
 * Coordinates are the font's own, **y upwards**, so everything is drawn under a
 * \`scale(1, -1)\`. Each glyph keeps notation's own anchor rather than its
 * middle: a notehead's origin is its **left edge**, which is where a downward
 * stem meets it, and a rest's origin is the line it hangs from or sits on —
 * which is the entire difference between a whole rest and a half rest. \`box\`
 * is the measured ink, since a key has neither a staff nor a stem to place
 * them against.
 *
 * Leland is by MuseScore BVBA under the SIL Open Font License 1.1 — the same
 * font this app already ships inside Verovio.
 */

export interface Glyph {
  /** SMuFL codepoint, so a glyph can be checked against the standard. */
  code: string
  /** Path data in font units, y upwards. */
  d: string
  /** Where the ink falls, measured. See the note above about anchors. */
  box: { x0: number; x1: number; y0: number; y1: number }
}
`,
]

for (const [code, [name, note]] of Object.entries(WANTED)) {
  if (note !== '') parts.push(`/** ${note} */`)
  const box = boundingBox(found[code])
  const measured = `{ x0: ${box.x0}, x1: ${box.x1}, y0: ${box.y0}, y1: ${box.y1} }`
  parts.push(
    `export const ${name}: Glyph = {\n  code: '${code}',\n  d: '${found[code]}',\n  box: ${measured},\n}\n`,
  )
}

writeFileSync(
  new URL('../src/components/notation/glyphs.ts', import.meta.url),
  parts.join('\n'),
)
console.log(`extracted ${Object.keys(WANTED).length} glyphs from Leland`)
