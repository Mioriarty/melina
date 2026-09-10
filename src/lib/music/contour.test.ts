import { describe, expect, it } from 'vitest'

import {
  MELODIC_SHAPES,
  PACED_CONTOUR,
  contourWidth,
  isMelodicShape,
  leapWeight,
  pacedWeight,
  steadyWeight,
  type PacedContour,
} from './contour'
import { TICKS_PER_BEAT } from './meter'

/**
 * The claims this file makes, checked as properties rather than as numbers.
 *
 * The constants in `PACED_CONTOUR` are meant to be turned — the doc comment
 * says so and carries the measured table — so nothing here asserts a specific
 * width. What must survive any turning of them is asserted instead: that the
 * curve opens with the gap, that every interval stays reachable, and that a
 * repeated note is rarer than a step.
 */

/** The gaps worth naming, shortest to longest. */
const SIXTEENTH = TICKS_PER_BEAT / 4
const EIGHTH = TICKS_PER_BEAT / 2
const QUARTER = TICKS_PER_BEAT
const HALF = TICKS_PER_BEAT * 2
const WHOLE = TICKS_PER_BEAT * 4

const GAPS = [SIXTEENTH, EIGHTH, QUARTER, HALF, WHOLE]
/** Every interval within two octaves, which is wider than any level offers. */
const INTERVALS = Array.from({ length: 49 }, (_, index) => index - 24)

describe('the shapes', () => {
  it('are exactly the two there are', () => {
    expect([...MELODIC_SHAPES]).toEqual(['steady', 'paced'])
    expect(isMelodicShape('paced')).toBe(true)
    expect(isMelodicShape('wandering')).toBe(false)
  })

  it('are reached through one entry point', () => {
    expect(leapWeight('steady', 4, HALF)).toBe(steadyWeight(4))
    expect(leapWeight('paced', 4, HALF)).toBe(pacedWeight(4, HALF))
  })

  it('ignore the gap under steady, and follow it under paced', () => {
    // The whole difference between them, in two lines.
    expect(steadyWeight(7)).toBe(steadyWeight(7))
    expect(leapWeight('steady', 7, SIXTEENTH)).toBe(leapWeight('steady', 7, WHOLE))
    expect(leapWeight('paced', 7, SIXTEENTH)).not.toBe(leapWeight('paced', 7, WHOLE))
  })
})

describe('how wide the curve gets', () => {
  it('opens as the gap grows', () => {
    const widths = GAPS.map((gap) => contourWidth(gap))
    for (let index = 1; index < widths.length; index += 1) {
      expect(widths[index], `${GAPS[index]} ticks`).toBeGreaterThan(
        widths[index - 1] as number,
      )
    }
  })

  it('never closes past its floor or opens past its ceiling', () => {
    // A tuplet sixteenth is shorter than anything in the table, and a phrase
    // can hold a note lasting several bars.
    for (const gap of [1, 4, 12, ...GAPS, TICKS_PER_BEAT * 20]) {
      expect(contourWidth(gap), `${gap} ticks`).toBeGreaterThanOrEqual(
        PACED_CONTOUR.minWidth,
      )
      expect(contourWidth(gap), `${gap} ticks`).toBeLessThanOrEqual(
        PACED_CONTOUR.maxWidth,
      )
    }
  })

  it('cannot be driven to zero by a gap of nothing', () => {
    // Two impacts never share a tick, so this cannot arise — but a width of
    // zero would divide by zero in the curve, so it is ruled out rather than
    // reasoned about.
    expect(contourWidth(0)).toBeGreaterThan(0)
    expect(Number.isFinite(pacedWeight(5, 0))).toBe(true)
  })

  it('is a step at a sixteenth and most of an octave at a half note', () => {
    // Not an assertion about the exact constants, but about the range they
    // have to span for the two sketches to be different pictures at all.
    expect(contourWidth(SIXTEENTH)).toBeLessThan(3)
    expect(contourWidth(HALF)).toBeGreaterThan(7)
  })
})

