import type { SettingSpec } from '@/lib/db/settings'
import { DEFAULT_CLEF_IDS, isClefId, type ClefId } from '@/lib/music/clef'
import { degreeKey, parseDegreeKey, stepRange } from '@/lib/music/degree'
import {
  DEFAULT_TONIC_KEYS,
  isMelodyModeId,
  isTonicKey,
  type ModeId,
} from '@/lib/music/scale'

/**
 * What the player is allowed to be asked.
 *
 * `degrees` is a level axis of its own: the first five degrees are a different
 * exercise from all seven, and hearing the third against the fifth is where
 * this starts. `alterations` is the other — a note from outside the key is a
 * different kind of listening, and switching it on also puts the two accidental
 * keys on the keyboard.
 */
export interface DegreeSettings {
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  clefs: readonly ClefId[]
  /** Which steps may appear, as degree keys with their octave (`7_`, `1`, `1'`). */
  degrees: readonly string[]
  alterations: boolean
  melodyLength: number
  startOnTonic: boolean
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const

/**
 * Every step a level may offer: the fifth below the tonic up to its octave.
 *
 * Far enough down for a melody to dip under its tonic to the leading note or
 * the sixth beneath, which is where tunes actually go; any wider and the
 * keyboard would outgrow a phone.
 */
export const DEGREE_STEP_CHOICES: readonly string[] = stepRange(
  { number: 5, alteration: 0, octave: -1 },
  { number: 1, alteration: 0, octave: 1 },
).map(degreeKey)

/**
 * A stored step, or `undefined`. A plain number is a step in the tonic's own
 * octave, which is how settings were stored before steps carried one.
 */
function parseStep(value: unknown): string | undefined {
  const key = typeof value === 'number' ? String(value) : value
  if (typeof key !== 'string') return undefined
  const step = parseDegreeKey(key)
  if (step === undefined || step.alteration !== 0) return undefined
  const canonical = degreeKey(step)
  return DEGREE_STEP_CHOICES.includes(canonical) ? canonical : undefined
}
export const MELODY_LENGTHS = [2, 3, 4, 5, 6] as const

/** Major and minor. The other five are offered, but they are not the point. */
export const DEFAULT_MODES: readonly ModeId[] = ['ionian', 'aeolian']

export const DEFAULT_SETTINGS: DegreeSettings = {
  modes: DEFAULT_MODES,
  tonics: DEFAULT_TONIC_KEYS,
  clefs: ['treble'],
  degrees: ['1', '2', '3', '4', '5'],
  alterations: false,
  melodyLength: 3,
  startOnTonic: false,
  questionsPerRound: 10,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

function oneOf<T extends number>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'number' && allowed.includes(value as T)
    ? (value as T)
    : undefined
}

function parseSettings(value: unknown): DegreeSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  // Melodic minor is not a key a melody can be written in — see
  // `allowedModes` — so a stored setting naming it falls away here.
  const modes = stringArray(raw.modes)?.filter(isMelodyModeId) ?? []
  const tonics = stringArray(raw.tonics)?.filter(isTonicKey) ?? []
  const clefs = stringArray(raw.clefs)?.filter(isClefId) ?? []
  const degrees = Array.isArray(raw.degrees)
    ? DEGREE_STEP_CHOICES.filter((choice) =>
        (raw.degrees as unknown[]).some((value) => parseStep(value) === choice),
      )
    : []

  return {
    modes: modes.length > 0 ? modes : DEFAULT_SETTINGS.modes,
    tonics: tonics.length > 0 ? tonics : DEFAULT_SETTINGS.tonics,
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    degrees: degrees.length > 0 ? degrees : DEFAULT_SETTINGS.degrees,
    alterations:
      typeof raw.alterations === 'boolean'
        ? raw.alterations
        : DEFAULT_SETTINGS.alterations,
    melodyLength:
      oneOf(raw.melodyLength, MELODY_LENGTHS) ?? DEFAULT_SETTINGS.melodyLength,
    startOnTonic:
      typeof raw.startOnTonic === 'boolean'
        ? raw.startOnTonic
        : DEFAULT_SETTINGS.startOnTonic,
    questionsPerRound:
      oneOf(raw.questionsPerRound, ROUND_LENGTHS) ?? DEFAULT_SETTINGS.questionsPerRound,
  }
}

export const DEGREE_SETTINGS: SettingSpec<DegreeSettings> = {
  key: 'exercise:scales/degrees',
  fallback: DEFAULT_SETTINGS,
  parse: parseSettings,
}

export { DEFAULT_CLEF_IDS }
