import type {
  CadenceQuestion,
  CadenceRoundSpec,
} from '@/exercises/harmony-shared/generate'
import { useRound, type RoundController } from '@/exercises/shared/useRound'

import { CADENCE_RULES, type CadenceAnswer } from './rules'

/** The round machine, bound to writing a cadence out in four parts. */
export function useCadenceRound(
  spec: CadenceRoundSpec | undefined,
  exerciseId: string,
): RoundController<CadenceRoundSpec, CadenceQuestion, CadenceAnswer> {
  return useRound(spec, exerciseId, CADENCE_RULES)
}
