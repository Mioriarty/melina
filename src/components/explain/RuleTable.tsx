import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import { VOICE_LEADING_RULES } from '@/lib/music/voiceLeading'

/**
 * Every rule the app checks, in one place.
 *
 * **Walked off `VOICE_LEADING_RULES` rather than written out**, which is the
 * whole payoff of the rules being rows: adding one to the model adds it to the
 * page, and a rule the exercise marks you on can never be a rule the guide
 * failed to mention. That is not tidiness — canonical grading against a list
 * you were never shown is the unfairness this page exists to undo.
 *
 * Grouped by what breaking one **costs**, because that is the distinction a
 * reader needs and the only one the model actually states. An error fails the
 * answer; a warning is pointed out and costs nothing, since a wide leap or a
 * Querstand is somewhere a line may legitimately want to go.
 *
 * The two rules about the chord itself are marked as such. They are not
 * Satzfehler and no level can switch them off: a voice singing a note the chord
 * does not contain has not written the cadence badly, it has written a
 * different cadence.
 */
export function RuleTable() {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('voiceLeading.table.rule')}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('voiceLeading.table.asks')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('voiceLeading.table.costs')}
            </th>
          </tr>
        </thead>
        <tbody>
          {VOICE_LEADING_RULES.map((rule) => (
            <tr key={rule.id} className="border-b border-rule/60 align-top">
              <th scope="row" className="py-2 pr-3 font-medium text-ink">
                {names.rule(rule.id)}
              </th>
              <td className="py-2 pr-3 text-ink-muted">{names.ruleBlurb(rule.id)}</td>
              <td className="py-2 whitespace-nowrap text-ink-faint">
                {t(
                  rule.kind === 'harmony'
                    ? 'voiceLeading.table.always'
                    : rule.severity === 'error'
                      ? 'voiceLeading.table.error'
                      : 'voiceLeading.table.warning',
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
