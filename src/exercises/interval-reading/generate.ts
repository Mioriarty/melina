import { getClef, type ClefId } from '@/lib/music/clef'
import {
  intervalKey,
  parseIntervalKey,
  transpose,
  type Interval,
} from '@/lib/music/interval'
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
import { randomPick, type Random } from '@/lib/utils/seededRandom'

import type { IntervalReadingSettings } from './settings'

export interface Question {
  lower: Pitch
  upper: Pitch
  interval: Interval
  clef: ClefId
  keySignature: KeySignatureId
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
 *
 * Sampling uniformly at random over twenty questions reliably leaves some
 * intervals unasked and asks others four times, which makes a round feel
 * arbitrary. Same approach as the decoration scatter on the homescreen.
 */
export function dealIntervals(
  random: Random,
  allowed: readonly Interval[],
  count: number,
): Interval[] {
  const deck: Interval[] = []
  while (deck.length < count) deck.push(...allowed)

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = deck[i] as Interval
    const b = deck[j] as Interval
    deck[i] = b
    deck[j] = a
  }

  return deck.slice(0, count)
}

/** The intervals a settings object actually permits, as parsed objects. */
export function allowedIntervals(settings: IntervalReadingSettings): readonly Interval[] {
  return settings.intervals
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
): Question | undefined {
  const clef = getClef(clefId)
  const lowestStep = diatonicValue(clef.lowest)
  const highestStep = diatonicValue(clef.highest)

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
    if (!withinRange(lower, clef.lowest, clef.highest)) continue

    const upper = transpose(lower, interval, 'up')
    if (upper === undefined) continue
    if (!withinRange(upper, clef.lowest, clef.highest)) continue

    if (
      !allowDoubleAccidentals &&
      (Math.abs(lower.alteration) > 1 || Math.abs(upper.alteration) > 1)
    ) {
      continue
    }

    return { lower, upper, interval, clef: clefId, keySignature }
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
export function generateRound(
  random: Random,
  settings: IntervalReadingSettings,
): Question[] {
  const allowed = allowedIntervals(settings)
  if (allowed.length === 0 || settings.clefs.length === 0) return []

  const dealt = dealIntervals(random, allowed, settings.questionsPerRound)
  const questions: Question[] = []

  for (const interval of dealt) {
    // A given interval may not fit every clef, so try a few pairings before
    // giving up on it rather than dropping the question.
    let question: Question | undefined
    for (let attempt = 0; attempt < 8 && question === undefined; attempt += 1) {
      const clef = randomPick(random, settings.clefs as [ClefId, ...ClefId[]])
      const keySignature = randomPick(
        random,
        settings.keySignatures as [KeySignatureId, ...KeySignatureId[]],
      )
      question = buildQuestion(random, interval, clef, keySignature)
    }
    if (question !== undefined) questions.push(question)
  }

  return questions
}

export function questionKey(question: Question): string {
  return intervalKey(question.interval)
}
