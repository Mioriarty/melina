import { TICKS_PER_BEAT } from './meter'

/**
 * How far a melody leaps, and what decides it.
 *
 * A generator that draws each note independently of the last produces a line
 * that jumps about — every interval as likely as every other, which is neither
 * musical nor, for dictation, honest: the difficulty would come from the leaps
 * rather than from the degrees or the subdivisions the level actually names.
 * So the next note is drawn against a weight that falls away with distance
 * from the last one, and this file is that weight.
 *
 * Two shapes, and the difference between them is the whole point of the
 * second.
 */

/**
 * Which rule decides how far the line may move.
 *
 * - `steady` — one spread of intervals, the same at every note. Steps are
 *   common, thirds ordinary, wide leaps rare, and the rhythm has no say.
 * - `paced` — **the time to the next note sets the spread.** A quick note
 *   steps; a long one may leap. This is how melodies are actually written and
 *   how they are actually sung: a run of sixteenths that leaps a seventh at
 *   every note is unsingable and unhearable, while the same leap after a half
 *   note is ordinary. It is also what keeps the *rhythm* of a question from
 *   being contradicted by its pitches.
 */
export type MelodicShape = 'steady' | 'paced'

export const MELODIC_SHAPES: readonly MelodicShape[] = ['steady', 'paced']

export function isMelodicShape(value: string): value is MelodicShape {
  return (MELODIC_SHAPES as readonly string[]).includes(value)
}

/* ------------------------------------------------------------------ steady

   The original rule, kept because it is a different exercise rather than a
   worse one: a line whose leaps ignore the rhythm is harder, and a level may
   want that. */

const STEADY_WEIGHTS: readonly { within: number; weight: number }[] = [
  { within: 0, weight: 1.5 },
  { within: 2, weight: 8 },
  { within: 4, weight: 5 },
  { within: 7, weight: 2 },
  { within: 12, weight: 0.8 },
]
const STEADY_FAR = 0.2

/** How likely a note this far from the last one is, whatever the rhythm. */
export function steadyWeight(semitones: number): number {
  const distance = Math.abs(semitones)
  return STEADY_WEIGHTS.find((step) => distance <= step.within)?.weight ?? STEADY_FAR
}

/* ------------------------------------------------------------------- paced

   The weight is a curve centred on the last note, and the *width* of that
   curve is set by how long there is before the next one. */

export interface PacedContour {
  /**
   * How wide the curve is, in semitones, at a gap of exactly one beat.
   *
   * Read it as "at a quarter note, the line usually moves about this far".
   * Everything else scales off it.
   */
  widthAtOneBeat: number
  /**
   * How sharply the width follows the gap, as a power of it.
   *
   * `1` would make a half note twice as free as a quarter and a sixteenth a
   * quarter as free — too extreme at both ends, because a sixteenth then only
   * ever repeats its neighbour and a half note becomes uniform. Below `1` the
   * curve still opens with the gap but keeps its shape at both extremes.
   */
  exponent: number
  /**
   * The narrowest and widest the curve may get, in semitones.
   *
   * The floor is what stops a very short gap collapsing onto the unison; the
   * ceiling is what stops a very long one becoming a uniform draw over the
   * whole range, which is the plinky-plunky line this exists to avoid.
   */
  minWidth: number
  maxWidth: number
  /**
   * How much less likely a repeated note is than the curve alone would make
   * it.
   *
   * A repeat is not wrong — the rhythm distinguishes two notes on one pitch,
   * unlike in scale degrees where a repeat is a note not asked about — but a
   * melody that keeps sitting still is not asking anything either. `1` would
   * be no penalty at all.
   *
   * It has to be this deep because the *pool* is notes rather than intervals:
   * the nearest neighbours in a diatonic range are one or two semitones away,
   * and at a short gap the curve has barely fallen by then. Measured over
   * generated melodies, the share of repeated notes runs:
   *
   * | value | repeats |
   * | ----- | ------- |
   * | 0.3   | 12.0%   |
   * | 0.2   | 8.7%    |
   * | 0.15  | 7.0%    |
   * | 0.1   | 4.7%    |
   * | 0.06  | 2.5%    |
   */
  unison: number
  /**
   * The weight anything gets no matter how far away it is.
   *
   * **Every interval a level allows must be reachable**, or the level is
   * quietly narrower than it says. The curve is an exponential and so never
   * truly reaches zero, but at a small width and a wide leap it underflows to
   * one, and a floor is cheaper than reasoning about when.
   */
  floor: number
}

