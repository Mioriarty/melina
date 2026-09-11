import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { SCALE_DIRECTIONS } from '@/exercises/scale-shared/generate'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { Icon } from '@/components/ui/Icon'
import { useMusicNames } from '@/hooks/useMusicNames'
import { CLEFS } from '@/lib/music/clef'
import { MODE_IDS, TONIC_CHOICES, tonicKey } from '@/lib/music/scale'

import { ROUND_LENGTHS, type ScaleHearingSettings } from './settings'

export interface SetupScreenProps {
  settings: ScaleHearingSettings
  onChange: (settings: ScaleHearingSettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

/**
 * What to practise, before a round starts.
 *
 * The same shape as the scale reading setup, plus the one thing only a
 * hearing exercise needs: whether the scale runs up from the tonic or down
 * from the octave above it.
 */
export function SetupScreen({ settings, onChange, onStart, onBack }: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  /** Toggle a value in one of the list settings, never emptying it. */
  function toggle<K extends 'clefs' | 'modes' | 'tonics' | 'directions'>(
    field: K,
    value: ScaleHearingSettings[K][number],
  ) {
    const current = settings[field] as readonly string[]
    const next = current.includes(value as string)
      ? current.filter((item) => item !== value)
      : [...current, value as string]

    // An empty list would make a round with no questions in it.
    if (next.length === 0) return
    onChange({ ...settings, [field]: next })
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
            {t('curriculum:categories.scales.exercises.hearing.title')}
          </h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('exercise:scales.hearing.setupBlurb')}
          </p>
        </header>

        <SetupSection
          title={t('exercise:setup.scaleDirection.title')}
          hint={t('exercise:setup.scaleDirection.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {SCALE_DIRECTIONS.map((direction) => (
              <SetupChip
                key={direction}
                selected={settings.directions.includes(direction)}
                onClick={() => toggle('directions', direction)}
                label={t('exercise:setup.chipLabel', {
                  label: names.scaleDirection(direction),
                  hint: names.scaleDirectionHint(direction),
                })}
              >
                {names.scaleDirection(direction)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.modes')}
          action={
            <Link
              to="/guide/scales?from=hearing"
              aria-label={t('exercise:setup.modesGuide')}
              title={t('exercise:setup.modesGuide')}
              className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-accent-tint hover:text-accent"
            >
              <Icon name="help" size={20} />
            </Link>
          }
        >
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
