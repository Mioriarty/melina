import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type { Degree } from '@/lib/music/degree'

import type { DegreeQuestion, DegreeRoundSpec } from './generate'
import { DEGREE_RULES } from './rules'

/** The round machine, bound to scale degrees. */
export function useDegreeRound(
  spec: DegreeRoundSpec | undefined,
  exerciseId: string,
): RoundController<DegreeRoundSpec, DegreeQuestion, readonly Degree[]> {
  return useRound(spec, exerciseId, DEGREE_RULES)
}
