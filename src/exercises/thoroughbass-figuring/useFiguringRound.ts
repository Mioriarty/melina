import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type {
  ThoroughbassQuestion,
  ThoroughbassRoundSpec,
} from '@/exercises/thoroughbass-shared/generate'

import { FIGURING_RULES, type FiguringAnswer } from './rules'

/** The round machine, bound to figuring a bass. */
export function useFiguringRound(
  spec: ThoroughbassRoundSpec | undefined,
  exerciseId: string,
): RoundController<ThoroughbassRoundSpec, ThoroughbassQuestion, FiguringAnswer> {
  return useRound(spec, exerciseId, FIGURING_RULES)
}
