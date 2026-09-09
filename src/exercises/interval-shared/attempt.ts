import type { AttemptFilter } from '@/lib/db/progress'
import type { IntervalAttempt } from '@/lib/db/attemptQuestion'
import { intervalKey, parseIntervalKey, transpose } from '@/lib/music/interval'
import { parsePitch, pitchKey } from '@/lib/music/pitch'

import type { IntervalQuestion, RoundSpec } from './generate'

/**
 * An interval question, to and from the attempt log.
 *
 * What is written down is the lower note and the interval, because those two
 * are the question: the upper note is `transpose` applied to them and would
 * only be a second copy that could disagree. Nothing about the level that
 * asked it is recorded — `staffOnly` shaped the range the generator drew
 * from, and whether the notes it chose need ledger lines is visible in the
 * notes themselves.
 */

export function intervalAttempt(question: IntervalQuestion): IntervalAttempt {
  return {
    kind: 'interval',
    lower: pitchKey(question.lower),
    interval: intervalKey(question.interval),
    clef: question.clef,
    keySignature: question.keySignature,
    direction: question.direction,
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be spelled — one hand-edited, or
 * written by a version that spelled differently. Callers show what they can
 * rather than failing a whole screen over one row.
 */
export function intervalQuestion(attempt: IntervalAttempt): IntervalQuestion | undefined {
  const lower = parsePitch(attempt.lower)
  const interval = parseIntervalKey(attempt.interval)
  if (lower === undefined || interval === undefined) return undefined

  const upper = transpose(lower, interval, 'up')
  if (upper === undefined) return undefined

  return {
    lower,
    upper,
    interval,
    clef: attempt.clef,
    keySignature: attempt.keySignature,
    direction: attempt.direction,
  }
}

/**
 * Which past answers a set of interval settings could have asked for.
 *
 * A level's settings *are* a filter — each list is the set of values that
 * dimension was allowed to take — which is why measuring a level needs no
 * machinery of its own. `questionsPerRound` says how many questions a round
 * holds, not which ones, so it plays no part.
 *
 * `staffOnly` is only ever a narrowing: a level that asks for it can only
 * have produced notes on the staff, while a level that does not is
 * unconstrained and must count both.
 */
export function intervalFilter(spec: RoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'interval',
    clef: spec.clefs,
    keySignature: spec.keySignatures,
    interval: spec.intervals,
    direction: spec.directions,
    ...(spec.staffOnly === true ? { staffOnly: true } : {}),
  }
}
