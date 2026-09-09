import { useTranslation } from 'react-i18next'

import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { Icon } from '@/components/ui/Icon'
import { NoteGlyph } from '@/components/notation/NoteGlyph'
import { useMusicNames } from '@/hooks/useMusicNames'
import { METRONOME_MODES } from '@/lib/audio/rhythmSchedule'
import { parseMeter } from '@/lib/music/meter'
import { CELL_GROUP_IDS, type CellGroupId } from '@/lib/music/rhythmCells'

import {
  METER_CHOICES,
  ON_WEIGHT,
  ROUND_LENGTHS,
  TEMPOS,
  type RhythmSettings,
} from './settings'

export interface SetupScreenProps {
  settings: RhythmSettings
  onChange: (settings: RhythmSettings) => void
  onStart: () => void
  /** Back to the level list, which is where this screen is reached from. */
  onBack: () => void
}

/** A glyph for each subdivision chip, so the row reads as music. */
const GROUP_GLYPH: Record<
  CellGroupId,
  { value: 1 | 2 | 4 | 8 | 16; kind: 'note' | 'rest' }
> = {
  quarter: { value: 4, kind: 'note' },
  hold: { value: 2, kind: 'note' },
  eighth: { value: 8, kind: 'note' },
  offbeat: { value: 8, kind: 'rest' },
  sixteenth: { value: 16, kind: 'note' },
  dotted: { value: 8, kind: 'note' },
  triplet: { value: 8, kind: 'note' },
  quintuplet: { value: 16, kind: 'note' },
}

/**
 * What to practise, before a round starts.
 *
 * The subdivisions are on and off here rather than weighted by hand: a set of
 * sliders would be a mixing desk, and what a player wants to say is "give me
 * sixteenths", not "give me sixteenths at three parts in eleven". The levels
 * carry the weights; this carries the switches.
 */
export function SetupScreen({ settings, onChange, onStart, onBack }: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  const enabled = (group: CellGroupId) => (settings.cellWeights[group] ?? 0) > 0

  function toggleGroup(group: CellGroupId) {
    const weights = { ...settings.cellWeights, [group]: enabled(group) ? 0 : ON_WEIGHT }
    // An empty set would make a round with no questions in it.
    if (!CELL_GROUP_IDS.some((id) => (weights[id] ?? 0) > 0)) return
    onChange({ ...settings, cellWeights: weights })
  }

  function toggleMeter(meter: string) {
    const next = settings.meters.includes(meter)
      ? settings.meters.filter((item) => item !== meter)
      : [...settings.meters, meter]

    if (next.length === 0) return
    onChange({ ...settings, meters: next })
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
            {t('curriculum:categories.dictation.title')}
          </p>
          <h1 className="mt-1 text-title">
            {t('curriculum:categories.dictation.exercises.rhythm.title')}
          </h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('exercise:rhythm.setupBlurb')}
          </p>
        </header>

        <SetupSection
          title={t('exercise:setup.subdivisions.title')}
          hint={t('exercise:setup.subdivisions.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {CELL_GROUP_IDS.map((group) => (
              <SetupChip
                key={group}
                selected={enabled(group)}
                onClick={() => toggleGroup(group)}
                label={t(`exercise:setup.cellGroups.${group}`)}
              >
                <span className="flex items-center gap-1.5">
                  <NoteGlyph
                    value={GROUP_GLYPH[group].value}
                    kind={GROUP_GLYPH[group].kind}
                    dotted={group === 'dotted'}
                    size={16}
                  />
                  {t(`exercise:setup.cellGroups.${group}`)}
                </span>
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.meters')}>
          <div className="flex flex-wrap gap-2">
            {METER_CHOICES.map((meter) => {
              const parsed = parseMeter(meter)
              return (
                <SetupChip
                  key={meter}
                  selected={settings.meters.includes(meter)}
                  onClick={() => toggleMeter(meter)}
                  label={parsed === undefined ? meter : names.meter(parsed)}
                >
                  {meter}
                </SetupChip>
              )
            })}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.metronome.title')}
          hint={t('exercise:setup.metronome.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {METRONOME_MODES.map((mode) => (
              <SetupChip
                key={mode}
                selected={settings.metronome === mode}
                onClick={() => onChange({ ...settings, metronome: mode })}
              >
                {t(`exercise:setup.metronome.${mode}`)}
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
                label={t('exercise:setup.tempoLabel', { tempo })}
              >
                {tempo}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.openingRest.title')}
          hint={t('exercise:setup.openingRest.hint')}
        >
          <div className="flex flex-wrap gap-2">
            <SetupChip
              selected={settings.allowInitialRest}
              onClick={() =>
                onChange({ ...settings, allowInitialRest: !settings.allowInitialRest })
              }
            >
              {t('exercise:setup.openingRest.allow')}
            </SetupChip>
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
