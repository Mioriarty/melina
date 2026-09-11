/**
 * **Where the answer is being written, marked on the engraved page.**
 *
 * A figured bass can carry several chords — two under one bass note for a
 * suspension, and one under each of several bass notes for a line — and the
 * keyboard fills them strictly in order. Which one is in hand is a fact the
 * player otherwise has to infer from how much of the staff is already full,
 * which is exactly the sort of counting a cursor exists to remove. So the slot
 * being written into is given a band of its own behind the music: the chord
 * above, the bass below and the figure under that, all in one column.
 *
 * **It is drawn into the render rather than over it.** An HTML overlay would
 * have to be positioned against an SVG the column has already scaled down to
 * fit, which is a measurement this app deliberately never makes; a `<rect>` in
 * the engraver's own coordinate space is placed once and then scales with
 * everything else, for free and exactly.
 *
 * **Where the slots are can only be read back off the render**, because only
 * the engraver knows where it put them. Three things make that reliable rather
 * than a guess, and `scoreCursor.test.ts` pins all three against the real
 * engraver:
 *
 * - **An authored `xml:id` survives into the SVG as the element's `id`.**
 *   `thoroughbassMei` names every sonority `chord<event>-<position>` and every
 *   figure `figure<event>-<position>`, so a slot is found rather than counted.
 * - **A measure's own staff lines give its width**, as a horizontal `<path>`
 *   from the left edge to the right. It is the one piece of geometry that is
 *   there whatever has or has not been written.
 * - **Nothing moves as the answer is typed.** The page is a fixed size and the
 *   system is stretched to fill it, so a slot keeps its x from the first
 *   keypress to the last — which is what lets the band be computed from
 *   whatever happens to be engraved at the moment it is asked for.
 *
 * That last point is also why the anchor may be read off different things at
 * different moments without the band moving. A slot carrying several chords
 * anchors them by timestamp, and Verovio lays the figure out at the timestamp
 * too, so the chord and its figure come out at **exactly** the same x: in the
 * realising direction, where the chords are empty at first, the figures stand
 * in for them and the band does not shift when the notes arrive.
 *
 * A bass note carrying one chord is anchored on the bass note instead, and
 * that is not for want of anything better. Its figure is offset from the note
 * rather than aligned to it (a lone figure is anchored by `@startid`, not by a
 * timestamp), and a plain triad is figured by writing nothing at all, so there
 * may be no figure to find; the bass note is the one thing always drawn and
 * always in the right place.
 */

/** Which chord of the question is being written into. Both indices 0-based. */
export interface ScoreCursor {
  /** Which bass note. */
  event: number
  /** Which chord under that bass note. */
  position: number
}

/**
 * How far above the topmost staff line the band reaches, in staff-line gaps.
 * Enough to cover the ledger lines a chord can climb onto without leaving so
 * much empty paper above the music that the band reads as a column of nothing.
 */
const RISE = 3

/** Kept clear of the page's own bottom edge, so the band reads as a band. */
const FOOT = 60

/** A corner just soft enough not to read as a form control. */
const CORNER = 110

/**
 * How far in front of a note its measure begins, in staff-line gaps.
 *
 * Only ever needed for the **first** measure of a system, where the distance
 * from the edge to the first note is the clef and the key signature rather
 * than the engraver's ordinary padding, and a band centred on that note
 * therefore reaches back over the clef and highlights it. Measured off the
 * other measures of the same render, which are padded by the ordinary amount
 * and so say what it is; this is the fallback for a question with only one.
 */
const LEAD = 1.4

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** One chord's place along the system. */
interface Slot {
  event: number
  position: number
  x: number
}

/**
 * The page's content area, in the coordinate space the music is drawn in.
 *
 * Everything inside `page-margin` shares one space — Verovio puts no further
 * transform on the system, the measures or the staves — so a `<rect>` added
 * there needs no matrix of its own. What the margin costs is that the space is
 * offset from the viewBox's, which is what this undoes.
 */
