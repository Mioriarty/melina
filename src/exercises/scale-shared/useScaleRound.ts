import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type { ModeId } from '@/lib/music/scale'

import type { ScaleQuestion, ScaleRoundSpec } from './generate'
import { SCALE_RULES } from './rules'

/** The round machine, bound to scales. */
export function useScaleRound(
  spec: ScaleRoundSpec | undefined,
  exerciseId: string,
): RoundController<ScaleRoundSpec, ScaleQuestion, ModeId> {
  return useRound(spec, exerciseId, SCALE_RULES)
}
