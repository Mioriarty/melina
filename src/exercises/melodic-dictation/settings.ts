import { isMetronomeMode, type MetronomeMode } from '@/lib/audio/rhythmSchedule'
import type { SettingSpec } from '@/lib/db/settings'
import { DEFAULT_CLEF_IDS, isClefId, type ClefId } from '@/lib/music/clef'
import { degreeKey, parseDegreeKey, stepIndex, stepRange } from '@/lib/music/degree'
import { METER_KEYS, isMeterKey } from '@/lib/music/meter'
import {
  CELL_GROUP_IDS,
  NO_CELLS,
  isCellGroupId,
  type CellWeights,
} from '@/lib/music/rhythmCells'
import { DEFAULT_TONIC_KEYS, isModeId, isTonicKey, type ModeId } from '@/lib/music/scale'

/**
 * What the player is allowed to be asked.
 *
 * Melodic dictation is the two halves at once, so its settings are the two sets
 * of settings: the key and the notes within it, from scale degrees, and the
 * metre and subdivisions, from rhythmic dictation. Nothing new was needed for
 * either half, which is the point — this exercise is the culmination of those
 * two rather than a third thing.
 *
 * The one genuinely new axis is `low` and `high`: **the range of scale steps a
 * melody may use, and so the keys on the keyboard.** A contiguous run rather
 * than a set, because a melody moves through its range rather than picking out
 * of it, and because two ends is one thing to choose where a set is seven.
 */
export interface MelodySettings {
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  clefs: readonly ClefId[]
  /** The lowest step a melody may use, as a degree key: `5_` is a fifth below. */
  low: string
  /** The highest, e.g. `1'` for the octave above the tonic. */
  high: string
  alterations: boolean
  /** Meter keys, e.g. `4/4`. */
  meters: readonly string[]
  cellWeights: CellWeights
  bars: number
  /** Beats per minute. */
  tempo: number
  metronome: MetronomeMode
  /** Fewest impacts a **bar** may have, so a phrase is never mostly silence. */
  minOnsets: number
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const
export const TEMPOS = [60, 80, 100, 120] as const

/**
 * How many bars a phrase may be.
 *
 * Four is offered and nothing ships at it. One bar per system is what keeps
 * the staff the size rhythmic dictation's is — reserving two bars of the worst
 * case on one line comes out around 1300 units wide, which a phone's column
 * scales to a staff of some 35px — so four bars is four systems, and four
 * systems in the room the notation gets on a phone is smaller than anyone can
 * read. It is a real setting for a desktop and a bad default, so Custom has it
 * and no level does.
 */
export const BAR_COUNTS = [1, 2, 4] as const

/**
 * The widest range the keyboard will lay out.
 *
 * One key per step, so the range *is* the key count. Past about a twelfth the
 * keys stop fitting beside the note values and the switches above them, and a
 * keyboard that has to be scrolled to reach a note is a keyboard that loses
 * the note. Thirteen is an octave and a fifth.
 */
export const MAX_STEPS = 13

/** A sensible spread: mostly beats and eighths, with sixteenths behind them. */
export const DEFAULT_WEIGHTS: CellWeights = {
  ...NO_CELLS,
  quarter: 5,
  hold: 2,
  eighth: 4,
  offbeat: 1,
  sixteenth: 1,
}

export const DEFAULT_SETTINGS: MelodySettings = {
  modes: ['ionian', 'aeolian'],
  tonics: DEFAULT_TONIC_KEYS,
  clefs: ['treble'],
  low: '1',
  high: '5',
  alterations: false,
  meters: ['4/4'],
  cellWeights: DEFAULT_WEIGHTS,
  bars: 1,
  tempo: 80,
  metronome: 'count-in',
  minOnsets: 2,
  questionsPerRound: 10,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

/** Only groups that still exist, and only weights that are real numbers. */
function parseWeights(value: unknown): CellWeights | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const weights = { ...NO_CELLS }
  let any = false

  for (const [group, weight] of Object.entries(raw)) {
    if (!isCellGroupId(group)) continue
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) continue
    weights[group] = weight
    if (weight > 0) any = true
  }

  // A level with nothing switched on would generate an empty round.
  return any ? weights : undefined
}

function oneOf<T extends number>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'number' && allowed.includes(value as T)
    ? (value as T)
    : undefined
}

/**
 * The two ends of the range, checked together.
 *
 * They only mean anything as a pair — the wrong way round is not a range, and
 * one too far from the other is a keyboard that will not lay out — so a bad
 * pair falls back to the default pair rather than to a mix of stored and
 * default ends, which could be a worse range than either.
 */
function parseRange(low: unknown, high: unknown): { low: string; high: string } {
  const from = typeof low === 'string' ? parseDegreeKey(low) : undefined
  const to = typeof high === 'string' ? parseDegreeKey(high) : undefined
  if (from === undefined || to === undefined) {
    return { low: DEFAULT_SETTINGS.low, high: DEFAULT_SETTINGS.high }
  }

  const span = stepIndex(to) - stepIndex(from)
  if (span < 1 || span + 1 > MAX_STEPS) {
    return { low: DEFAULT_SETTINGS.low, high: DEFAULT_SETTINGS.high }
  }

  return { low: degreeKey(from), high: degreeKey(to) }
}

function parseSettings(value: unknown): MelodySettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const modes = stringArray(raw.modes)?.filter(isModeId) ?? []
  const tonics = stringArray(raw.tonics)?.filter(isTonicKey) ?? []
  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const meters = stringArray(raw.meters)?.filter(isMeterKey) ?? []

  const metronome =
    typeof raw.metronome === 'string' && isMetronomeMode(raw.metronome)
      ? raw.metronome
      : DEFAULT_SETTINGS.metronome

  const minOnsets =
    typeof raw.minOnsets === 'number' &&
    Number.isInteger(raw.minOnsets) &&
    raw.minOnsets >= 1
      ? raw.minOnsets
      : DEFAULT_SETTINGS.minOnsets

  return {
    modes: modes.length > 0 ? modes : DEFAULT_SETTINGS.modes,
    tonics: tonics.length > 0 ? tonics : DEFAULT_SETTINGS.tonics,
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    ...parseRange(raw.low, raw.high),
    alterations:
      typeof raw.alterations === 'boolean'
        ? raw.alterations
        : DEFAULT_SETTINGS.alterations,
    meters: meters.length > 0 ? meters : DEFAULT_SETTINGS.meters,
    cellWeights: parseWeights(raw.cellWeights) ?? DEFAULT_SETTINGS.cellWeights,
    bars: oneOf(raw.bars, BAR_COUNTS) ?? DEFAULT_SETTINGS.bars,
    tempo: oneOf(raw.tempo, TEMPOS) ?? DEFAULT_SETTINGS.tempo,
    metronome,
    minOnsets,
    questionsPerRound:
      oneOf(raw.questionsPerRound, ROUND_LENGTHS) ?? DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const MELODY_SETTINGS: SettingSpec<MelodySettings> = {
  key: 'exercise:dictation/short-melodies',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}

/** The steps a range covers, which is one key each on the keyboard. */
export function rangeSteps(low: string, high: string) {
  const from = parseDegreeKey(low)
  const to = parseDegreeKey(high)
  return from === undefined || to === undefined ? [] : stepRange(from, to)
}

/** Every group, for the setup screen to lay out in a fixed order. */
export const WEIGHT_GROUPS = CELL_GROUP_IDS
/** How heavy a group is when the setup screen switches it on. */
export const ON_WEIGHT = 3

export const METER_CHOICES = METER_KEYS
export { DEFAULT_CLEF_IDS }
