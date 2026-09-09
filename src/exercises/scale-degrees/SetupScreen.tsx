import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { CLEFS } from '@/lib/music/clef'
import { DEGREE_NUMBERS } from '@/lib/music/degree'
import { MODE_IDS, TONIC_CHOICES, tonicKey } from '@/lib/music/scale'

import { MELODY_LENGTHS, ROUND_LENGTHS, type DegreeSettings } from './settings'

export interface SetupScreenProps {
  settings: DegreeSettings
  onChange: (settings: DegreeSettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

/**
 * What to practise, before a round starts.
 *
 * The degrees are the first choice on the screen because they are the exercise:
 * three notes around the tonic and all seven are different tasks, and which of
 * them are in play matters more than anything else here.
 */
export function SetupScreen({ settings, onChange, onStart, onBack }: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  /** Toggle a value in one of the list settings, never emptying it. */
  function toggle<K extends 'clefs' | 'modes' | 'tonics'>(
    field: K,
    value: DegreeSettings[K][number],
  ) {
    const current = settings[field] as readonly string[]
    const next = current.includes(value as string)
      ? current.filter((item) => item !== value)
      : [...current, value as string]

    // An empty list would make a round with no questions in it.
    if (next.length === 0) return
    onChange({ ...settings, [field]: next })
  }

  function toggleDegree(number: number) {
    const next = settings.degrees.includes(number)
      ? settings.degrees.filter((item) => item !== number)
      : [...settings.degrees, number].sort((a, b) => a - b)

    if (next.length === 0) return
    onChange({ ...settings, degrees: next })
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-6">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t('exercise:setup.back')}
          </button>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            {t('curriculum:categories.scales.title')}
          </p>
          <h1 className="mt-1 text-title">
            {t('curriculum:categories.scales.exercises.degrees.title')}
          </h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('exercise:degrees.setupBlurb')}
          </p>
        </header>

        <SetupSection
          title={t('exercise:setup.degrees.title')}
          hint={t('exercise:setup.degrees.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {DEGREE_NUMBERS.map((number) => (
              <SetupChip
                key={number}
                selected={settings.degrees.includes(number)}
                onClick={() => toggleDegree(number)}
                label={names.degree({ number, alteration: 0 })}
              >
                {number}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.alterations.title')}
          hint={t('exercise:setup.alterations.hint')}
        >
          <div className="flex flex-wrap gap-2">
            <SetupChip
              selected={settings.alterations}
              onClick={() =>
                onChange({ ...settings, alterations: !settings.alterations })
              }
            >
              {t('exercise:setup.alterations.allow')}
            </SetupChip>
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.melodyLength.title')}
          hint={t('exercise:setup.melodyLength.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {MELODY_LENGTHS.map((length) => (
              <SetupChip
                key={length}
                selected={settings.melodyLength === length}
                onClick={() => onChange({ ...settings, melodyLength: length })}
                label={t('exercise:setup.melodyLength.label', { count: length })}
              >
                {length}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.startOnTonic.title')}
          hint={t('exercise:setup.startOnTonic.hint')}
        >
          <div className="flex flex-wrap gap-2">
            <SetupChip
              selected={settings.startOnTonic}
              onClick={() =>
                onChange({ ...settings, startOnTonic: !settings.startOnTonic })
              }
            >
              {t('exercise:setup.startOnTonic.allow')}
            </SetupChip>
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.modes')}>
          <div className="flex flex-wrap gap-2">
            {MODE_IDS.map((mode) => (
              <SetupChip
                key={mode}
                selected={settings.modes.includes(mode)}
                onClick={() => toggle('modes', mode)}
                label={names.modeFull(mode)}
              >
                {names.mode(mode)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.tonics.title')}
          hint={t('exercise:setup.tonics.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {TONIC_CHOICES.map((tonic) => {
              const key = tonicKey(tonic)
              return (
                <SetupChip
                  key={key}
                  selected={settings.tonics.includes(key)}
                  onClick={() => toggle('tonics', key)}
                >
                  {names.tonic(key)}
                </SetupChip>
              )
            })}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.clefs')}>
          <div className="flex flex-wrap gap-2">
            {CLEFS.map((clef) => (
              <SetupChip
                key={clef.id}
                selected={settings.clefs.includes(clef.id)}
                onClick={() => toggle('clefs', clef.id)}
              >
                {names.clef(clef.id)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.questionsPerRound')}>
          <div className="flex flex-wrap gap-2">
            {ROUND_LENGTHS.map((length) => (
              <SetupChip
                key={length}
                selected={settings.questionsPerRound === length}
                onClick={() => onChange({ ...settings, questionsPerRound: length })}
              >
                {length}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 flex min-h-12 w-full items-center justify-center rounded-full bg-accent font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
        >
          {t('exercise:setup.start')}
        </button>
      </div>
    </div>
  )
}