describe('the paced curve', () => {
  it('gives every interval a weight above zero, at every gap', () => {
    // **The property that keeps a level honest.** A level offers a range of
    // notes; if the curve underflowed to zero for the far ones, the level
    // would quietly be narrower than it says.
    for (const gap of [1, ...GAPS, TICKS_PER_BEAT * 20]) {
      for (const semitones of INTERVALS) {
        expect(pacedWeight(semitones, gap), `${semitones} at ${gap}`).toBeGreaterThan(0)
      }
    }
  })

  it('holds that even with a curve tuned absurdly narrow', () => {
    // The floor is what makes it a guarantee rather than a happy accident of
    // the shipped numbers.
    const narrow: PacedContour = { ...PACED_CONTOUR, minWidth: 0.05, maxWidth: 0.05 }
    for (const semitones of INTERVALS) {
      expect(pacedWeight(semitones, QUARTER, narrow), `${semitones}`).toBeGreaterThan(0)
    }
  })

  it('falls away from the last note, and symmetrically', () => {
    for (const gap of GAPS) {
      for (let distance = 1; distance < 20; distance += 1) {
        expect(
          pacedWeight(distance, gap),
          `${distance} vs ${distance + 1} at ${gap}`,
        ).toBeGreaterThanOrEqual(pacedWeight(distance + 1, gap))
        // Up and down are the same distance; the direction of a line is
        // decided elsewhere.
        expect(pacedWeight(distance, gap)).toBe(pacedWeight(-distance, gap))
      }
    }
  })

  it('makes a repeated note rarer than a step', () => {
    // The notch. A repeat is legal — the rhythm tells two notes on one pitch
    // apart — but a line that keeps sitting still is not asking anything.
    for (const gap of GAPS) {
      expect(pacedWeight(0, gap), `${gap} ticks`).toBeLessThan(pacedWeight(1, gap))
      expect(pacedWeight(0, gap), `${gap} ticks`).toBeLessThan(pacedWeight(2, gap))
    }
  })

  it('still lets a repeat happen', () => {
    for (const gap of GAPS) {
      expect(pacedWeight(0, gap)).toBeGreaterThan(0)
    }
  })

  it('smears out rather than moving: a long gap lifts the far intervals', () => {
    // The sketch, stated as arithmetic. Read as a share of the weight given to
    // a step, a leap of a sixth is a rarity after a sixteenth and ordinary
    // after a half note — while the peak stays where it was, on the note just
    // sung.
    const share = (semitones: number, gap: number) =>
      pacedWeight(semitones, gap) / pacedWeight(1, gap)

    expect(share(9, SIXTEENTH)).toBeLessThan(0.1)
    expect(share(9, HALF)).toBeGreaterThan(0.4)

    // And the peak has not moved: the nearest note is still the likeliest.
    for (const gap of GAPS) {
      const weights = INTERVALS.filter((d) => d !== 0).map((d) => pacedWeight(d, gap))
      expect(Math.max(...weights)).toBe(pacedWeight(1, gap))
    }
  })

  it('is monotone in the gap for a wide leap, and the other way for a step', () => {
    // Opening the curve moves weight outwards from the centre, which is what
    // "smeared out" means: the far intervals gain share and the near ones lose
    // it. Measured as a share so the two are comparable at all.
    const share = (semitones: number, gap: number) => {
      const total = INTERVALS.reduce((sum, d) => sum + pacedWeight(d, gap), 0)
      return pacedWeight(semitones, gap) / total
    }

    const far = GAPS.map((gap) => share(10, gap))
    const near = GAPS.map((gap) => share(1, gap))

    for (let index = 1; index < GAPS.length; index += 1) {
      expect(far[index], `far at ${GAPS[index]}`).toBeGreaterThan(
        far[index - 1] as number,
      )
      expect(near[index], `near at ${GAPS[index]}`).toBeLessThan(
        near[index - 1] as number,
      )
    }
  })

  it('takes its parameters, so the curve can be turned', () => {
    const wide: PacedContour = { ...PACED_CONTOUR, widthAtOneBeat: 20 }
    const flat: PacedContour = { ...PACED_CONTOUR, unison: 1 }

    expect(contourWidth(QUARTER, wide)).toBeGreaterThan(contourWidth(QUARTER))
    // With no notch, the unison is simply the top of the curve.
    expect(pacedWeight(0, QUARTER, flat)).toBeGreaterThan(pacedWeight(1, QUARTER, flat))
    expect(pacedWeight(0, QUARTER)).toBeLessThan(pacedWeight(0, QUARTER, flat))
  })
})

describe('the steady curve', () => {
  it('gives every interval a weight above zero', () => {
    for (const semitones of INTERVALS) {
      expect(steadyWeight(semitones), `${semitones}`).toBeGreaterThan(0)
    }
  })

  it('prefers steps to leaps, and both to a repeat', () => {
    expect(steadyWeight(2)).toBeGreaterThan(steadyWeight(4))
    expect(steadyWeight(4)).toBeGreaterThan(steadyWeight(7))
    expect(steadyWeight(7)).toBeGreaterThan(steadyWeight(12))
    expect(steadyWeight(0)).toBeLessThan(steadyWeight(2))
  })

  it('never rises as the distance grows', () => {
    for (let distance = 1; distance < 24; distance += 1) {
      expect(steadyWeight(distance), `${distance}`).toBeGreaterThanOrEqual(
        steadyWeight(distance + 1),
      )
    }
  })

  it('reads a distance up and a distance down the same way', () => {
    for (const semitones of INTERVALS) {
      expect(steadyWeight(semitones)).toBe(steadyWeight(-semitones))
    }
  })
})
