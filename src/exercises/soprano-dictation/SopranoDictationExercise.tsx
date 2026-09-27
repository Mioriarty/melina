import { HARMONY_DICTATION_DIFFICULTIES } from '@/exercises/harmony-shared/difficulties'
import { HarmonyDictation } from '@/exercises/harmony-shared/HarmonyDictation'
import { SOPRANO_LINE } from '@/exercises/harmony-shared/lines'
import { LineRoundScreen } from '@/exercises/harmony-shared/LineRoundScreen'
import { LineSummary } from '@/exercises/harmony-shared/LineSummary'
import { SOPRANO_RULES } from '@/exercises/harmony-shared/rules'

import { SOPRANO_DICTATION_SETTINGS } from './settings'

/**
 * Hear a four-part progression; write down its soprano.
 *
 * Bass dictation's twin, and the more melodic of the two: the soprano is the
 * voice a listener follows without trying, so this is where hearing a
 * progression meets hearing a tune. **Answered with the octave**, because a
 * tune's register is part of it — the leading note under the tonic is not the
 * one above it.
 */
export default function SopranoDictationExercise() {
  return (
    <HarmonyDictation
      exercise="soprano"
      levels={HARMONY_DICTATION_DIFFICULTIES}
      settings={SOPRANO_DICTATION_SETTINGS}
      rules={SOPRANO_RULES}
      round={(props) => <LineRoundScreen line={SOPRANO_LINE} {...props} />}
      summary={(props) => <LineSummary line={SOPRANO_LINE} {...props} />}
    />
  )
}
