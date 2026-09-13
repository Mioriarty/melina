import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import {
  BLOCK_CHOICES,
  CADENCE_CHOICES,
  CHORD_COUNTS,
  FREEDOMS,
  ROUND_LENGTHS,
  TEMPOS,
  type HarmonySettings,
} from '@/exercises/harmony-shared/settings'
import { useMusicNames } from '@/hooks/useMusicNames'
import { KEY_CHOICES, keyKey } from '@/lib/music/key'
import { tonicKey } from '@/lib/music/scale'
import { blocksOfKind, type BlockKind } from '@/lib/music/satzmodell'

/**
 * What to practise, before a round starts.
 *
 * The Satztechniken are offered **one at a time**, grouped by what they do,
 * because that is what makes the setting worth having: "only Trugschluss" and
 * "only Quintfallsequenz" are real things to sit down and practise, and a
 * switch per family could express neither.
 */

export interface SetupScreenProps {
  settings: HarmonySettings
  /** `curriculum:` keys, so the header names the exercise this was reached from. */
  titleKey: string
  blurbKey: string
  onChange: (settings: HarmonySettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

const MIDDLE_KINDS: readonly BlockKind[] = ['prolongation', 'model', 'approach']

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
              if (next !== undefined) onChange({ ...settings, keys: next })
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
                  if (next !== undefined) onChange({ ...settings, cadences: next })
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
                      onChange({ ...settings, blocks: next })
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
                onClick={() => onChange({ ...settings, freedom })}
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
                  if (next !== undefined) onChange({ ...settings, chords: next })
                }}
              >
                {count}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.establish.title')}
          hint={t('exercise:setup.establish.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {[true, false].map((on) => (
              <SetupChip
                key={String(on)}
                selected={settings.establish === on}
                onClick={() => onChange({ ...settings, establish: on })}
              >
                {t(`exercise:setup.establish.${on ? 'on' : 'off'}`)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.tempo')}>
          <div className="flex flex-wrap gap-2">
            {TEMPOS.map((tempo) => (
              <SetupChip
                key={tempo}
                selected={settings.tempo === tempo}
                onClick={() => onChange({ ...settings, tempo })}
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