function pageBox(svg: string): Box | undefined {
  const view = /viewBox="0 0 (-?[\d.]+) (-?[\d.]+)"/.exec(svg)
  const margin =
    /<g class="page-margin"[^>]*transform="translate\((-?[\d.]+),\s*(-?[\d.]+)\)"/.exec(
      svg,
    )
  if (view === null || margin === null) return undefined

  const dx = Number(margin[1])
  const dy = Number(margin[2])
  return {
    left: -dx,
    right: Number(view[1]) - dx,
    top: -dy,
    bottom: Number(view[2]) - dy,
  }
}

/** The markup of each `<g class="measure">`, in the order they are drawn. */
function measureChunks(svg: string): readonly string[] {
  const starts = [...svg.matchAll(/<g id="[^"]*" class="measure">/g)].map(
    (found) => found.index,
  )
  return starts.map((start, at) => svg.slice(start, starts[at + 1] ?? svg.length))
}

/**
 * How wide a measure is, and where its staves begin.
 *
 * Read off the staff lines themselves. Ledger lines are horizontal paths too
 * and sit *inside* the measure, so the longest one is the staff — which is
 * also the only one whose length is the measure's own.
 */
function measureSpan(
  chunk: string,
): { left: number; right: number; top: number } | undefined {
  let left = 0
  let right = 0
  let top: number | undefined
  let widest = 0

  for (const line of chunk.matchAll(
    /<path d="M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) (-?[\d.]+)"/g,
  )) {
    const [x1, y1, x2, y2] = [1, 2, 3, 4].map((at) => Number(line[at])) as [
      number,
      number,
      number,
      number,
    ]
    if (y1 !== y2) continue
    if (top === undefined || y1 < top) top = y1
    const width = Math.abs(x2 - x1)
    if (width > widest) {
      widest = width
      left = Math.min(x1, x2)
      right = Math.max(x1, x2)
    }
  }

  return top === undefined ? undefined : { left, right, top }
}

/** The staff-line gap, which is the unit everything on a staff is measured in. */
function staffGap(chunk: string): number | undefined {
  const ys = [
    ...new Set(
      [...chunk.matchAll(/<path d="M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) \2"/g)].map(
        (found) => Number(found[2]),
      ),
    ),
  ].sort((a, b) => a - b)

  const gaps = ys.slice(1).map((y, at) => y - (ys[at] as number))
  const smallest = Math.min(...gaps)
  return Number.isFinite(smallest) && smallest > 0 ? smallest : undefined
}

/** Where the element with this id was drawn, or `undefined` if it was not. */
function anchorOf(chunk: string, id: string): number | undefined {
  const at = chunk.indexOf(`id="${id}"`)
  if (at === -1) return undefined

  const rest = chunk.slice(at)
  // A notehead is placed by a transform and a figure by its text's own x.
  const placed = /transform="translate\((-?[\d.]+),/.exec(rest)
  const written = /<text x="(-?[\d.]+)"/.exec(rest)
  const first =
    placed === null
      ? written
      : written === null
        ? placed
        : placed.index < written.index
          ? placed
          : written
  return first === null ? undefined : Number(first[1])
}

/**
 * Every chord of the render, in the order they are written into.
 *
 * The count per bass note comes from the ids that are actually there: a
 * suspension always has two figures printed under it — the resolution writes
 * the line that moved, so it can never come out empty — and in the figuring
 * direction the chords themselves are the question and are always drawn. A
 * bass note with neither carries exactly one chord, and is anchored on the
 * bass note.
 */
function slotsOf(svg: string): readonly Slot[] {
  const slots: Slot[] = []

  measureChunks(svg).forEach((chunk, index) => {
    const event = index + 1
    const anchors: number[] = []
    for (let position = 1; ; position += 1) {
      const anchor =
        anchorOf(chunk, `chord${event}-${position}`) ??
        anchorOf(chunk, `figure${event}-${position}`)
      if (anchor === undefined) break
      anchors.push(anchor)
    }

    if (anchors.length <= 1) {
      const span = measureSpan(chunk)
      const lone =
        anchorOf(chunk, `bass${event}`) ??
        anchors[0] ??
        (span === undefined ? undefined : (span.left + span.right) / 2)
      if (lone !== undefined) slots.push({ event: index, position: 0, x: lone })
      return
    }

    anchors.forEach((x, position) => slots.push({ event: index, position, x }))
  })

  return slots
}

