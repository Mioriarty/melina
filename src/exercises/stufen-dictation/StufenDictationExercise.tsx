import { useTranslation } from 'react-i18next'

import { HarmonyDictation } from '@/exercises/harmony-shared/HarmonyDictation'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'

import { STUFEN_DIFFICULTIES } from './difficulties'
import { STUFEN_RULES } from './rules'
import { STUFEN_DICTATION_SETTINGS } from './settings'
import { StufenRoundScreen } from './StufenRoundScreen'
import { StufenSummary } from './StufenSummary'

/**
 * Hear a four-part progression; name every chord in it.
 *
 * The third answer to the same question bass and soprano dictation ask — what
 * a progression *is*, rather than what one of its voices sang. Named as a
 * Stufe and read as a function at once, because the keys show both, and
 * graded by the chord a name spells, so either reading of one chord is right.
 */
export default function StufenDictationExercise() {
  const { t } = useTranslation('exercise')

  return (
    <HarmonyDictation
      exercise="stufen"
      levels={STUFEN_DIFFICULTIES}
      settings={STUFEN_DICTATION_SETTINGS}
      rules={STUFEN_RULES}
      round={(props) => <StufenRoundScreen {...props} />}
      summary={(props) => <StufenSummary {...props} />}
      setup={(settings, onChange) => (
        <SetupSection
          title={t('stufen.setup.inversions.title')}
          hint={t('stufen.setup.inversions.hint')}
        >
          <div className="flex flex-wrap gap-2">
            <SetupChip
              selected={settings.inversions}
              onClick={() => onChange({ inversions: !settings.inversions })}
            >
              {t('stufen.setup.inversions.allow')}
            </SetupChip>
          </div>
        </SetupSection>
      )}
    />
  )
}
