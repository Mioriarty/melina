import { CATALOG_KEYS, DEFAULT_INTERVAL_KEYS } from '@/lib/music/catalog'
import { DEFAULT_CLEF_IDS, isClefId, type ClefId } from '@/lib/music/clef'
import {
  DEFAULT_KEY_SIGNATURE_IDS,
  isKeySignatureId,
  type KeySignatureId,
} from '@/lib/music/keySignature'
import type { SettingSpec } from '@/lib/db/settings'

/**
 * What the player is allowed to be asked.
 *
 * Parsed defensively on the way out of IndexedDB: a stored setting can be
 * stale after the catalog changes, and an unknown clef or interval must
 * degrade to the default rather than generating an unanswerable question.
 */
export interface IntervalReadingSettings {
  clefs: readonly ClefId[]
  keySignatures: readonly KeySignatureId[]
  /** Interval keys, e.g. `P5`. */
  intervals: readonly string[]
  questionsPerRound: number
}

/**
 * Reading always engraves the two notes as a chord — there is nothing to
 * hear, so there is no order to choose. The shared generator still wants a
 * direction, and this is it.
 */
export const READING_DIRECTIONS = ['harmonic'] as const

export const ROUND_LENGTHS = [10, 20, 30] as const

export const DEFAULT_SETTINGS: IntervalReadingSettings = {
  clefs: DEFAULT_CLEF_IDS,
  keySignatures: DEFAULT_KEY_SIGNATURE_IDS,
  intervals: DEFAULT_INTERVAL_KEYS,
  questionsPerRound: 20,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

/**
 * Every list must end up non-empty: a round with no clefs or no intervals has
 * no questions in it, so an empty selection falls back to the default rather
 * than producing a broken round.
 */
function parseSettings(value: unknown): IntervalReadingSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const keySignatures = stringArray(raw.keySignatures)?.filter(isKeySignatureId) ?? []
  const intervals =
    stringArray(raw.intervals)?.filter((key) => CATALOG_KEYS.includes(key)) ?? []
  const questions = raw.questionsPerRound

  return {
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    keySignatures:
      keySignatures.length > 0 ? keySignatures : DEFAULT_SETTINGS.keySignatures,
    intervals: intervals.length > 0 ? intervals : DEFAULT_SETTINGS.intervals,
    questionsPerRound:
      typeof questions === 'number' && ROUND_LENGTHS.includes(questions as 10 | 20 | 30)
        ? questions
        : DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const INTERVAL_READING_SETTINGS: SettingSpec<IntervalReadingSettings> = {
  key: 'exercise:intervals/reading',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}
