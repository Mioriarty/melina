import {
  PACED_CONTOUR,
  contourCurve,
  contourWidth,
  pacedWeight,
  steadyWeight,
} from '@/lib/music/contour'
import { TICKS_PER_BEAT } from '@/lib/music/meter'

/**
 * The numbers behind the pictures on the explainer.
 *
 * **Every one is computed from `contour.ts`, never copied out of it.** A
 * drawing of a curve redrawn from a second copy of the formula is a drawing
 * that can quietly stop being true — and this page exists precisely so someone
 * can trust what it shows. Turning a constant in `contour.ts` moves these
 * pictures with it.
 *
 * A sibling module rather than exports from the chart file, so that keeps
 * exporting only components and React Fast Refresh keeps working — the same
 * split as `ui/Button.tsx` and `ui/buttonClasses.ts`.
 */

/** The gaps the page talks about, with the key each is named under. */
export interface NamedGap {
  id: string
  ticks: number
}

export const SHOWN_GAPS: readonly NamedGap[] = [
  { id: 'sixteenth', ticks: TICKS_PER_BEAT / 4 },
  { id: 'quarter', ticks: TICKS_PER_BEAT },
  { id: 'half', ticks: TICKS_PER_BEAT * 2 },
]

/** How far either side of the last note the pictures reach. */
export const SPAN = 12

/** Points along the bare curve, for the smooth line. */
export function curvePoints(ticks: number, step = 0.25): { d: number; y: number }[] {
  const points: { d: number; y: number }[] = []
  for (let d = -SPAN; d <= SPAN + 1e-9; d += step) {
    points.push({ d, y: contourCurve(d, ticks) })
  }
  return points
}

/** The actual likelihood of each note, which is the curve with its notch. */
export function notePoints(ticks: number): { d: number; y: number }[] {
  return Array.from({ length: SPAN * 2 + 1 }, (_, index) => {
    const d = index - SPAN
    return { d, y: pacedWeight(d, ticks) }
  })
}

/** The steady weights, as the step function they are. */
export function steadyPoints(): { d: number; y: number }[] {
  return Array.from({ length: SPAN * 2 + 1 }, (_, index) => {
    const d = index - SPAN
    return { d, y: steadyWeight(d) }
  })
}

/** The tallest weight in a set, for scaling a picture to it. */
export function peak(points: readonly { y: number }[]): number {
  return Math.max(...points.map((point) => point.y), Number.EPSILON)
}

/* ------------------------------------------------------- width against gap */

/** Where the width stops growing, in beats. Read off the model, not assumed. */
export function cappedAtBeats(): number {
  return Math.pow(
    PACED_CONTOUR.maxWidth / PACED_CONTOUR.widthAtOneBeat,
    1 / PACED_CONTOUR.exponent,
  )
}

/**
 * How far the width chart runs, in beats.
 *
 * From the shortest gap a bar can actually contain to the longest, rather than
 * from zero: the stretch below a sixteenth is a region no melody ever visits,
 * and drawing it would put a steep rise on the picture that nothing can reach.
 */
export const WIDTH_CHART_FROM = 0.25
export const WIDTH_CHART_TO = 4

export function widthPoints(step = 0.02): { beats: number; width: number }[] {
  const points: { beats: number; width: number }[] = []
  for (let beats = WIDTH_CHART_FROM; beats <= WIDTH_CHART_TO + 1e-9; beats += step) {
    points.push({ beats, width: contourWidth(beats * TICKS_PER_BEAT) })
  }
  return points
}

/** The tallest width the chart has to show, so the plot is scaled to fit it. */
export function widestShown(): number {
  return contourWidth(WIDTH_CHART_TO * TICKS_PER_BEAT)
}

/** The note values marked along the width chart. */
export const WIDTH_MARKS: readonly NamedGap[] = [
  { id: 'sixteenth', ticks: TICKS_PER_BEAT / 4 },
  { id: 'eighth', ticks: TICKS_PER_BEAT / 2 },
  { id: 'quarter', ticks: TICKS_PER_BEAT },
  { id: 'half', ticks: TICKS_PER_BEAT * 2 },
  { id: 'whole', ticks: TICKS_PER_BEAT * 4 },
]

export function widthOf(ticks: number): number {
  return contourWidth(ticks)
}

/* --------------------------------------------------- the concrete comparison

   The table the page shows instead of a wall of numbers: a handful of named
   intervals, and how likely each is after a short note against a long one,
   as a share of that gap's likeliest move. A share rather than a raw weight,
   because the weights of two different gaps are not on the same scale. */

export interface ComparisonRow {
  /** Semitones from the last note. */
  semitones: number
  /** Share of the likeliest move at each of `SHOWN_GAPS`, in the same order. */
  shares: readonly number[]
}

/** Unison, step, third, fifth, octave — the moves anyone can name. */
export const COMPARED_INTERVALS: readonly number[] = [0, 2, 4, 7, 12]

export function comparisonRows(): ComparisonRow[] {
  return COMPARED_INTERVALS.map((semitones) => ({
    semitones,
    shares: SHOWN_GAPS.map((gap) => {
      const best = peak(notePoints(gap.ticks))
      return pacedWeight(semitones, gap.ticks) / best
    }),
  }))
}
