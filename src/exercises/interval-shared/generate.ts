import { getClef, type ClefId } from '@/lib/music/clef'
import { isMelodic, leadingNote, type PlayDirection } from '@/lib/music/direction'
import { parseIntervalKey, transpose, type Interval } from '@/lib/music/interval'
import { alterationInKey, type KeySignatureId } from '@/lib/music/keySignature'
import {
  LETTERS,
  chromaticValue,
  diatonicValue,
  isAlteration,
  type Alteration,
  type Letter,
  type Pitch,
} from '@/lib/music/pitch'
import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

/**
 * Question generation, shared by every interval exercise.
 *
 * Reading and hearing ask the same thing of the generator — two correctly
 * spelled pitches forming a given interval, inside a clef's comfortable
 * range — and differ only in whether the notes are sounded together or one
 * after the other. Keeping one generator means a spelling bug can only exist
 * in one place.
 */

export interface IntervalQuestion {
  lower: Pitch
  upper: Pitch
  interval: Interval
  clef: ClefId
  keySignature: KeySignatureId
  direction: PlayDirection
}

/** What a round may draw on. Both exercises' settings satisfy this. */
export interface RoundSpec {
  clefs: readonly ClefId[]
  keySignatures: readonly KeySignatureId[]
  /** Interval keys, e.g. `P5`. */
  intervals: readonly string[]
  directions: readonly PlayDirection[]
  /**
   * Keep both notes on the staff, with no ledger lines. Narrows the range a
   * question can use, which is the difference between reading an interval and
   * counting lines above the staff.
   */
  staffOnly?: boolean
  questionsPerRound: number
}

/** How often the root simply takes the accidental the key signature implies. */
const IN_KEY_CHANCE = 0.78

/**
 * Choose the root's accidental.
 *
 * Anchored to the key signature, because picking uniformly at random ignores
 * the key completely and produces spellings no one would ever write: an F
 * flat in D major, or a doubly-augmented fourth built on E sharp. The notes
 * may still leave the key — that is the point of allowing any accidental —
 * but a chromatic inflection should read as a deliberate departure from the
 * key rather than as noise.
 */
function chooseRootAlteration(
  random: Random,
  letter: Letter,
  keySignature: KeySignatureId,
): Alteration {
  const inKey = alterationInKey(letter, keySignature)
  if (random() < IN_KEY_CHANCE) return inKey

  const candidate = inKey + (random() < 0.5 ? -1 : 1)
  return isAlteration(candidate) ? candidate : inKey
}

/**
 * Deal the round's intervals so each allowed one appears about equally often.
 * Same shuffled deck the scale round and the decoration scatter use.
 */
export function dealIntervals(
  random: Random,
  allowed: readonly Interval[],
  count: number,
): Interval[] {
  return dealEvenly(random, allowed, count)
}

/** The intervals a spec actually permits, as parsed objects. */
export function allowedIntervals(spec: RoundSpec): readonly Interval[] {
  return spec.intervals
    .map(parseIntervalKey)
    .filter((interval): interval is Interval => interval !== undefined)
}

function withinRange(value: Pitch, lowest: Pitch, highest: Pitch): boolean {
  return (
    chromaticValue(value) >= chromaticValue(lowest) &&
    chromaticValue(value) <= chromaticValue(highest)
  )
}

/**
 * Build one question for a given interval.
 *
 * Tries roots across the clef's range until both notes fit and neither needs
 * a triple accidental — an augmented fourth above B sharp would be E triple
 * sharp, which `transpose` refuses. Returns `undefined` if the interval simply
 * cannot be placed in this clef, which the caller handles by moving on.
 */
