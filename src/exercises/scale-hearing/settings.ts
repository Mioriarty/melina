import { isScaleDirection, type ScaleDirection } from '@/exercises/scale-shared/generate'
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
 * What the player is allowed to be asked, and how it should sound.
 *
 * The reading settings plus the one thing only a hearing exercise needs:
 * whether the scale runs up from the tonic or down from the octave above it.
 *
 * Every mode sounds different from every other, so unlike interval hearing
 * there is nothing to leave out here — the answer set is the same seven.
 */
export interface ScaleHearingSettings {
  clefs: readonly ClefId[]
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  directions: readonly ScaleDirection[]
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const

export const DEFAULT_SETTINGS: ScaleHearingSettings = {
  clefs: DEFAULT_CLEF_IDS,
  modes: DEFAULT_MODE_IDS,
  tonics: DEFAULT_TONIC_KEYS,
  directions: ['ascending'],
  questionsPerRound: 20,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

function parseSettings(value: unknown): ScaleHearingSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const modes = stringArray(raw.modes)?.filter(isModeId) ?? []
  const tonics = stringArray(raw.tonics)?.filter(isTonicKey) ?? []
  const directions = stringArray(raw.directions)?.filter(isScaleDirection) ?? []
  const questions = raw.questionsPerRound

  return {
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    modes: modes.length > 0 ? modes : DEFAULT_SETTINGS.modes,
    tonics: tonics.length > 0 ? tonics : DEFAULT_SETTINGS.tonics,
    directions: directions.length > 0 ? directions : DEFAULT_SETTINGS.directions,
    questionsPerRound:
      typeof questions === 'number' && ROUND_LENGTHS.includes(questions as 10 | 20 | 30)
        ? questions
        : DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const SCALE_HEARING_SETTINGS: SettingSpec<ScaleHearingSettings> = {
  key: 'exercise:scales/hearing',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}