/**
 * The band marking one chord, drawn behind the music.
 *
 * **Every band is the same width**, which is what makes it read as one thing
 * moving rather than as a highlight that keeps changing shape. The width is
 * the closest two chords on the page ever come, so a band can never reach into
 * its neighbour however uneven the engraver's spacing turned out. The band
 * over the first chord of a system is the one exception, and only where being
 * held off the clef narrows it — see `musicLeft`.
 *
 * Returns the render untouched when there is nothing to say: fewer than two
 * chords is a question with only one place to be, and a cursor marking the
 * only place there is tells the player nothing they did not know.
 */
export function markSlot(svg: string, cursor: ScoreCursor): string {
  const page = pageBox(svg)
  const slots = slotsOf(svg)
  if (page === undefined || slots.length < 2) return svg

  const at = slots.findIndex(
    (slot) => slot.event === cursor.event && slot.position === cursor.position,
  )
  const found = slots[at]
  if (found === undefined) return svg

  const gaps = slots.slice(1).map((slot, index) => slot.x - (slots[index] as Slot).x)
  const half = Math.min(...gaps) / 2
  if (!Number.isFinite(half) || half <= 0) return svg

  const chunks = measureChunks(svg)
  const chunk = chunks[found.event]
  const span = chunk === undefined ? undefined : measureSpan(chunk)
  const gap = chunk === undefined ? undefined : staffGap(chunk)

  // The band stops where the music does. Left to the page's own edge the
  // first one reaches back across the clef and the key signature and reads as
  // though the clef were what was being written into.
  const left = Math.max(page.left, musicLeft(chunks), found.x - half)
  const right = Math.min(page.right, found.x + half)
  const top = span === undefined || gap === undefined ? page.top : span.top - RISE * gap
  const bottom = page.bottom - FOOT

  // **`stroke-width` rather than `stroke`.** Every render carries a stylesheet
  // of Verovio's own containing `#<id> rect { stroke: currentcolor }` — an ID
  // selector, which beats both a class of ours and a presentation attribute,
  // so the band cannot be told not to have an outline. It can be told to draw
  // one no pixels wide, which the rule says nothing about.
  const rect =
    `<rect class="score-cursor" x="${round(left)}" y="${round(top)}" ` +
    `width="${round(right - left)}" height="${round(bottom - top)}" ` +
    `rx="${CORNER}" stroke-width="0" pointer-events="none" aria-hidden="true"/>`

  // First child of the page, so the staff lines, the notes and the figures are
  // all drawn over it and the band reads as paper rather than as a pane.
  return svg.replace(/(<g class="page-margin"[^>]*>)/, `$1${rect}`)
}

/**
 * Where the music of the system begins — past the clef and the key signature.
 *
 * The ordinary padding in front of a measure's first note is what every
 * measure but the first has; the first has that *plus* the clef and the
 * signature. So the others are measured and the same allowance given to the
 * first, which is exact without anyone having to know how wide a clef is.
 */
function musicLeft(chunks: readonly string[]): number {
  const first = chunks[0]
  if (first === undefined) return Number.NEGATIVE_INFINITY

  const opening = anchorOf(first, 'bass1')
  if (opening === undefined) return Number.NEGATIVE_INFINITY

  const leads = chunks.slice(1).flatMap((chunk, index) => {
    const span = measureSpan(chunk)
    const anchor = anchorOf(chunk, `bass${index + 2}`)
    return span === undefined || anchor === undefined ? [] : [anchor - span.left]
  })

  const gap = staffGap(first)
  const lead = leads.length > 0 ? Math.min(...leads) : gap === undefined ? 0 : LEAD * gap
  return opening - lead
}

const round = (value: number) => Math.round(value * 100) / 100
