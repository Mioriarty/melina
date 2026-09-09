import type { RhythmAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import { isMeterKey, meterKey, parseMeter } from '@/lib/music/meter'
import { onsetsKey, parseOnsets } from '@/lib/music/rhythm'

import type { RhythmQuestion, RhythmRoundSpec } from './generate'

/**
 * A rhythm question, to and from the attempt log.
 *
 * The bar and the speed, and nothing else. How it was written down is decided
 * again by `notateRhythm` on the way back out, so a row can never disagree
 * with the notation it would produce.
 */

export function rhythmAttempt(question: RhythmQuestion): RhythmAttempt {
  return {
    kind: 'rhythm',
    meter: meterKey(question.rhythm.meter),
    onsets: onsetsKey(question.rhythm.onsets),
    tempo: question.tempo,
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be read — one hand-edited, or naming
 * a meter this version no longer engraves.
 */
export function rhythmQuestion(
  attempt: RhythmAttempt,
  metronome: RhythmQuestion['metronome'] = 'count-in',
): RhythmQuestion | undefined {
  if (!isMeterKey(attempt.meter)) return undefined
  const meter = parseMeter(attempt.meter)
  const onsets = parseOnsets(attempt.onsets)
  if (meter === undefined || onsets === undefined) return undefined

  return { rhythm: { meter, onsets }, tempo: attempt.tempo, metronome }
}

/**
 * Which past answers a set of rhythm settings could have asked for.
 *
 * The meter and the tempo, which are the dimensions a level actually pins. Not
 * the cell weights: they shape what comes up rather than bounding it, so a
 * level cannot claim the bars it happened not to draw.
 */
export function rhythmFilter(spec: RhythmRoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'rhythm',
    meter: spec.meters,
    tempo: String(spec.tempo),
  }
}
