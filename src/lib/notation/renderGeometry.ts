/**
 * Reading a finished render back.
 *
 * Two things in the app place something against music the engraver has already
 * laid out — the cursor band marking the chord being written into, and the
 * centring of a figure under its bass note — and both have to ask the render
 * where the music actually went, because only the engraver knows. What they
 * share is the unit: **the staff-line gap is what everything on a staff is
 * measured in**, so a length expressed in gaps is the same length at any staff
 * size, and nothing here has to know which profile it is looking at.
 */

/**
 * Every horizontal rule in a render — the staff lines and the ledger lines.
 *
 * **A rule has length, and insisting on that is not pedantry.** A note the
 * question has not revealed yet is engraved in place and not painted, and
 * Verovio gives such a note a *degenerate stem*: `<path d="M933 2430 L933
 * 2430"/>`, whose two ends share a y as surely as a staff line's do. Its y is
 * the notehead's, which sits on a space as often as on a line — so counting it
 * halved the measured staff gap and put the top of the page wherever the
 * highest hidden note happened to be. Nothing about that is visible in a render
 * that has no hidden notes, which is every render this file was written
 * against.
 */
export function horizontalRules(
  chunk: string,
): readonly { x1: number; x2: number; y: number }[] {
  return [...chunk.matchAll(/<path d="M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) \2"/g)]
    .map((found) => ({
      x1: Number(found[1]),
      x2: Number(found[3]),
      y: Number(found[2]),
    }))
    .filter((rule) => rule.x1 !== rule.x2)
}

/**
 * The distance between two staff lines, or `undefined` for a render with no
 * staff in it.
 *
 * Read off the horizontal rules themselves. Ledger lines are rules too, but
 * they sit *on* the same ladder, so the smallest distance between any two of
 * these is a staff gap either way.
 */
export function staffGap(svg: string): number | undefined {
  const ys = [...new Set(horizontalRules(svg).map((rule) => rule.y))].sort(
    (a, b) => a - b,
  )

  const gaps = ys.slice(1).map((y, at) => y - (ys[at] as number))
  const smallest = Math.min(...gaps)
  return Number.isFinite(smallest) && smallest > 0 ? smallest : undefined
}

/**
 * Half a notehead, in staff-line gaps.
 *
 * Shared, because the two things that place something against the music both
 * need to know where a note's *middle* is and the render only ever says where
 * its left edge is: a notehead is a `<use>` of a symbol, which carries no
 * width at all.
 *
 * Measured rather than derived — the glyph's advance is inside the font, and
 * what is wanted is where its ink actually falls. A whole notehead draws 269
 * units across a 180-unit staff gap, so half of it is 0.747 gaps. In gaps
 * rather than in units, so it holds at any staff size.
 *
 * The bass of a figured bass is always a whole note. A suspension's second
 * chord is a *half* note, 234 units and so 17 narrower on each side, which is
 * a fifth of a millimetre on a phone and not worth a second constant that
 * could come to disagree with this one.
 */
export const NOTEHEAD_HALF = 0.747
