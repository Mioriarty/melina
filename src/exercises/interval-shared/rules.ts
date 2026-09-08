import { intervalKey, intervalsEqual, type Interval } from '@/lib/music/interval'
import type { RoundRules } from '@/exercises/shared/useRound'

import type { IntervalQuestion, RoundSpec } from './generate'
import { generateRound } from './generate'

/**
 * What the generic round machinery needs to know about intervals: how to
 * build a round, what counts as right, and what to write into the attempt
 * log. Module-level so its identity is stable across renders.
 */
export const INTERVAL_RULES: RoundRules<RoundSpec, IntervalQuestion, Interval> = {
  generate: generateRound,
  isCorrect: (chosen, question) => intervalsEqual(chosen, question.interval),
  subject: (question) => intervalKey(question.interval),
  answerKey: intervalKey,
  context: (question) => ({
    clef: question.clef,
    keySignature: question.keySignature,
    direction: question.direction,
  }),
}