/**
 * The shipped curve.
 *
 * Measured against the two cases worth naming: a gap of a sixteenth comes out
 * around 2 semitones wide — steps and thirds, with anything wider rare — and a
 * gap of a half note around 9, which is nearly flat across an octave. Those
 * are the two sketches this was built from.
 *
 * | gap        | beats | width  | reads as                          |
 * | ---------- | ----- | ------ | --------------------------------- |
 * | sixteenth  | 0.25  | 2.0    | steps and thirds                  |
 * | eighth     | 0.5   | 3.3    | up to a fourth                    |
 * | quarter    | 1     | 5.4    | up to a fifth or sixth            |
 * | half       | 2     | 8.9    | an octave is ordinary             |
 * | whole      | 4     | 12.0   | capped: still not a uniform draw  |
 *
 * Meant to be turned. Nothing asserts these exact numbers — the tests assert
 * the *properties*: that width grows with the gap, that every interval keeps a
 * non-zero weight, and that a repeat is rarer than a step.
 */
export const PACED_CONTOUR: PacedContour = {
  widthAtOneBeat: 5.4,
  exponent: 0.72,
  minWidth: 1.2,
  maxWidth: 12,
  unison: 0.15,
  floor: 1e-4,
}

/**
 * How wide the curve is for a given gap.
 *
 * Exported because it is the thing worth checking directly: the whole claim of
 * `paced` is that this grows with the gap, and a test that reads it says so
 * more plainly than one that counts intervals.
 */
export function contourWidth(
  gapTicks: number,
  contour: PacedContour = PACED_CONTOUR,
): number {
  // A gap of zero cannot happen — two impacts never share a tick — but a
  // corrupt one must not produce a width of zero and divide by it below.
  const beats = Math.max(gapTicks, 1) / TICKS_PER_BEAT
  const width = contour.widthAtOneBeat * Math.pow(beats, contour.exponent)
  return Math.min(contour.maxWidth, Math.max(contour.minWidth, width))
}

/**
 * The bare curve, before the notch and the floor.
 *
 * An exponential falling away from the last note — peaked, with tails heavy
 * enough that a wide leap stays possible. The width is the only thing the gap
 * changes, which is what makes "the same shape, smeared out" the accurate
 * description of a long gap.
 *
 * Exported so the explainer can *draw* it. A picture of this curve redrawn
 * from a copy of the formula would be a picture that could quietly stop being
 * true; taking it from here means the page cannot disagree with the code it
 * describes.
 */
export function contourCurve(
  semitones: number,
  gapTicks: number,
  contour: PacedContour = PACED_CONTOUR,
): number {
  return Math.exp(-Math.abs(semitones) / contourWidth(gapTicks, contour))
}

/**
 * How likely a note this far from the last one is, given how long there is.
 *
 * The curve, notched at the unison and floored so nothing is ever impossible.
 */
export function pacedWeight(
  semitones: number,
  gapTicks: number,
  contour: PacedContour = PACED_CONTOUR,
): number {
  const curve = contourCurve(semitones, gapTicks, contour)
  const notched = semitones === 0 ? curve * contour.unison : curve

  return Math.max(contour.floor, notched)
}

/**
 * The weight one shape or the other gives a candidate note.
 *
 * The single entry point, so a generator picks a shape and then stops caring
 * which one it picked.
 */
export function leapWeight(
  shape: MelodicShape,
  semitones: number,
  gapTicks: number,
  contour: PacedContour = PACED_CONTOUR,
): number {
  return shape === 'paced'
    ? pacedWeight(semitones, gapTicks, contour)
    : steadyWeight(semitones)
}
