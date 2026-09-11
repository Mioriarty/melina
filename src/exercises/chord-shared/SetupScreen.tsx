import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { Icon } from '@/components/ui/Icon'
import { useMusicNames } from '@/hooks/useMusicNames'
import { CLEFS } from '@/lib/music/clef'
import { PLAY_DIRECTIONS } from '@/lib/music/direction'
import { memberAt } from '@/lib/music/chord'

import {
  INVERSION_CHOICES,
  QUALITY_CHOICES,
  ROOT_CHOICES,
  ROUND_LENGTHS,
  type ChordSettings,
} from './settings'

/**
 * What to practise, before a round starts. Shared by all three exercises.
 *
 * Reading a chord, hearing one and writing one draw on exactly the same
 * vocabulary, so what can be asked is said once here and the exercises differ
 * only in which end of the question is blank — the same arrangement
 * thoroughbass's two directions have.
 */
export interface SetupScreenProps {
  settings: ChordSettings
  /** `curriculum:` keys, so the header names the exercise this was reached from. */
  titleKey: string
  blurbKey: string
  /** Which exercise this is, so the guide comes back to the right one. */
  direction: 'reading' | 'hearing' | 'writing'
  onChange: (settings: ChordSettings) => void
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

  /** Toggle within a list that may never be emptied: a round needs something. */
  function toggle<T>(list: readonly T[], value: T): readonly T[] | undefined {
    const next = list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value]
    return next.length === 0 ? undefined : next
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
            {t('curriculum:categories.chords.title')}
          </p>
          <h1 className="mt-1 text-title">{t(titleKey)}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t(blurbKey)}</p>
        </header>

        <SetupSection
          title={t('exercise:setup.qualities.title')}
          hint={t('exercise:setup.qualities.hint')}
          action={
            // In the corner rather than under the hint: it is there the first
            // time you meet the setting and invisible every time after. What
            // the nine chords are, and what their names mean, needs a page.
            <Link
              to={`/guide/chords?from=${direction}`}
              aria-label={t('exercise:setup.qualities.guide')}
              title={t('exercise:setup.qualities.guide')}
              className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-accent-tint hover:text-accent"
            >
              <Icon name="help" size={20} />
            </Link>
          }
        >
          <div className="flex flex-wrap gap-2">
            {QUALITY_CHOICES.map((quality) => (
              <SetupChip
                key={quality}
                selected={settings.qualities.includes(quality)}
                onClick={() => {
                  const next = toggle(settings.qualities, quality)
                  if (next !== undefined) onChange({ ...settings, qualities: next })
                }}
                label={names.chordQuality(quality)}
              >
                {names.chordQualityShort(quality)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.inversions.title')}
          hint={t('exercise:setup.inversions.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {INVERSION_CHOICES.map((inversion) => (
              <SetupChip
                key={inversion}
                selected={settings.inversions.includes(inversion)}
                onClick={() => {
                  const next = toggle(settings.inversions, inversion)
                  if (next !== undefined) onChange({ ...settings, inversions: next })
                }}
                label={names.inversionName(inversion, 4)}
              >
                {names.inversionShort(inversion)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.lage.title')}
          hint={t('exercise:setup.lage.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {[false, true].map((value) => (
              <SetupChip
                key={String(value)}
                selected={settings.lage === value}
                onClick={() => onChange({ ...settings, lage: value })}
              >
                {value
                  ? t('exercise:setup.lage.asked')
                  : t('exercise:setup.lage.stacked')}
              </SetupChip>
            ))}
          </div>
          {settings.lage && (
            <p className="mt-3 text-sm leading-relaxed text-ink-faint">
              {t('exercise:setup.lage.members', {
                members: [0, 1, 2, 3]
                  .map((member) => names.lage(memberAt(member)))
                  .join(', '),
              })}
            </p>
          )}
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.roots.title')}
          hint={t('exercise:setup.roots.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {ROOT_CHOICES.map((root) => (
              <SetupChip
                key={root}
                selected={settings.roots.includes(root)}
                onClick={() => {
                  const next = toggle(settings.roots, root)
                  if (next !== undefined) onChange({ ...settings, roots: next })
                }}
                label={names.tonic(root)}
              >
                {names.tonic(root)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.clefs')}>
          <div className="flex flex-wrap gap-2">
            {CLEFS.map((clef) => (
              <SetupChip
                key={clef.id}
                selected={settings.clefs.includes(clef.id)}
                onClick={() => {
                  const next = toggle(settings.clefs, clef.id)
                  if (next !== undefined) onChange({ ...settings, clefs: next })
                }}
                label={names.clefSpoken(clef.id)}
              >
                {names.clef(clef.id)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.chordPlayback.title')}
          hint={t('exercise:setup.chordPlayback.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {PLAY_DIRECTIONS.map((id) => (
              <SetupChip
                key={id}
                selected={settings.directions.includes(id)}
                onClick={() => {
                  const next = toggle(settings.directions, id)
                  if (next !== undefined) onChange({ ...settings, directions: next })
                }}
                label={t(`exercise:setup.chordPlayback.${id}`)}
              >
                {t(`exercise:setup.chordPlayback.${id}`)}
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
