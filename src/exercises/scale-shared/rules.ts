import type { RoundRules } from '@/exercises/shared/useRound'
import type { ModeId } from '@/lib/music/scale'

import { scaleAttempt } from './attempt'
import { generateRound, type ScaleQuestion, type ScaleRoundSpec } from './generate'

/**
 * What the generic round machinery needs to know about scales.
 *
 * The tonic goes into the log with the mode rather than being folded away,
 * because "you keep missing Phrygian" and "you keep missing scales on E♭" are
 * two different findings, and only one of them is about the mode.
 */
export const SCALE_RULES: RoundRules<ScaleRoundSpec, ScaleQuestion, ModeId> = {
  generate: generateRound,
  isCorrect: (chosen, question) => chosen === question.mode,
  attempt: scaleAttempt,
  answerKey: (chosen) => chosen,
}
