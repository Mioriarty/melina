import { intervalSemitones, type Interval } from '@/lib/music/interval'
import { getMode, MODE_IDS, type ModeId } from '@/lib/music/scale'

/**
 * Every mode read against the two everyone already knows.
 *
 * **Computed from `scale.ts`, never authored** — the same reason
 * `contourSeries.ts` exists for the melodic shape guide, and `FigureTable` for
 * the figured bass one. A page that describes a model by hand is a page that
 * can come to describe something the app no longer does; this one is the model
 * evaluated, so it cannot.
 *
 * The whole of it is one comparison. A mode is stored as the interval from its
 * tonic to each degree, so two modes differ exactly where those intervals
 * differ, and "lydian is major with a raised fourth" is not a mnemonic somebody
 * wrote down but the difference between two rows of `DEGREE_QUALITIES`.
 *
 * **Which of the two a mode is read against is computed too**, and it has to
 * be: saying dorian is minor with a raised sixth rather than major with a
 * flattened third and seventh is the whole value of the shortcut, and the rule
 * behind it is simply *whichever is closer*. It comes out one-sided every time
 * — lydian and mixolydian read as major, dorian, phrygian and locrian as minor
 * — with no tie to break anywhere, which `ModesPage.test.ts` pins.
 */

/** The two modes every other one is a small change to. */
const MAJOR: ModeId = 'ionian'
const MINOR: ModeId = 'aeolian'

/** One degree of a mode, and how it stands against the major scale's. */
export interface ModeDegree {
  /** 1 to 7. The eighth is the octave in every mode and is left out. */
  number: number
  interval: Interval
  /**
   * Semitones against the major scale's degree of the same number: `-1` for a
   * flattened degree, `1` for a raised one, `0` where they agree. This is what
   * the familiar `1 2 ♭3 4 5 6 ♭7` shorthand writes.
   */
  against: number
}

/** A degree that has to be changed to get from one mode to another. */
export interface ModeChange {
  number: number
  interval: Interval
  /** Which way it moves from the reference mode. */
  direction: -1 | 1
}

export interface ModeSummary {
  id: ModeId
  /** Which degree of a major scale the mode begins on. Ionian is 1. */
  degree: number
  degrees: readonly ModeDegree[]
  /** Major or minor, whichever this mode is fewer changes away from. */
  reference: ModeId
  /** What to change in the reference to reach it. Empty for major and minor. */
  changes: readonly ModeChange[]
}

/** Degrees 1–7 of a mode. The octave is the same in all of them. */
function degreesOf(id: ModeId): readonly Interval[] {
  return getMode(id).intervals.slice(0, 7)
}

/** How far apart two modes' nth degrees are, in semitones. */
function distance(a: Interval, b: Interval): number {
  return (intervalSemitones(a) ?? 0) - (intervalSemitones(b) ?? 0)
}

function changesFrom(reference: ModeId, id: ModeId): readonly ModeChange[] {
  const from = degreesOf(reference)
  return degreesOf(id).flatMap((interval, index) => {
    const was = from[index]
    if (was === undefined) return []
    const moved = distance(interval, was)
    if (moved === 0) return []
    return [{ number: index + 1, interval, direction: moved > 0 ? 1 : -1 } as const]
  })
}

export function modeSummary(id: ModeId): ModeSummary {
  const major = changesFrom(MAJOR, id)
  const minor = changesFrom(MINOR, id)
  // Whichever is the smaller change. Ties cannot arise among the seven — see
  // the test — so there is nothing to break one with.
  const closer = minor.length < major.length ? MINOR : MAJOR

  return {
    id,
    degree: getMode(id).degree,
    degrees: degreesOf(id).map((interval, index) => ({
      number: index + 1,
      interval,
      against: distance(interval, degreesOf(MAJOR)[index] as Interval),
    })),
    reference: closer,
    changes: closer === MINOR ? minor : major,
  }
}

export function modeSummaries(): readonly ModeSummary[] {
  return MODE_IDS.map(modeSummary)
}

/**
 * The `♭3` of `1 2 ♭3 4 5 6 ♭7`.
 *
 * Notation rather than language: a degree written against the major scale is
 * the same symbol in every language this app speaks, which is why it is built
 * here and not in the `music` namespace.
 */
export function degreeShorthand({ number, against }: ModeDegree): string {
  const sign =
    against === 0 ? '' : against > 0 ? '♯'.repeat(against) : '♭'.repeat(-against)
  return `${sign}${number}`
}
