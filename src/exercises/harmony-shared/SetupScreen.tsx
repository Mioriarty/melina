import { useTranslation } from 'react-i18next'

import type { ReactNode } from 'react'

import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { KEY_CHOICES, keyKey } from '@/lib/music/key'
import { tonicKey } from '@/lib/music/scale'
import { blocksOfKind, type BlockKind } from '@/lib/music/satzmodell'

import {
  BLOCK_CHOICES,
  CADENCE_CHOICES,
  CHORD_COUNTS,
  FREEDOMS,
  ROUND_LENGTHS,
  TEMPOS,
  type HarmonySettings,
} from './settings'

/**
 * What to practise, before a round starts — the progression half.
 *
 * The Satztechniken are offered **one at a time**, grouped by what they do,
 * because that is what makes the setting worth having: "only Trugschluss" and
 * "only Quintfallsequenz" are real things to sit down and practise, and a
 * switch per family could express neither.
 *
 * Shared between the harmony exercises rather than copied, because *which
 * progressions* is the same question wherever one is going to be heard or
 * written. What differs is what the exercise then does with them, and that
 * arrives as `children`: cadence writing adds the Lage and the rules, and they
 * go **above** the shared sections because they are what that exercise is
 * about, where the keys and the cadences are the background.
 *
 * **`onChange` takes a patch rather than a whole settings object**, which is
 * what lets one screen serve a settings type it does not know about. Cadence
 * writing's settings are these plus two fields; the screen changes the fields
 * it knows and the caller merges.
 */

export interface SetupScreenProps {
  settings: HarmonySettings
  /** `curriculum:` keys, so the header names the exercise this was reached from. */
  titleKey: string
  blurbKey: string
  onChange: (patch: Partial<HarmonySettings>) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
  /** Sections this exercise adds, drawn first. */
  children?: ReactNode
  /**
   * Whether an establishing cadence is a choice here. It is a question about
   * *hearing* the key, so an exercise that plays nothing until the answer is in
   * has nothing to establish.
   */
  establish?: boolean
}

const MIDDLE_KINDS: readonly BlockKind[] = ['prolongation', 'model', 'approach']

export function SetupScreen({
  settings,
  titleKey,
  blurbKey,
  onChange,
  onStart,
  onBack,
  children,
  establish = true,
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

  const majors = KEY_CHOICES.filter((key) => key.mode === 'ionian')
  const minors = KEY_CHOICES.filter((key) => key.mode === 'aeolian')

  const keyRow = (keys: typeof majors) => (
    <div className="flex flex-wrap gap-2">
      {keys.map((key) => {
        const id = keyKey(key)
        return (
          <SetupChip
            key={id}
            selected={settings.keys.includes(id)}
            onClick={() => {
              const next = toggle(settings.keys, id)
              if (next !== undefined) onChange({ keys: next })
            }}
            label={names.scaleName(tonicKey(key.tonic), key.mode)}
          >
            {names.tonic(tonicKey(key.tonic))}
          </SetupChip>
        )
      })}
    </div>
  )

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
            {t('curriculum:categories.harmony.title')}
          </p>
          <h1 className="mt-1 text-title">{t(titleKey)}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t(blurbKey)}</p>
        </header>

        {children}

        <SetupSection
          title={t('exercise:setup.harmonyKeys.major')}
          hint={t('exercise:setup.harmonyKeys.hint')}
        >
          {keyRow(majors)}
        </SetupSection>

        <SetupSection title={t('exercise:setup.harmonyKeys.minor')}>
          {keyRow(minors)}
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.cadences.title')}
          hint={t('exercise:setup.cadences.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {CADENCE_CHOICES.map((id) => (
              <SetupChip
                key={id}
                selected={settings.cadences.includes(id)}
                onClick={() => {
                  const next = toggle(settings.cadences, id)
                  if (next !== undefined) onChange({ cadences: next })
                }}
                label={names.technique(id)}
              >
                {names.techniqueShort(id)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        {MIDDLE_KINDS.map((kind) => (
          <SetupSection key={kind} title={t(`exercise:setup.blocks.${kind}`)}>
            <div className="flex flex-wrap gap-2">
              {blocksOfKind(kind)
                .filter((block) => BLOCK_CHOICES.includes(block.id))
                .map((block) => (
                  <SetupChip
                    key={block.id}
                    selected={settings.blocks.includes(block.id)}
                    onClick={() => {
                      // Unlike the cadences, this list may legitimately empty:
                      // a round of nothing but cadences and free motion is the
                      // easiest level there is.
                      const next = settings.blocks.includes(block.id)
                        ? settings.blocks.filter((id) => id !== block.id)
                        : [...settings.blocks, block.id]
                      onChange({ blocks: next })
                    }}
                    label={names.technique(block.id)}
                  >
                    {names.techniqueShort(block.id)}
                  </SetupChip>
                ))}
            </div>
          </SetupSection>
        ))}

        <SetupSection
          title={t('exercise:setup.freedom.title')}
          hint={t('exercise:setup.freedom.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {FREEDOMS.map((freedom) => (
              <SetupChip
                key={freedom}
                selected={settings.freedom === freedom}
                onClick={() => onChange({ freedom })}
              >
                {t(`exercise:setup.freedom.${freedom}`)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.harmonyLength.title')}>
          <div className="flex flex-wrap gap-2">
            {CHORD_COUNTS.map((count) => (
              <SetupChip
                key={count}
                selected={settings.chords.includes(count)}
                onClick={() => {
                  const next = toggle(settings.chords, count)
                  if (next !== undefined) onChange({ chords: next })
                }}
              >
                {count}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        {establish && (
          <SetupSection
            title={t('exercise:setup.establish.title')}
            hint={t('exercise:setup.establish.hint')}
          >
            <div className="flex flex-wrap gap-2">
              {[true, false].map((on) => (
                <SetupChip
                  key={String(on)}
                  selected={settings.establish === on}
                  onClick={() => onChange({ establish: on })}
                >
                  {t(`exercise:setup.establish.${on ? 'on' : 'off'}`)}
                </SetupChip>
              ))}
            </div>
          </SetupSection>
        )}

        <SetupSection title={t('exercise:setup.tempo')}>
          <div className="flex flex-wrap gap-2">
            {TEMPOS.map((tempo) => (
              <SetupChip
                key={tempo}
                selected={settings.tempo === tempo}
                onClick={() => onChange({ tempo })}
              >
                {tempo}
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
                onClick={() => onChange({ questionsPerRound: length })}
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
