import { useRound, type RoundController } from '@/exercises/shared/useRound'

import type { HarmonyQuestion, HarmonyRoundSpec } from './generate'
import { BASS_RULES, type BassAnswer } from './rules'

export function useBassRound(
  spec: HarmonyRoundSpec | undefined,
  exerciseId: string,
): RoundController<HarmonyRoundSpec, HarmonyQuestion, BassAnswer> {
  return useRound(spec, exerciseId, BASS_RULES)
}
