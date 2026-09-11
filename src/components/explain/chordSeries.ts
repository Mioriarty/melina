import {
  CHORD_QUALITIES,
  chordPitches,
  chordSize,
  cleanRoots,
  closeChord,
  isSymmetric,
  type ChordQuality,
} from '@/lib/music/chord'
import {
  defaultSemitones,
  intervalBetween,
  intervalSemitones,
  type Interval,
} from '@/lib/music/interval'

/**
 * The nine qualities, read off the model.
 *
 * **Computed from `chord.ts`, never authored** — the same reason
 * `modeSeries.ts` exists for the modes guide and `contourSeries.ts` for the
 * melodic shape one. A page that describes a model by hand is a page that can
 * come to describe something the app no longer does; this one is the model
 * evaluated, so it cannot.
 *
 * Two facts come out of it, and they are the two ways a chord quality is
 * actually taught:
 *
 * - **What it is against the major scale** — `1 ♭3 ♭5 ♭♭7`, which is the same
 *   shorthand the modes guide writes and uses the same function to write it.
 * - **What it is stacked from** — a major third then a minor third, which is
 *   the definition a player can hear and build from. Derived by measuring the
 *   chord's own spelled notes rather than by tabulating the thirds, so the two
 *   can never come to disagree about the same chord.
 */

/** One member of a chord, and how it stands against the major scale. */
export interface ChordDegree {
  /** 1, 3, 5, 7. */
  number: number
  interval: Interval
  /**
   * Semitones against the major scale's degree of the same number: `-1` for a
   * flattened one, `-2` for the doubly flattened seventh of a diminished
   * seventh chord, `1` for a raised one. This is what `1 ♭3 ♭5 ♭♭7` writes.
   */
  against: number
}

export interface ChordSummary {
  id: ChordQuality
  /** Three for a triad, four for a seventh. */
  size: number
  degrees: readonly ChordDegree[]
  /** The thirds it is stacked from, bottom up. */
  thirds: readonly Interval[]
  /**
   * Whether its own inversions sound like it — true for the augmented triad
   * and the fully diminished seventh, and the reason neither is ever asked in
   * an inversion by ear.
   */
  symmetric: boolean
  /** How many of the app's offered roots it spells cleanly on. */
  roots: number
}

export function chordSummary(id: ChordQuality): ChordSummary {
  // The chord written out in root position, which is where both readings of it
  // are taken from: the members against the major scale, and the thirds
  // between one member and the next.
  const pitches = chordPitches(closeChord({ letter: 'C', alteration: 0 }, id)) ?? []

  const degrees = pitches.flatMap((note): ChordDegree[] => {
    const root = pitches[0]
    if (root === undefined) return []
    const interval = intervalBetween(root, note)
    if (interval === undefined) return []
    return [
      {
        number: interval.number,
        interval,
        against: (intervalSemitones(interval) ?? 0) - defaultSemitones(interval.number),
      },
    ]
  })

  const thirds = pitches.flatMap((note, index): Interval[] => {
    const below = pitches[index - 1]
    if (below === undefined) return []
    const third = intervalBetween(below, note)
    return third === undefined ? [] : [third]
  })

  return {
    id,
    size: chordSize(id),
    degrees,
    thirds,
    symmetric: isSymmetric(id),
    roots: cleanRoots(id).length,
  }
}

export function chordSummaries(): readonly ChordSummary[] {
  return CHORD_QUALITIES.map(chordSummary)
}
