import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { parseFigureKey } from '@/lib/music/figuredBass'
import { figureText } from '@/lib/notation/figureNotation'

import {
  EVENT_COUNTS,
  FIGURE_CHOICES,
  KEY_SIGNATURE_CHOICES,
  ROUND_LENGTHS,
  SUSPENSION_CHOICES,
  type ThoroughbassSettings,
} from './settings'

/**
 * What to practise, before a round starts. Shared by both directions.
 *
 * Reading a figure and writing one draw on exactly the same vocabulary, so
 * what can be asked is said once here and the two exercises differ only in
 * which half of the page is blank.
 */
export interface SetupScreenProps {
  settings: ThoroughbassSettings
  /** `curriculum:` keys, so the header names the exercise this was reached from. */
  titleKey: string
  blurbKey: string
  /** Which exercise this is, so the guide comes back to the right one. */
  direction: 'figuring' | 'realizing'
  onChange: (settings: ThoroughbassSettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

export function SetupScreen({
  settings,
  titleKey,
  blurbKey,
  direction,
  onChange,
  onStart,
  onBack,
}: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  function toggleFigure(figure: string) {
    const next = settings.figures.includes(figure)
      ? settings.figures.filter((item) => item !== figure)
      : [...settings.figures, figure]
    // An empty set would make a round with no questions in it.
    if (next.length === 0) return
    onChange({ ...settings, figures: next })
  }

  function toggleSuspension(key: string) {
    const next = settings.suspensions.includes(key)
      ? settings.suspensions.filter((item) => item !== key)
      : [...settings.suspensions, key]
    // Unlike the figures, this one may be emptied: a level of nothing but
    // single figures is the ordinary case.
    if (next.length === 0 && settings.figures.length === 0) return
    onChange({ ...settings, suspensions: next })
  }

  function toggleKey(id: (typeof KEY_SIGNATURE_CHOICES)[number]) {
    const next = settings.keySignatures.includes(id)
      ? settings.keySignatures.filter((item) => item !== id)
      : [...settings.keySignatures, id]
    if (next.length === 0) return
    onChange({ ...settings, keySignatures: next })
  }

  /** `4-3` is written `4 – 3`, which is how it appears on a page. */
  const suspensionLabel = (key: string) =>
    key
      .split('-')
      .map((part) => {
        const parsed = parseFigureKey(part)
        return parsed === undefined ? part : figureText(parsed)
      })
      .join(' – ')

  /** A plain triad is written by writing nothing, so its chip needs words. */
  const figureLabel = (figure: string) => {
    const parsed = parseFigureKey(figure)
    const printed = parsed === undefined ? figure : figureText(parsed)
    return printed === '' ? t('exercise:thoroughbass.plain') : printed
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
            {t('curriculum:categories.thoroughbass.title')}
          </p>
          <h1 className="mt-1 text-title">{t(titleKey)}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t(blurbKey)}</p>
        </header>

        <SetupSection
          title={t('exercise:setup.figures.title')}
          hint={t('exercise:setup.figures.hint')}
          action={
            // In the corner rather than under the hint: it is there the first
            // time you meet the setting and invisible every time after. The
            // rules of omission need a page, not a line.
            <Link
              to={`/guide/figured-bass?from=${direction}`}
              aria-label={t('exercise:setup.figures.guide')}
              title={t('exercise:setup.figures.guide')}
              className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-accent-tint hover:text-accent"
            >
              <Icon name="help" size={20} />
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            {FIGURE_CHOICES.map((figure) => (
              <SetupChip
                key={figure === '' ? 'plain' : figure}
                selected={settings.figures.includes(figure)}
                onClick={() => toggleFigure(figure)}
                label={figureLabel(figure)}
              >
                {figureLabel(figure)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.suspensions.title')}
          hint={t('exercise:setup.suspensions.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {SUSPENSION_CHOICES.map((key) => (
              <SetupChip
                key={key}
                selected={settings.suspensions.includes(key)}
                onClick={() => toggleSuspension(key)}
                label={suspensionLabel(key)}
              >
                {suspensionLabel(key)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.keySignatures.title')}
          hint={t('exercise:setup.figureKeysHint')}
        >
          <div className="flex flex-wrap gap-2">
            {KEY_SIGNATURE_CHOICES.map((id) => (
              <SetupChip
                key={id}
                selected={settings.keySignatures.includes(id)}
                onClick={() => toggleKey(id)}
                label={names.keyName(id)}
              >
                {names.keyMajor(id)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.bassNotes.title')}
          hint={t('exercise:setup.bassNotes.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {EVENT_COUNTS.map((count) => (
              <SetupChip
                key={count}
                selected={settings.events === count}
                onClick={() => onChange({ ...settings, events: count })}
                label={t('exercise:setup.bassNotes.label', { count })}
              >
                {count}
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
