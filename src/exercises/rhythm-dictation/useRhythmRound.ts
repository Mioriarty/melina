import { useRound, type RoundController } from '@/exercises/shared/useRound'
import type { Rhythm } from '@/lib/music/rhythm'

import type { RhythmQuestion, RhythmRoundSpec } from './generate'
import { RHYTHM_RULES } from './rules'

/** The round machine, bound to rhythms. */
export function useRhythmRound(
  spec: RhythmRoundSpec | undefined,
  exerciseId: string,
): RoundController<RhythmRoundSpec, RhythmQuestion, Rhythm> {
  return useRound(spec, exerciseId, RHYTHM_RULES)
}
