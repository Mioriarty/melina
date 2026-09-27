import { dictationAttempt } from '@/exercises/harmony-shared/attempt'
import {
  generateRound,
  type HarmonyQuestion,
  type HarmonyRoundSpec,
} from '@/exercises/harmony-shared/generate'
import type { RoundRules } from '@/exercises/shared/useRound'
import {
  bassNoteEvents,
  namesChord,
  numeralsKey,
  progressionNumerals,
  type Numeral,
} from '@/lib/music/numeral'

/** Every chord of the progression, named — one per bass note. */
export type StufenAnswer = readonly Numeral[]

/** The chords a question asks the player to name. */
export function stufenAnswer(question: HarmonyQuestion): StufenAnswer | undefined {
  const { key, events } = question.progression
  return progressionNumerals(key, events, question.inversions === true)
}

/** Which of the chords a player named right, slot by slot. */
export function stufenVerdicts(
  question: HarmonyQuestion,
  chosen: StufenAnswer,
): readonly boolean[] {
  const { key, events } = question.progression
  const withInversion = question.inversions === true
  return bassNoteEvents(events).map((event, index) => {
    const named = chosen[index]
    return named !== undefined && namesChord(key, named, event, withInversion)
  })
}

/**
 * **Graded by the chord a name spells, not by the name.**
 *
 * Every chord the player names is built and compared by sound with the chord
 * that sounded — see `namesChord` — so `V7/III` and `VII7` in natural minor,
 * one chord under two readings, are both right. The inversion counts only
 * where the level asked for it.
 */
export function isStufenCorrect(
  chosen: StufenAnswer,
  question: HarmonyQuestion,
): boolean {
  const verdicts = stufenVerdicts(question, chosen)
  return chosen.length === verdicts.length && verdicts.every(Boolean)
}

export const STUFEN_RULES: RoundRules<HarmonyRoundSpec, HarmonyQuestion, StufenAnswer> = {
  generate: generateRound,
  isCorrect: isStufenCorrect,
  attempt: dictationAttempt('stufen'),
  answerKey: numeralsKey,
}
