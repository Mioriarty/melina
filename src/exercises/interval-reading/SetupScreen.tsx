import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { CATALOG, QUALITY_ORDER } from '@/lib/music/catalog'
import { CLEFS } from '@/lib/music/clef'
import { intervalKey } from '@/lib/music/interval'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'

import { ROUND_LENGTHS, type IntervalReadingSettings } from './settings'

export interface SetupScreenProps {
  settings: IntervalReadingSettings
  onChange: (settings: IntervalReadingSettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

/**
 * What to practise, before a round starts.
 *
 * A screen rather than a modal: choosing the material is part of deciding
 * what to work on, not an aside from it, and it keeps the round itself free
 * of chrome. Owns its own scrolling, because the app shell deliberately does
 * not scroll, and carries its own link back to the path, because exercises
 * run without the header.
 */
export function SetupScreen({ settings, onChange, onStart, onBack }: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  /** Toggle a value in one of the list settings, never emptying it. */
  function toggle<K extends 'clefs' | 'keySignatures' | 'intervals'>(
    field: K,
    value: IntervalReadingSettings[K][number],
  ) {
    const current = settings[field] as readonly string[]
    const next = current.includes(value as string)
      ? current.filter((item) => item !== value)
      : [...current, value as string]

    // An empty list would make a round with no questions in it.
    if (next.length === 0) return
    onChange({ ...settings, [field]: next })
  }

  const intervalNumbers = [...new Set(CATALOG.map((interval) => interval.number))]

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
            {t('curriculum:categories.intervals.title')}
          </p>
          <h1 className="mt-1 text-title">
            {t('curriculum:categories.intervals.exercises.reading.title')}
          </h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('exercise:intervals.reading.setupBlurb')}
          </p>
        </header>

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

        <SetupSection
          title={t('exercise:setup.keySignatures.title')}
          hint={t('exercise:setup.keySignatures.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {KEY_SIGNATURES.map((signature) => (
              <SetupChip
                key={signature.id}
                selected={settings.keySignatures.includes(signature.id)}
                onClick={() => toggle('keySignatures', signature.id)}
                label={names.keyName(signature.id)}
              >
                {names.keyMajor(signature.id)}
                <span className="ml-1 text-ink-faint">
                  /{names.keyMinor(signature.id)}
                </span>
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.intervals.title')}>
          <div className="grid gap-1.5">
            {intervalNumbers.map((number) => (
              <div key={number} className="flex flex-wrap items-center gap-2">
                <span className="w-[4.5rem] shrink-0 font-serif text-[0.9375rem] font-semibold text-ink-muted">
                  {names.number(number)}
                </span>
                {QUALITY_ORDER.filter((quality) =>
                  CATALOG.some((i) => i.number === number && i.quality === quality),
                ).map((quality) => {
                  const key = intervalKey({ number, quality })
                  return (
                    <SetupChip
                      key={key}
                      selected={settings.intervals.includes(key)}
                      onClick={() => toggle('intervals', key)}
                      label={names.interval({ number, quality })}
                    >
                      {names.quality(quality)}
                    </SetupChip>
                  )
                })}
              </div>
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
