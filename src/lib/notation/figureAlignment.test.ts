// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { pitch } from '@/lib/music/pitch'

import { centreFigures } from './figureAlignment'
import { thoroughbassMei, type ThoroughbassEvent } from './mei'
import { staffGap } from './renderGeometry'
import { renderMei, thoroughbassProfile } from './verovio'

/**
 * Where a figure lands under its bass note, against the real engraver.
 *
 * **Nothing here can see whether a figure is centred**, and that is worth
 * being plain about: centring is a fact about ink, and the width of a drawn
 * glyph is not in the SVG — a notehead is a `<use>` of a symbol and a figure
 * is `<text>`, neither of which carries a width. It was measured in a browser
 * instead, by reading `getBBox()` off both, and what came back is in
 * `figureAlignment.ts`: a plain figure now sits exactly on its notehead's
 * centre, where before it sat 101 units to the right of it.
 *
 * What this file can hold is everything that measurement rested on — that
 * Verovio still anchors a figure where it did, that the offset is applied, and
 * that it is applied to every line of every figure — so the day any of it
 * changes underneath, the numbers are re-measured rather than quietly wrong.
 */

const fig = (key: string) => parseFigureKey(key) as Figure

const C4 = pitch('C', 0, 4)
const E4 = pitch('E', 0, 4)
const G4 = pitch('G', 0, 4)
const B3 = pitch('B', 0, 3)

function render(events: readonly ThoroughbassEvent[]) {
  const slots = events.reduce(
    (total, event) => total + Math.max(1, event.figures.length),
    0,
  )
  return renderMei(
    thoroughbassMei({ keySignature: '0', events }),
    undefined,
    thoroughbassProfile(slots, 0),
  )
}

const line = (bass: string, figure: string, chord = [E4, G4]): ThoroughbassEvent => ({
  bass: pitch(bass as 'C', 0, 3),
  figures: [fig(figure)],
  chords: [chord],
})

/** Every figure line the render drew, as `{ x, anchored }`. */
function figures(svg: string) {
  return [...svg.matchAll(/<text x="(-?[\d.]+)"([^>]*)>/g)].map((found) => ({
    x: Number(found[1]),
    anchored: (found[2] ?? '').includes('text-anchor="middle"'),
  }))
}

/** Where the notehead of the nth bass note was placed. */
function bassX(svg: string, n: number): number {
  const at = svg.indexOf(`id="bass${n}"`)
  expect(at, `bass${n} is not in the render`).toBeGreaterThan(-1)
  return Number(/transform="translate\((-?[\d.]+),/.exec(svg.slice(at))?.[1])
}

describe('a figure under its bass note', () => {
  it('is moved to the middle of the notehead, not left at its edge', async () => {
    // The measured number: a whole notehead draws 269 units wide, so its
    // centre is 134.5 from the left edge Verovio would have used.
    const raw = await render([line('E', '6')])
    const gap = staffGap(raw) as number
    const [before] = figures(raw)
    const [after] = figures(centreFigures(raw))

    expect(before?.anchored).toBe(false)
    expect(after?.anchored).toBe(true)
    expect((after?.x ?? 0) - (before?.x ?? 0)).toBeCloseTo(0.747 * gap, 1)
  })

  it('starts from the same place under every bass note of a line', async () => {
    // The bug this whole thing is about: one figure under a bass note used to
    // be anchored by `@startid` and several by `@tstamp`, and the two do not
    // put the text in the same place — so a question carrying a suspension
    // beside a plain bass note drew its figures visibly out of line.
    const svg = await render([
      line('C', '6'),
      { bass: pitch('G', 0, 3), figures: [fig('4'), fig('3')], chords: [[C4], [B3]] },
      line('F', '6'),
    ])

    // Every figure that opens a bass note starts where that note's head does.
    for (const n of [1, 2, 3]) {
      const at = svg.indexOf(`id="figure${n}-1"`)
      const x = Number(/<text x="(-?[\d.]+)"/.exec(svg.slice(at))?.[1])
      expect(x, `figure${n}-1`).toBeCloseTo(bassX(svg, n), 0)
    }
  })

  it('moves every line of a stack, and of every figure', async () => {
    const svg = centreFigures(
      await render([
        { bass: pitch('G', 0, 3), figures: [fig('6/4')], chords: [[C4, E4]] },
        line('C', '6'),
      ]),
    )
    const drawn = figures(svg)

    // Two lines for the six-four and one for the sixth.
    expect(drawn).toHaveLength(3)
    for (const one of drawn) expect(one.anchored).toBe(true)
    // A stack is a column: both of its lines take the same x.
    expect(drawn[0]?.x).toBe(drawn[1]?.x)
  })

  it('pushes a continuing figure further, so its digits keep the middle', async () => {
    // `4 – 3` writes a dash running toward the chord it resolves into, so the
    // text is wider than what it names and centring all of it would drag the
    // `4` left of its own note.
    const svg = await render([
      { bass: pitch('G', 0, 3), figures: [fig('4'), fig('3')], chords: [[C4], [B3]] },
    ])
    const gap = staffGap(svg) as number
    const before = figures(svg)
    const after = figures(centreFigures(svg))

    const moved = (at: number) => (after[at]?.x ?? 0) - (before[at]?.x ?? 0)
    expect(moved(0)).toBeCloseTo((0.747 + 0.842) * gap, 1)
    expect(moved(1)).toBeCloseTo(0.747 * gap, 1)
  })

  it('leaves a render with no figures in it alone', async () => {
    const svg = await render([
      { bass: pitch('C', 0, 3), figures: [], chords: [[E4, G4]] },
    ])

    expect(centreFigures(svg)).toBe(svg)
  })
})
