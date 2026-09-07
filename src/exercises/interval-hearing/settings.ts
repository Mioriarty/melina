import {
  DEFAULT_INSTRUMENT,
  isInstrumentId,
  type InstrumentId,
} from '@/lib/audio/instruments'
import { HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'
import { DEFAULT_CLEF_IDS, isClefId, type ClefId } from '@/lib/music/clef'
import {
  DEFAULT_PLAY_DIRECTIONS,
  isPlayDirection,
  type PlayDirection,
} from '@/lib/music/direction'
import {
  DEFAULT_KEY_SIGNATURE_IDS,
  isKeySignatureId,
  type KeySignatureId,
} from '@/lib/music/keySignature'
import type { SettingSpec } from '@/lib/db/settings'

/**
 * What the player is allowed to be asked, and how it should sound.
 *
 * Parsed defensively on the way out of IndexedDB: a stored setting can be
 * stale after the catalog changes, and an unknown clef, interval or
 * instrument must degrade to the default rather than producing a question
 * that cannot be asked or an instrument that cannot be loaded.
 *
 * Intervals are restricted to the *hearable* set — see
 * `HEARABLE_INTERVAL_KEYS`. Spelling is inaudible, so offering two names for
 * the same sound would make a question unanswerable.
 */
export interface IntervalHearingSettings {
  clefs: readonly ClefId[]
  keySignatures: readonly KeySignatureId[]
  /** Interval keys, e.g. `P5`. */
  intervals: readonly string[]
  /** Keep both notes on the staff, with no ledger lines. */
  staffOnly: boolean
  directions: readonly PlayDirection[]
  instrument: InstrumentId
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const

export const DEFAULT_SETTINGS: IntervalHearingSettings = {
  clefs: DEFAULT_CLEF_IDS,
  keySignatures: DEFAULT_KEY_SIGNATURE_IDS,
  intervals: HEARABLE_INTERVAL_KEYS,
  staffOnly: false,
  directions: DEFAULT_PLAY_DIRECTIONS,
  instrument: DEFAULT_INSTRUMENT,
  questionsPerRound: 20,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

/**
 * Every list must end up non-empty: a round with no clefs, intervals or
 * directions has no questions in it, so an empty selection falls back to the
 * default rather than producing a broken round.
 */
function parseSettings(value: unknown): IntervalHearingSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const keySignatures = stringArray(raw.keySignatures)?.filter(isKeySignatureId) ?? []
  // Filtered against the hearable set, not the full catalog: a stored
  // augmented second would be indistinguishable from a minor third, and a
  // setting saved before this rule existed must not reintroduce one.
  const intervals =
    stringArray(raw.intervals)?.filter((key) => HEARABLE_INTERVAL_KEYS.includes(key)) ??
    []
  const directions = stringArray(raw.directions)?.filter(isPlayDirection) ?? []
  const instrument = raw.instrument
  const questions = raw.questionsPerRound
  const staffOnly = raw.staffOnly

  return {
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    keySignatures:
      keySignatures.length > 0 ? keySignatures : DEFAULT_SETTINGS.keySignatures,
    intervals: intervals.length > 0 ? intervals : DEFAULT_SETTINGS.intervals,
    directions: directions.length > 0 ? directions : DEFAULT_SETTINGS.directions,
    instrument:
      typeof instrument === 'string' && isInstrumentId(instrument)
        ? instrument
        : DEFAULT_SETTINGS.instrument,
    staffOnly: typeof staffOnly === 'boolean' ? staffOnly : DEFAULT_SETTINGS.staffOnly,
    questionsPerRound:
      typeof questions === 'number' && ROUND_LENGTHS.includes(questions as 10 | 20 | 30)
        ? questions
        : DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const INTERVAL_HEARING_SETTINGS: SettingSpec<IntervalHearingSettings> = {
  key: 'exercise:intervals/hearing',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}
