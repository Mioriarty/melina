import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { SetupScreen as HarmonySetup } from '@/exercises/harmony-shared/SetupScreen'
import {
  CADENCE_RULE_CHOICES,
  LAGE_CHOICES,
  type CadenceSettings,
} from '@/exercises/harmony-shared/settings'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { getRule, type RuleId } from '@/lib/music/voiceLeading'

/**
 * What to practise, before writing any cadences out.
 *
 * Two sections of its own above the shared progression ones, because they are
 * what this exercise is: which Lage the prompt may name, and **which rules a
 * setting is marked against**.
 *
 * The rules are split by what breaking one actually costs rather than by what
 * kind of fault it is. An error fails the answer; a warning is pointed out and
 * costs nothing, because a large leap or a Querstand is somewhere a line may
 * well want to go and a marker weighs those rather than counting them. Grouping
 * them that way is the only grouping the screen can make honestly — it comes
 * straight off `severity`, where a grouping by family would be a second table
 * that could drift from the rules themselves.
 *
 * The question mark leads to the guide, which is where a rule is explained.
 * `?from=` brings the reader back to this screen rather than to the path.
 */

export interface SetupScreenProps {
  settings: CadenceSettings
  titleKey: string
  blurbKey: string
  onChange: (settings: CadenceSettings) => void
  onStart: () => void
  onBack: () => void
}

export function SetupScreen({
  settings,
  titleKey,
  blurbKey,
  onChange,
  onStart,
  onBack,
}: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  const errors = CADENCE_RULE_CHOICES.filter((id) => getRule(id)?.severity === 'error')
  const warnings = CADENCE_RULE_CHOICES.filter(
    (id) => getRule(id)?.severity === 'warning',
  )

  const ruleRow = (ids: readonly RuleId[]) => (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <SetupChip
          key={id}
          selected={settings.rules.includes(id)}
          onClick={() =>
            onChange({
              ...settings,
              // A level with no rules at all is legitimate: it is the one that
              // asks only for the right chords in the right Lage.
              rules: settings.rules.includes(id)
                ? settings.rules.filter((rule) => rule !== id)
                : [...settings.rules, id],
            })
          }
          label={names.ruleBlurb(id)}
        >
          {names.rule(id)}
        </SetupChip>
      ))}
    </div>
  )

  return (
    <HarmonySetup
      settings={settings}
      titleKey={titleKey}
      blurbKey={blurbKey}
      establish={false}
      onChange={(patch) => onChange({ ...settings, ...patch })}
      onStart={onStart}
      onBack={onBack}
    >
      <SetupSection
        title={t('exercise:setup.lagen.title')}
        hint={t('exercise:setup.lagen.hint')}
      >
        <div className="flex flex-wrap gap-2">
          {LAGE_CHOICES.map((lage) => (
            <SetupChip
              key={lage}
              selected={settings.lagen.includes(lage)}
              onClick={() => {
                const next = settings.lagen.includes(lage)
                  ? settings.lagen.filter((member) => member !== lage)
                  : [...settings.lagen, lage]
                // A round has to be able to ask for something.
                if (next.length > 0) onChange({ ...settings, lagen: next })
              }}
            >
              {names.lage(lage)}
            </SetupChip>
          ))}
        </div>
      </SetupSection>

      <SetupSection
        title={t('exercise:setup.rules.errors')}
        hint={t('exercise:setup.rules.errorsHint')}
        action={
          <Link
            to="/guide/voice-leading?from=harmony/cadence"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="help" size={20} label={t('exercise:setup.rules.explain')} />
          </Link>
        }
      >
        {ruleRow(errors)}
      </SetupSection>

      <SetupSection
        title={t('exercise:setup.rules.warnings')}
        hint={t('exercise:setup.rules.warningsHint')}
      >
        {ruleRow(warnings)}
      </SetupSection>
    </HarmonySetup>
  )
}
