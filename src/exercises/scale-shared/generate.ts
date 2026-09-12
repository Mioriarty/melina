import { getClef, type ClefId } from '@/lib/music/clef'
import type { Pitch } from '@/lib/music/pitch'
import {
  fittingOctaves,
  isAscendingOnly,
  isCleanScale,
  isModeId,
  parseTonicKey,
  scalePitches,
  type ModeId,
  type PitchClass,
} from '@/lib/music/scale'
import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

/**
 * Question generation, shared by both scale exercises.
 *
 * Reading and hearing ask for the same thing — a correctly spelled scale
 * sitting inside a clef's range — and differ only in whether it is played and
 * in which way. One generator means a spelling mistake can only exist once.
 */

/**
 * How a scale is played and drawn.
 *
 * There is no simultaneous option the way there is for an interval: eight
 * notes at once is a cluster, not a scale.
 */
export type ScaleDirection = 'ascending' | 'descending'

export const SCALE_DIRECTIONS: readonly ScaleDirection[] = ['ascending', 'descending']

export function isScaleDirection(value: string): value is ScaleDirection {
  return SCALE_DIRECTIONS.includes(value as ScaleDirection)
}

export interface ScaleQuestion {
  mode: ModeId
  /** The lowest note of the run, and the note the mode is measured from. */
  tonic: Pitch
  /** Always ascending, tonic first and octave last: the scale itself. */
  pitches: readonly Pitch[]
  clef: ClefId
  direction: ScaleDirection
}

/** What a round may draw on. Both exercises' settings satisfy this. */
export interface ScaleRoundSpec {
  clefs: readonly ClefId[]
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  directions: readonly ScaleDirection[]
  questionsPerRound: number
}

/**
 * The directions a spec offers for one mode.
 *
 * Melodic minor is an ascending scale — coming down it is the natural minor,
 * note for note — so a descending one is a question with two right answers.
 * It is dropped from the spec's directions rather than turned round quietly:
 * the direction is what the attempt log records and what a level's own
 * accuracy filter looks for, so a question asked in a direction the level did
 * not name would be a row the level could never count.
 */
export function modeDirections(
  mode: ModeId,
  directions: readonly ScaleDirection[],
): readonly ScaleDirection[] {
  return isAscendingOnly(mode)
    ? directions.filter((direction) => direction === 'ascending')
    : directions
}

/**
 * The modes a spec actually permits.
 *
 * A mode with no direction left is not in the round at all: a level of
 * descending scales simply does not ask melodic minor, which is honest —
 * there is no descending melodic minor to ask about.
 */
export function allowedModes(spec: ScaleRoundSpec): readonly ModeId[] {
  return spec.modes
    .filter(isModeId)
    .filter((mode) => modeDirections(mode, spec.directions).length > 0)
}

/** The tonics a spec permits, as pitch classes. */
export function allowedTonics(spec: ScaleRoundSpec): readonly PitchClass[] {
  return spec.tonics
    .map(parseTonicKey)
    .filter((tonic): tonic is PitchClass => tonic !== undefined)
}

/**
 * Build one question for a given mode.
 *
 * Two things have to line up at once: the mode must spell cleanly on the
 * tonic — G♯ lydian would need an F triple sharp — and the whole octave has
 * to fit inside the clef, since a tonic that sits nicely on the staff is
 * useless if the note it closes on is three ledger lines above it.
 *
 * Returns `undefined` when no offered tonic satisfies both, which the caller
 * handles by trying another clef.
 */
export function buildQuestion(
  random: Random,
  mode: ModeId,
  clefId: ClefId,
  tonics: readonly PitchClass[],
  direction: ScaleDirection,
): ScaleQuestion | undefined {
  const clef = getClef(clefId)

  const candidates = tonics
    .filter((tonic) => isCleanScale(tonic, mode))
    .flatMap((tonic) =>
      fittingOctaves(tonic, mode, clef.lowest, clef.highest).map((octave) => ({
        ...tonic,
        octave,
      })),
    )

  const [first, ...rest] = candidates
  if (first === undefined) return undefined

  const tonic = randomPick(random, [first, ...rest])
  const pitches = scalePitches(tonic, mode)
  // Unreachable: `isCleanScale` already spelled this scale successfully.
  if (pitches === undefined) return undefined

  return { mode, tonic, pitches, clef: clefId, direction }
}

/**
 * Generate a whole round up front.
 *
 * Doing this in one go rather than question by question is what lets the
 * modes be dealt evenly, and means a round can never stall halfway through
 * because the next mode will not fit the chosen clef.
 */
export function generateRound(random: Random, spec: ScaleRoundSpec): ScaleQuestion[] {
  const modes = allowedModes(spec)
  const tonics = allowedTonics(spec)

  if (
    modes.length === 0 ||
    tonics.length === 0 ||
    spec.clefs.length === 0 ||
    spec.directions.length === 0
  ) {
    return []
  }

  const dealt = dealEvenly(random, modes, spec.questionsPerRound)
  const questions: ScaleQuestion[] = []

  for (const mode of dealt) {
    // A mode may not fit every clef — a scale needs a whole octave, which is
    // most of what a clef can show — so try a few pairings before giving up
    // on the question rather than dropping it.
    let question: ScaleQuestion | undefined
    for (let attempt = 0; attempt < 12 && question === undefined; attempt += 1) {
      const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
      // Per mode, not per round: `allowedModes` has already dropped anything
      // with nothing left, so this is never empty.
      const direction = randomPick(
        random,
        modeDirections(mode, spec.directions) as [ScaleDirection, ...ScaleDirection[]],
      )
      question = buildQuestion(random, mode, clef, tonics, direction)
    }

    if (question !== undefined) questions.push(question)
  }

  return questions
}

/**
 * The scale in the order it is heard, which is the order it is drawn.
 *
 * A descending scale is the same eight pitches read backwards: it starts on
 * the octave above and walks down to the tonic.
 */
export function playOrder(question: ScaleQuestion): readonly Pitch[] {
  return question.direction === 'descending'
    ? [...question.pitches].reverse()
    : question.pitches
}

/**
 * The note sounded and shown first.
 *
 * The same rule the interval exercises follow: what you hear first is what
 * you see, so a descending scale reveals the note it falls from.
 */
export function firstNote(question: ScaleQuestion): Pitch {
  const [first] = playOrder(question)
  // playOrder is the question's own eight pitches, so it is never empty.
  return first as Pitch
}
