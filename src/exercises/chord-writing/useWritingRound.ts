import type { ChordQuestion, ChordRoundSpec } from '@/exercises/chord-shared/generate'
import { useRound, type RoundController } from '@/exercises/shared/useRound'

import { WRITING_RULES, type WritingAnswer } from './rules'

/** The round machine, bound to writing a named chord onto the staff. */
export function useWritingRound(
  spec: ChordRoundSpec | undefined,
  exerciseId: string,
): RoundController<ChordRoundSpec, ChordQuestion, WritingAnswer> {
  return useRound(spec, exerciseId, WRITING_RULES)
}
