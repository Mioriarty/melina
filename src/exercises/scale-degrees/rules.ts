import type { RoundRules } from '@/exercises/shared/useRound'
import { degreesEqual, degreesKey, type Degree } from '@/lib/music/degree'

import { degreeAttempt } from './attempt'
import { generateRound, type DegreeQuestion, type DegreeRoundSpec } from './generate'

/**
 * What the generic round machinery needs to know about scale degrees.
 *
 * The whole melody is one answer, so it is right only when every degree in it
 * matches — the same shape as a bar of rhythm, and for the same reason: the
 * player writes a sequence down rather than choosing from a list.
 */
export const DEGREE_RULES: RoundRules<
  DegreeRoundSpec,
  DegreeQuestion,
  readonly Degree[]
> = {
  generate: generateRound,
  isCorrect: (chosen, question) => degreesEqual(chosen, question.degrees),
  attempt: degreeAttempt,
  answerKey: (chosen) => degreesKey(chosen),
}
