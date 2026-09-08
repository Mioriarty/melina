import type { RoundRules } from '@/exercises/shared/useRound'
import type { ModeId } from '@/lib/music/scale'
import { pitchKey } from '@/lib/music/pitch'

import { generateRound, type ScaleQuestion, type ScaleRoundSpec } from './generate'

/**
 * What the generic round machinery needs to know about scales.
 *
 * The subject logged is the mode alone — that is what the question asks and
 * what Progress will want to group by — with the tonic kept as context, since
 * "you keep missing Phrygian" and "you keep missing scales on E♭" are two
 * different findings.
 */
export const SCALE_RULES: RoundRules<ScaleRoundSpec, ScaleQuestion, ModeId> = {
  generate: generateRound,
  isCorrect: (chosen, question) => chosen === question.mode,
  subject: (question) => question.mode,
  answerKey: (chosen) => chosen,
  context: (question) => ({
    clef: question.clef,
    tonic: pitchKey(question.tonic),
    direction: question.direction,
  }),
}
