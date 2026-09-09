import { isMetronomeMode, type MetronomeMode } from '@/lib/audio/rhythmSchedule'
import type { SettingSpec } from '@/lib/db/settings'
import { METER_KEYS, isMeterKey } from '@/lib/music/meter'
import {
  CELL_GROUP_IDS,
  NO_CELLS,
  isCellGroupId,
  type CellWeights,
} from '@/lib/music/rhythmCells'

/**
 * What the player is allowed to be asked, and how it should sound.
 *
 * `cellWeights` does two jobs with one field: a group at `0` is not in this
 * level at all, and the rest are relative likelihoods. That is deliberate —
 * "which subdivisions" and "how often" are the same question, and splitting
 * them into a list and a table would let the two disagree.
 */
export interface RhythmSettings {
  /** Meter keys, e.g. `4/4`. */
  meters: readonly string[]
  cellWeights: CellWeights
  /** Beats per minute. */
  tempo: number
  metronome: MetronomeMode
  minOnsets: number
  allowInitialRest: boolean
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const
export const TEMPOS = [60, 80, 100, 120] as const

/** A sensible spread: mostly beats and eighths, with sixteenths behind them. */
export const DEFAULT_WEIGHTS: CellWeights = {
  ...NO_CELLS,
  quarter: 5,
  hold: 2,
  eighth: 4,
  offbeat: 1,
  sixteenth: 2,
  dotted: 1,
}

export const DEFAULT_SETTINGS: RhythmSettings = {
  meters: ['4/4'],
  cellWeights: DEFAULT_WEIGHTS,
  tempo: 80,
  metronome: 'count-in',
  minOnsets: 4,
  allowInitialRest: false,
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

function parseSettings(value: unknown): RhythmSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

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
    meters: meters.length > 0 ? meters : DEFAULT_SETTINGS.meters,
    cellWeights: parseWeights(raw.cellWeights) ?? DEFAULT_SETTINGS.cellWeights,
    tempo: oneOf(raw.tempo, TEMPOS) ?? DEFAULT_SETTINGS.tempo,
    metronome,
    minOnsets,
    allowInitialRest:
      typeof raw.allowInitialRest === 'boolean'
        ? raw.allowInitialRest
        : DEFAULT_SETTINGS.allowInitialRest,
    questionsPerRound:
      oneOf(raw.questionsPerRound, ROUND_LENGTHS) ?? DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const RHYTHM_SETTINGS: SettingSpec<RhythmSettings> = {
  key: 'exercise:dictation/rhythm',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}

/** Every group, for the setup screen to lay out in a fixed order. */
export const WEIGHT_GROUPS = CELL_GROUP_IDS
/** How heavy a group is when the setup screen switches it on. */
export const ON_WEIGHT = 3

export const METER_CHOICES = METER_KEYS