export function buildQuestion(
  random: Random,
  interval: Interval,
  clefId: ClefId,
  keySignature: KeySignatureId,
  direction: PlayDirection = 'harmonic',
  staffOnly = false,
): IntervalQuestion | undefined {
  const clef = getClef(clefId)
  const lowest = staffOnly ? clef.staffLowest : clef.lowest
  const highest = staffOnly ? clef.staffHighest : clef.highest
  const lowestStep = diatonicValue(lowest)
  const highestStep = diatonicValue(highest)

  for (let attempt = 0; attempt < 80; attempt += 1) {
    // Double accidentals are held back at first and allowed once the easy
    // spellings are exhausted, so an ordinary major third never comes out as
    // F flat to A flat, but a doubly-diminished seventh can still be placed.
    const allowDoubleAccidentals = attempt >= 50

    const step = lowestStep + Math.floor(random() * (highestStep - lowestStep + 1))
    const letter = LETTERS[((step % 7) + 7) % 7] as Letter
    const octave = Math.floor(step / 7)

    const lower: Pitch = {
      letter,
      alteration: chooseRootAlteration(random, letter, keySignature),
      octave,
    }
    if (!withinRange(lower, lowest, highest)) continue

    const upper = transpose(lower, interval, 'up')
    if (upper === undefined) continue
    if (!withinRange(upper, lowest, highest)) continue

    if (
      !allowDoubleAccidentals &&
      (Math.abs(lower.alteration) > 1 || Math.abs(upper.alteration) > 1)
    ) {
      continue
    }

    return { lower, upper, interval, clef: clefId, keySignature, direction }
  }

  return undefined
}

/**
 * Generate a whole round up front.
 *
 * Doing this in one go rather than question by question is what lets the
 * intervals be dealt evenly, and means a round can never stall halfway
 * through because one interval will not fit the chosen clef.
 */
export function generateRound(random: Random, spec: RoundSpec): IntervalQuestion[] {
  const allowed = allowedIntervals(spec)
  if (allowed.length === 0 || spec.clefs.length === 0 || spec.directions.length === 0) {
    return []
  }

  const dealt = dealIntervals(random, allowed, spec.questionsPerRound)
  const questions: IntervalQuestion[] = []

  for (const interval of dealt) {
    // A given interval may not fit every clef, so try a few pairings before
    // giving up on it rather than dropping the question.
    let question: IntervalQuestion | undefined
    for (let attempt = 0; attempt < 12 && question === undefined; attempt += 1) {
      const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
      const keySignature = randomPick(
        random,
        spec.keySignatures as [KeySignatureId, ...KeySignatureId[]],
      )
      const direction = randomPick(
        random,
        spec.directions as [PlayDirection, ...PlayDirection[]],
      )
      question = buildQuestion(
        random,
        interval,
        clef,
        keySignature,
        direction,
        spec.staffOnly ?? false,
      )
    }
    // A staff-only range is barely more than an octave, so a wide interval
    // may not fit any of the chosen clefs. Widening to ledger lines is far
    // better than silently serving a short round.
    if (question === undefined && spec.staffOnly === true) {
      for (let attempt = 0; attempt < 8 && question === undefined; attempt += 1) {
        const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
        const keySignature = randomPick(
          random,
          spec.keySignatures as [KeySignatureId, ...KeySignatureId[]],
        )
        const direction = randomPick(
          random,
          spec.directions as [PlayDirection, ...PlayDirection[]],
        )
        question = buildQuestion(random, interval, clef, keySignature, direction, false)
      }
    }

    if (question !== undefined) questions.push(question)
  }

  return questions
}

/** The note sounded and shown first, given the question's direction. */
export function firstNote(question: IntervalQuestion): Pitch {
  return leadingNote(question.direction) === 'upper' ? question.upper : question.lower
}

/** The note that only appears once the answer is in. */
export function secondNote(question: IntervalQuestion): Pitch {
  return leadingNote(question.direction) === 'upper' ? question.lower : question.upper
}

/** The pair in the order they are heard. */
export function playOrder(question: IntervalQuestion): readonly [Pitch, Pitch] {
  return isMelodic(question.direction)
    ? [firstNote(question), secondNote(question)]
    : [question.lower, question.upper]
}
