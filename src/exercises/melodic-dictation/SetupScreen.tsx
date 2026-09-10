import { useTranslation } from 'react-i18next'

import { NoteGlyph } from '@/components/notation/NoteGlyph'
import { Icon } from '@/components/ui/Icon'
import { SetupChip, SetupSection } from '@/exercises/shared/SetupControls'
import { useMusicNames } from '@/hooks/useMusicNames'
import { METRONOME_MODES } from '@/lib/audio/rhythmSchedule'
import { CLEFS, type ClefId } from '@/lib/music/clef'
import { degreeKey, stepAt, stepIndex, parseDegreeKey } from '@/lib/music/degree'
import { parseMeter } from '@/lib/music/meter'
import { CELL_GROUP_IDS, type CellGroupId } from '@/lib/music/rhythmCells'
import { MODE_IDS, TONIC_KEYS, type ModeId } from '@/lib/music/scale'

import {
  BAR_COUNTS,
  MAX_STEPS,
  METER_CHOICES,
  ON_WEIGHT,
  ROUND_LENGTHS,
  TEMPOS,
  type MelodySettings,
} from './settings'

export interface SetupScreenProps {
  settings: MelodySettings
  onChange: (settings: MelodySettings) => void
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
 * The rungs a range may reach, from a fifth below the tonic to the octave and
 * a third above it.
 *
 * Offered as two rows of ends rather than as a free pair of numbers: what a
 * player is choosing is where the melody lives, and every pair of ends between
 * these is a range somebody might want. Anything wider than `MAX_STEPS` is
 * refused by the parser, so the two rows cannot between them build a keyboard
 * that will not lay out.
 */
const LOW_RUNGS = [-3, -2, -1, 0]
const HIGH_RUNGS = [4, 5, 6, 7, 8, 9]

/**
 * What to practise, before a round starts.
 *
 * Both halves of the exercise, in the order they are heard: the key and the
 * notes in it first, then the bar they fall in. The subdivisions are on and off
 * here rather than weighted by hand, exactly as in rhythmic dictation — a set
 * of sliders would be a mixing desk, and what a player wants to say is "give me
 * sixteenths", not "give me sixteenths at three parts in eleven".
 */
export function SetupScreen({ settings, onChange, onStart, onBack }: SetupScreenProps) {
  const { t } = useTranslation(['exercise', 'curriculum'])
  const names = useMusicNames()

  const enabled = (group: CellGroupId) => (settings.cellWeights[group] ?? 0) > 0
  const low = parseDegreeKey(settings.low)
  const high = parseDegreeKey(settings.high)
  const lowRung = low === undefined ? 0 : stepIndex(low)
  const highRung = high === undefined ? 4 : stepIndex(high)

  function toggleGroup(group: CellGroupId) {
    const weights = { ...settings.cellWeights, [group]: enabled(group) ? 0 : ON_WEIGHT }
    // An empty set would make a round with no questions in it.
    if (!CELL_GROUP_IDS.some((id) => (weights[id] ?? 0) > 0)) return
    onChange({ ...settings, cellWeights: weights })
  }

  function toggleIn<T>(list: readonly T[], item: T): readonly T[] | undefined {
    const next = list.includes(item)
      ? list.filter((entry) => entry !== item)
      : [...list, item]
    // The last one cannot be turned off, or the round has nothing to draw on.
    return next.length === 0 ? undefined : next
  }

  /** Both ends move together, so a range can never be inverted or too wide. */
  function setRange(from: number, to: number) {
    if (to - from < 1 || to - from + 1 > MAX_STEPS) return
    onChange({
      ...settings,
      low: degreeKey(stepAt(from)),
      high: degreeKey(stepAt(to)),
    })
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
            {t('curriculum:categories.dictation.exercises.short-melodies.title')}
          </h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('exercise:melody.setupBlurb')}
          </p>
        </header>

        <SetupSection
          title={t('exercise:setup.range.title')}
          hint={t('exercise:setup.range.hint')}
        >
          <p className="mb-2 text-sm font-medium text-ink">
            {t('exercise:setup.range.lowest')}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {LOW_RUNGS.map((rung) => (
              <SetupChip
                key={rung}
                selected={lowRung === rung}
                onClick={() => setRange(rung, highRung)}
                label={names.degree(stepAt(rung))}
              >
                {names.degreeShort(stepAt(rung))}
              </SetupChip>
            ))}
          </div>

          <p className="mb-2 text-sm font-medium text-ink">
            {t('exercise:setup.range.highest')}
          </p>
          <div className="flex flex-wrap gap-2">
            {HIGH_RUNGS.map((rung) => (
              <SetupChip
                key={rung}
                selected={highRung === rung}
                onClick={() => setRange(lowRung, rung)}
                label={names.degree(stepAt(rung))}
              >
                {names.degreeShort(stepAt(rung))}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

        <SetupSection title={t('exercise:setup.modes')}>
          <div className="flex flex-wrap gap-2">
            {MODE_IDS.map((mode) => (
              <SetupChip
                key={mode}
                selected={settings.modes.includes(mode)}
                onClick={() => {
                  const next = toggleIn<ModeId>(settings.modes, mode)
                  if (next !== undefined) onChange({ ...settings, modes: next })
                }}
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
            {TONIC_KEYS.map((tonic) => (
              <SetupChip
                key={tonic}
                selected={settings.tonics.includes(tonic)}
                onClick={() => {
                  const next = toggleIn(settings.tonics, tonic)
                  if (next !== undefined) onChange({ ...settings, tonics: next })
                }}
                label={names.tonic(tonic)}
              >
                {names.tonic(tonic)}
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

        <SetupSection title={t('exercise:setup.clefs')}>
          <div className="flex flex-wrap gap-2">
            {CLEFS.map((clef) => (
              <SetupChip
                key={clef.id}
                selected={settings.clefs.includes(clef.id)}
                onClick={() => {
                  const next = toggleIn<ClefId>(settings.clefs, clef.id)
                  if (next !== undefined) onChange({ ...settings, clefs: next })
                }}
              >
                {names.clef(clef.id)}
              </SetupChip>
            ))}
          </div>
        </SetupSection>

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
                  onClick={() => {
                    const next = toggleIn(settings.meters, meter)
                    if (next !== undefined) onChange({ ...settings, meters: next })
                  }}
                  label={parsed === undefined ? meter : names.meter(parsed)}
                >
                  {meter}
                </SetupChip>
              )
            })}
          </div>
        </SetupSection>

        <SetupSection
          title={t('exercise:setup.bars.title')}
          hint={t('exercise:setup.bars.hint')}
        >
          <div className="flex flex-wrap gap-2">
            {BAR_COUNTS.map((bars) => (
              <SetupChip
                key={bars}
                selected={settings.bars === bars}
                onClick={() => onChange({ ...settings, bars })}
                label={t('exercise:setup.bars.label', { count: bars })}
              >
                {bars}
              </SetupChip>
            ))}
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
