import { useTranslation } from 'react-i18next'

import { useMusicNames } from '@/hooks/useMusicNames'
import { VOICE_LEADING_RULES } from '@/lib/music/voiceLeading'
import { cn } from '@/lib/utils/cn'

/**
 * Every rule the app checks, in one place.
 *
 * **Walked off `VOICE_LEADING_RULES` rather than written out**, which is the
 * whole payoff of the rules being rows: adding one to the model adds it to the
 * page, and a rule the exercise marks you on can never be a rule the guide
 * failed to mention. That is not tidiness — canonical grading against a list
 * you were never shown is the unfairness this page exists to undo.
 *
 * Each row says what breaking the rule **costs**, because that is the
 * distinction a reader needs and the only one the model actually states. An
 * error fails the answer; a warning is pointed out and costs nothing, since a
 * wide leap or a Querstand is somewhere a line may legitimately want to go.
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
      <table className="w-full min-w-[19rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-medium">
              {t('voiceLeading.table.rule')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('voiceLeading.table.asks')}
            </th>
          </tr>
        </thead>
        <tbody>
          {VOICE_LEADING_RULES.map((rule) => (
            <tr key={rule.id} className="border-b border-rule/60 align-top">
              {/*
                What breaking a rule costs sits under its name rather than in a
                column of its own. A third column pushed the table past a phone
                and into its own horizontal scroll — and the column that went
                off the edge was this one, which is the thing the section is
                actually about.
              */}
              <th scope="row" className="py-2 pr-3 font-medium text-ink">
                {names.rule(rule.id)}
                <span
                  className={cn(
                    'mt-0.5 block text-[0.6875rem] font-medium tracking-wide uppercase',
                    rule.kind === 'harmony'
                      ? 'text-ink-faint'
                      : rule.severity === 'error'
                        ? 'text-wrong'
                        : 'text-ink-muted',
                  )}
                >
                  {t(
                    rule.kind === 'harmony'
                      ? 'voiceLeading.table.always'
                      : rule.severity === 'error'
                        ? 'voiceLeading.table.error'
                        : 'voiceLeading.table.warning',
                  )}
                </span>
              </th>
              <td className="py-2 text-ink-muted">{names.ruleBlurb(rule.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
