import type { MetronomeMode } from '@/lib/audio/rhythmSchedule'
import { atLeast, buildBar, allowedGroups } from '@/exercises/dictation-shared/bar'
import { parseMeter, type TimeSignature } from '@/lib/music/meter'
import type { Rhythm } from '@/lib/music/rhythm'
import type { CellWeights } from '@/lib/music/rhythmCells'
import { dealEvenly, type Random } from '@/lib/utils/seededRandom'

/**
 * A rhythm question: one bar, and how it should sound.
 *
 * The bar itself is `dictation-shared/bar.ts`, which melodic dictation builds
 * its phrase out of too. What is left here is what makes a bar a *question* —
 * the tempo and the click it goes by, and dealing the metres evenly over a
 * round.
 */

export interface RhythmQuestion {
  rhythm: Rhythm
  /** Beats per minute it is played at. */
  tempo: number
  metronome: MetronomeMode
}

/** What a round may draw on. The exercise's settings satisfy this. */
export interface RhythmRoundSpec {
  /** Meter keys, e.g. `4/4`. */
  meters: readonly string[]
  cellWeights: CellWeights
  tempo: number
  metronome: MetronomeMode
  /** Fewest impacts a bar may have, so a round is never mostly silence. */
  minOnsets: number
  /** Whether a bar may open before its first impact. */
  allowInitialRest: boolean
  questionsPerRound: number
}

/** The meters a spec actually permits. */
export function allowedMeters(spec: RhythmRoundSpec): readonly TimeSignature[] {
  return spec.meters
    .map(parseMeter)
    .filter((meter): meter is TimeSignature => meter !== undefined)
}

/** Re-exported so a level's setup screen has one place to ask. */
export { allowedGroups }

export function buildQuestion(
  random: Random,
  meter: TimeSignature,
  spec: RhythmRoundSpec,
): RhythmQuestion | undefined {
  const bar = buildBar(random, meter, spec)
  if (bar === undefined) return undefined

  return {
    rhythm: atLeast(random, bar, spec.minOnsets),
    tempo: spec.tempo,
    metronome: spec.metronome,
  }
}

/**
 * Generate a whole round up front.
 *
 * The meters are dealt evenly so a level offering three of them asks all
 * three, rather than leaving one of them out of a round of ten by chance.
 */
export function generateRound(random: Random, spec: RhythmRoundSpec): RhythmQuestion[] {
  const meters = allowedMeters(spec)
  if (meters.length === 0 || allowedGroups(spec).length === 0) return []

  return dealEvenly(random, meters, spec.questionsPerRound).flatMap((meter) => {
    const question = buildQuestion(random, meter, spec)
    return question === undefined ? [] : [question]
  })
}
