import { CONTINUES } from './figureNotation'
import { NOTEHEAD_HALF, staffGap } from './renderGeometry'

/**
 * **Centre each figure under the note it belongs to.**
 *
 * Verovio places a `<harm>` by putting the *left edge* of its text at the x of
 * the thing it is anchored to, and it has no option for doing anything else.
 * That leaves a figure looking a little left of its bass note, because a digit
 * is narrower than a notehead — measured, a whole notehead is 269 units across
 * and a digit 203, so the figure's own centre falls a third of a notehead
 * short. It is a small distance and a consistent one, which is exactly what
 * makes it read as a mistake rather than as spacing.
 *
 * So the text is re-anchored: `text-anchor="middle"` at the notehead's centre,
 * which lets the browser do the measuring and comes out exact for a figure of
 * any width — one digit, two, or a digit with an accidental in front of it.
 * `<text x>` is the only thing that moves; nothing is re-engraved.
 *
 * **What is centred is the figure, not the text.** `4 – 3` writes a dash
 * running rightward toward the chord the suspension resolves into, so the text
 * is wider than the thing it is naming: centring all of it would drag the `4`
 * off to the left of the note it belongs to. So a line that continues is
 * centred half a dash further right, which puts the digits under the note and
 * lets the dash extend from them — which is what a continuation line is.
 */

/**
 * Half of what the continuation dash adds to a line, in staff-line gaps.
 *
 * Measured the same way: `4 –` draws 506 units wide against the 203 of the `4`
 * alone, so the dash and the space before it are 303, and pushing the line
 * half of that to the right leaves the digits where a figure without a dash
 * would have been. It is independent of what the digits are — figures are
 * tabular — so it holds for `♯4 –` as well as for `4 –`.
 */
const CONTINUES_HALF = 0.842

/**
 * One figure's stack of lines.
 *
 * The `<fb>` group rather than the `<harm>` around it, because an `<fb>` holds
 * nothing but `<text>` elements — so the first `</g>` after it is its own, and
 * there is no nesting to count.
 */
const STACK = /<g id="[^"]*" class="fb">[\s\S]*?<\/g>/g

/** One line of a figure: the text element Verovio drew it as. */
const LINE = /<text x="(-?[\d.]+)"([^>]*)>([\s\S]*?)<\/text>/g

/** What a reader sees, with the markup that carries it taken away. */
const written = (markup: string) => markup.replace(/<[^>]*>/g, '')

export function centreFigures(svg: string): string {
  const gap = staffGap(svg)
  if (gap === undefined) return svg

  const shift = NOTEHEAD_HALF * gap

  return svg.replace(STACK, (stack) =>
    stack.replace(LINE, (_line, x: string, rest: string, body: string) => {
      const continues = written(body).trim().endsWith(CONTINUES.trim())
      const dash = continues ? CONTINUES_HALF * gap : 0
      const centre = Math.round((Number(x) + shift + dash) * 100) / 100
      // **The engraver's own x is kept.** The cursor band reads these same
      // figures to find a chord that has not been written yet, and it wants
      // the place Verovio put the text rather than the place this moved it to
      // — which is not recoverable from the new one, since a continuing line
      // was pushed further than a plain one. Keeping it costs a few bytes and
      // means neither has to know the other's arithmetic, or run first.
      return `<text x="${centre}" data-engraved-x="${x}"${rest} text-anchor="middle">${body}</text>`
    }),
  )
}
