import type { RoundRules } from '@/exercises/shared/useRound'
import { degreesKey, degreesSoundEqual, type Degree } from '@/lib/music/degree'

import { harmonyAttempt } from './attempt'
import { generateRound, type HarmonyQuestion, type HarmonyRoundSpec } from './generate'
import { BASS_LINE, type LineDef } from './lines'

/** A voice of the progression, written as scale degrees. */
export type LineAnswer = readonly Degree[]

export function lineAnswerKey(answer: LineAnswer): string {
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
 *
 * Whether the octave counts is the line's own business: the bass's steps all
 * sit in the tonic's octave, so for it the comparison is by pitch class.
 */
export function isLineCorrect(
  line: LineDef,
  chosen: LineAnswer,
  question: HarmonyQuestion,
): boolean {
  const wanted = line.answer(question)
  if (wanted === undefined) return false

  const { key } = question.progression
  return degreesSoundEqual(line.tonic(key), key.mode, chosen, wanted)
}

export function lineRules(
  line: LineDef,
): RoundRules<HarmonyRoundSpec, HarmonyQuestion, LineAnswer> {
  return {
    generate: generateRound,
    isCorrect: (chosen, question) => isLineCorrect(line, chosen, question),
    attempt: harmonyAttempt,
    answerKey: lineAnswerKey,
  }
}

export const BASS_RULES = lineRules(BASS_LINE)
