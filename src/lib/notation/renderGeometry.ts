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
 * The distance between two staff lines, or `undefined` for a render with no
 * staff in it.
 *
 * Read off the horizontal rules themselves — a staff line is a `<path>` whose
 * two ends share a y. Ledger lines share that shape, but they sit *on* the
 * same ladder, so the smallest distance between any two of these is a staff
 * gap either way.
 */
export function staffGap(svg: string): number | undefined {
  const ys = [
    ...new Set(
      [...svg.matchAll(/<path d="M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) \2"/g)].map((found) =>
        Number(found[2]),
      ),
    ),
  ].sort((a, b) => a - b)

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
