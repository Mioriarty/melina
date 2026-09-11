import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type {
  ThoroughbassQuestion,
  ThoroughbassRoundSpec,
} from '@/exercises/thoroughbass-shared/generate'

import { REALIZING_RULES, type RealizingAnswer } from './rules'

/** The round machine, bound to realising a figured bass. */
export function useRealizingRound(
  spec: ThoroughbassRoundSpec | undefined,
  exerciseId: string,
): RoundController<ThoroughbassRoundSpec, ThoroughbassQuestion, RealizingAnswer> {
  return useRound(spec, exerciseId, REALIZING_RULES)
}
