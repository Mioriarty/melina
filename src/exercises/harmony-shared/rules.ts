import type { RoundRules } from '@/exercises/shared/useRound'
import { degreesKey, degreesSoundEqual, type Degree } from '@/lib/music/degree'

import { harmonyAttempt } from './attempt'
import {
  bassDegrees,
  generateRound,
  type HarmonyQuestion,
  type HarmonyRoundSpec,
} from './generate'

/** The bass line, written as scale degrees. */
export type BassAnswer = readonly Degree[]

export function bassAnswerKey(answer: BassAnswer): string {
  return degreesKey(answer)
}

/**
 * **Graded by sound, never by spelling.**
 *
 * The same rule melodic dictation and scale degrees already follow: ♯4 and ♭5
 * are one note, and marking a listener wrong for choosing the other name is
 * marking them wrong for something there was nothing to hear. In a minor key
 * it matters more than usual, because the leading note of a dominant is a
 * raised seventh and the note a semitone below it is a flattened first —
 * different names, one sound.
 */
export function isBassCorrect(chosen: BassAnswer, question: HarmonyQuestion): boolean {
  const wanted = bassDegrees(question.progression)
  if (wanted === undefined) return false

  const { key } = question.progression
  return degreesSoundEqual({ ...key.tonic, octave: 4 }, key.mode, chosen, wanted)
}

export const BASS_RULES: RoundRules<HarmonyRoundSpec, HarmonyQuestion, BassAnswer> = {
  generate: generateRound,
  isCorrect: isBassCorrect,
  attempt: harmonyAttempt,
  answerKey: bassAnswerKey,
}
