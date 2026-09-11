import { useRound, type RoundController } from '@/exercises/shared/useRound'

import type { ChordQuestion, ChordRoundSpec } from './generate'
import { CHORD_RULES, type ChordAnswer } from './rules'

/** The round machine, bound to naming a chord — read or heard. */
export function useChordRound(
  spec: ChordRoundSpec | undefined,
  exerciseId: string,
): RoundController<ChordRoundSpec, ChordQuestion, ChordAnswer> {
  return useRound(spec, exerciseId, CHORD_RULES)
}
