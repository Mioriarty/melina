import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type { Interval } from '@/lib/music/interval'

import type { IntervalQuestion, RoundSpec } from './generate'
import { INTERVAL_RULES } from './rules'

/**
 * The round machine, bound to intervals.
 *
 * A one-line wrapper on purpose: both interval exercises want exactly this,
 * and nothing about a round of intervals is different enough to justify
 * repeating the binding at each call site.
 */
export function useIntervalRound(
  spec: RoundSpec | undefined,
  exerciseId: string,
): RoundController<RoundSpec, IntervalQuestion, Interval> {
  return useRound(spec, exerciseId, INTERVAL_RULES)
}
