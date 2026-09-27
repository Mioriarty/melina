import { HarmonyDictation } from '@/exercises/harmony-shared/HarmonyDictation'
import { BASS_LINE } from '@/exercises/harmony-shared/lines'
import { LineRoundScreen } from '@/exercises/harmony-shared/LineRoundScreen'
import { LineSummary } from '@/exercises/harmony-shared/LineSummary'
import { BASS_RULES } from '@/exercises/harmony-shared/rules'

import { BASS_DIFFICULTIES } from './difficulties'
import { BASS_DICTATION_SETTINGS } from './settings'

/**
 * Hear a four-part progression; write down its bass.
 *
 * The smallest exercise the harmony model can carry, and deliberately so: it
 * exists to make the generator **audible and judgeable**. Everything under it
 * — the block grammar, the voice-leading search, the figured-bass storage — is
 * built to serve a dozen exercises, and this is the one that proves it works
 * by putting it in front of an ear.
 */
export default function BassDictationExercise() {
  return (
    <HarmonyDictation
      exercise="bass"
      levels={BASS_DIFFICULTIES}
      settings={BASS_DICTATION_SETTINGS}
      rules={BASS_RULES}
      round={(props) => <LineRoundScreen line={BASS_LINE} {...props} />}
      summary={(props) => <LineSummary line={BASS_LINE} {...props} />}
    />
  )
}
