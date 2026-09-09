import type { RoundRules } from '@/exercises/shared/useRound'
import { degreesSoundEqual, degreesKey, type Degree } from '@/lib/music/degree'

import { degreeAttempt } from './attempt'
import { generateRound, type DegreeQuestion, type DegreeRoundSpec } from './generate'

/**
 * What the generic round machinery needs to know about scale degrees.
 *
 * The whole melody is one answer, so it is right only when every degree in it
 * matches — the same shape as a bar of rhythm, and for the same reason: the
 * player writes a sequence down rather than choosing from a list.
 *
 * **Matching is by sound, not by spelling.** ♯1 and ♭2 are one note under two
 * names and no ear can separate them, so refusing the name the question did
 * not happen to print would be marking a listener wrong for something there
 * was nothing to hear.
 */
export const DEGREE_RULES: RoundRules<
  DegreeRoundSpec,
  DegreeQuestion,
  readonly Degree[]
> = {
  generate: generateRound,
  isCorrect: (chosen, question) =>
    degreesSoundEqual(question.tonic, question.mode, chosen, question.degrees),
  attempt: degreeAttempt,
  answerKey: (chosen) => degreesKey(chosen),
}
