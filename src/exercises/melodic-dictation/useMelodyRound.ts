import { useRound, type RoundController } from '@/exercises/shared/useRound'

import type { MelodyQuestion, MelodyRoundSpec } from './generate'
import { MELODY_RULES, type MelodyAnswer } from './rules'

/** The round machine, bound to melodies. */
export function useMelodyRound(
  spec: MelodyRoundSpec | undefined,
  exerciseId: string,
): RoundController<MelodyRoundSpec, MelodyQuestion, MelodyAnswer> {
  return useRound(spec, exerciseId, MELODY_RULES)
}
