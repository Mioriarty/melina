import type { SettingSpec } from '@/lib/db/settings'
import { DEFAULT_CLEF_IDS, isClefId, type ClefId } from '@/lib/music/clef'
import {
  DEFAULT_MODE_IDS,
  DEFAULT_TONIC_KEYS,
  isModeId,
  isTonicKey,
  type ModeId,
} from '@/lib/music/scale'

/**
 * What the player is allowed to be asked.
 *
 * There is no key signature setting: a scale is always written keyless, so
 * that reading the mode means reading its accidentals rather than reading a
 * signature someone else already worked out. See `scaleMei`.
 *
 * Parsed defensively on the way out of IndexedDB, since a stored setting can
 * name a mode or a tonic that no longer exists.
 */
export interface ScaleReadingSettings {
  clefs: readonly ClefId[]
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  questionsPerRound: number
}

/**
 * Reading always draws a scale upwards. Nothing is played, so there is no
 * order to choose; the shared generator still wants a direction, and this is
 * it.
 */
export const READING_DIRECTIONS = ['ascending'] as const

export const ROUND_LENGTHS = [10, 20, 30] as const

export const DEFAULT_SETTINGS: ScaleReadingSettings = {
  clefs: DEFAULT_CLEF_IDS,
  modes: DEFAULT_MODE_IDS,
  tonics: DEFAULT_TONIC_KEYS,
  questionsPerRound: 20,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

/**
 * Every list must end up non-empty: a round with no clefs, modes or tonics
 * has no questions in it, so an empty selection falls back to the default
 * rather than producing a broken round.
 */
function parseSettings(value: unknown): ScaleReadingSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const modes = stringArray(raw.modes)?.filter(isModeId) ?? []
  const tonics = stringArray(raw.tonics)?.filter(isTonicKey) ?? []
  const questions = raw.questionsPerRound

  return {
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    modes: modes.length > 0 ? modes : DEFAULT_SETTINGS.modes,
    tonics: tonics.length > 0 ? tonics : DEFAULT_SETTINGS.tonics,
    questionsPerRound:
      typeof questions === 'number' && ROUND_LENGTHS.includes(questions as 10 | 20 | 30)
        ? questions
        : DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const SCALE_READING_SETTINGS: SettingSpec<ScaleReadingSettings> = {
  key: 'exercise:scales/reading',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}
