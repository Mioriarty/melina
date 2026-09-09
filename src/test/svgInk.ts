/**
 * Where the ink of an engraved SVG actually falls.
 *
 * Written for one job: proving that nothing Verovio draws runs off the page it
 * is given. That sounds like a thing to measure by rasterising, and it was —
 * until the rasteriser turned out to depend on the machine. Verovio writes
 * staff labels as `<text font-family="Times, serif">`, so a picture of a score
 * is only as stable as the fonts installed, and a check that passed on a laptop
 * failed on a Linux runner with a different idea of Times.
 *
 * So this reads the drawing instead. Every music glyph's outline is embedded in
 * the SVG's own `<defs>`, and each `<use>` says where to put one — which makes
 * the extent of the notation exactly computable, on any machine, without a
 * rasteriser and without fonts.
 *
 * **Text is deliberately not measured.** A staff label is not notation: it sits
 * outside the staff, its width belongs to whatever font renders it, and it is
 * not what "is a notehead being clipped" is asking about.
 */

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** How many coordinates each path command takes. */
const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  T: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  A: 7,
  Z: 0,
}

/**
 * The extent of one path.
 *
 * Curve control points are counted along with the ends, which can overstate a
 * box slightly — a Bézier stays inside its control hull. That is the safe
 * direction here: the answer is used to prove something *fits*, so erring
 * outwards can only make the check stricter.
 */
export function pathBox(d: string): Box | undefined {
  const tokens = [...d.matchAll(/([A-Za-z])|(-?\d*\.?\d+(?:e-?\d+)?)/g)].map((match) =>
    match[1] === undefined ? Number(match[2]) : match[1],
  )

  const xs: number[] = []
  const ys: number[] = []
  let command: string | undefined
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let index = 0

  const isNumber = (value: string | number | undefined): value is number =>
    typeof value === 'number'

  while (index < tokens.length) {
    const token = tokens[index]
    if (!isNumber(token)) {
      command = token
      index += 1
      if (command?.toUpperCase() === 'Z') {
        x = startX
        y = startY
      }
      continue
    }
    if (command === undefined) {
      index += 1
      continue
    }

    const upper = command.toUpperCase()
    const relative = command !== upper
    const count = ARITY[upper]
    if (count === undefined) break

    const args = tokens.slice(index, index + count)
    index += count
    if (args.length < count || !args.every(isNumber)) break

    if (upper === 'H') {
      x = relative ? x + (args[0] as number) : (args[0] as number)
    } else if (upper === 'V') {
      y = relative ? y + (args[0] as number) : (args[0] as number)
    } else {
      if (upper === 'C') {
        for (let k = 0; k < 4; k += 2) {
          xs.push(relative ? x + (args[k] as number) : (args[k] as number))
          ys.push(relative ? y + (args[k + 1] as number) : (args[k + 1] as number))
        }
      }
      const endX = args[count - 2] as number
      const endY = args[count - 1] as number
      x = relative ? x + endX : endX
      y = relative ? y + endY : endY
      if (upper === 'M') {
        startX = x
        startY = y
      }
    }

    xs.push(x)
    ys.push(y)
  }

  if (xs.length === 0) return undefined
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  }
}

function union(a: Box | undefined, b: Box): Box {
  if (a === undefined) return b
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
  }
}

/** Every glyph outline the drawing carries, by the id a `<use>` names. */
function glyphBoxes(svg: string): Map<string, Box> {
  const boxes = new Map<string, Box>()
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0]
  if (defs === undefined) return boxes

  for (const [, id, body] of defs.matchAll(/<g id="([^"]+)">([\s\S]*?)<\/g>/g)) {
    let box: Box | undefined
    for (const [, flip, d] of (body ?? '').matchAll(
      /<path(\s+transform="scale\(1,-1\)")?\s+d="([^"]*)"/g,
    )) {
      const measured = pathBox(d ?? '')
      if (measured === undefined) continue
      // Glyph outlines are stored y-upwards and drawn under `scale(1, -1)`.
      const placed =
        flip === undefined
          ? measured
          : { ...measured, y0: -measured.y1, y1: -measured.y0 }
      box = union(box, placed)
    }
    if (box !== undefined && id !== undefined) boxes.set(id, box)
  }

  return boxes
}

export interface Ink {
  /** The page, from the drawing's own viewBox. */
  page: Box
  /** Everything drawn on it, text excepted. */
  ink: Box
  /** The smallest gap between the two, in the drawing's own units. */
  clearance: number
}

/**
 * Measure a rendered score.
 *
 * Throws rather than returning something bland if there is nothing to measure —
 * a drawing with no ink in it means the render failed, and silently reporting
 * "plenty of room" would be the least useful possible answer.
 */
export function measureInk(svg: string): Ink {
  const viewBox = svg.match(
    /viewBox="(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/,
  )
  if (viewBox === null) throw new Error('the drawing has no viewBox')

  const [left, top, width, height] = viewBox.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const page: Box = { x0: left, y0: top, x1: left + width, y1: top + height }

  // Everything is drawn inside a group that carries the page margins, so the
  // coordinates on each path and glyph are relative to that corner rather than
  // to the page. Miss this and a staff line, which really does start at x = 0
  // of its own group, looks as though it were touching the edge of the paper.
  const margin = svg.match(
    /<g class="page-margin" transform="translate\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)"/,
  )
  const offsetX = margin === null ? 0 : Number(margin[1])
  const offsetY = margin === null ? 0 : Number(margin[2])

  const glyphs = glyphBoxes(svg)
  let ink: Box | undefined

  // Placed glyphs: a notehead, an accidental, a clef.
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/, '')
  for (const [, id, tx, ty, scale] of body.matchAll(
    /<use[^>]*href="#([^"]+)"[^>]*transform="translate\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)(?:\s*scale\((-?\d+(?:\.\d+)?)[^)]*\))?"/g,
  )) {
    const glyph = glyphs.get(id ?? '')
    if (glyph === undefined) continue
    const factor = scale === undefined ? 1 : Number(scale)
    ink = union(ink, {
      x0: Number(tx) + glyph.x0 * factor,
      x1: Number(tx) + glyph.x1 * factor,
      y0: Number(ty) + glyph.y0 * factor,
      y1: Number(ty) + glyph.y1 * factor,
    })
  }

  // Drawn strokes: staff lines, ledger lines, stems, beams, barlines.
  for (const [, widthAttr, d] of body.matchAll(
    /<path(?:\s+stroke-width="(\d+(?:\.\d+)?)")?\s+d="([^"]*)"/g,
  )) {
    const measured = pathBox(d ?? '')
    if (measured === undefined) continue
    // A stroke is centred on its path, so half of it lies outside.
    const half = (widthAttr === undefined ? 0 : Number(widthAttr)) / 2
    ink = union(ink, {
      x0: measured.x0 - half,
      x1: measured.x1 + half,
      y0: measured.y0 - half,
      y1: measured.y1 + half,
    })
  }

  if (ink === undefined) throw new Error('nothing was drawn')

  const placed: Box = {
    x0: ink.x0 + offsetX,
    x1: ink.x1 + offsetX,
    y0: ink.y0 + offsetY,
    y1: ink.y1 + offsetY,
  }

  return {
    page,
    ink: placed,
    clearance: Math.min(
      placed.x0 - page.x0,
      page.x1 - placed.x1,
      placed.y0 - page.y0,
      page.y1 - placed.y1,
    ),
  }
}
