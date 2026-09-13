import type { SettingSpec } from '@/lib/db/settings'
import { KEY_KEYS, isKeyKey } from '@/lib/music/key'
import { BLOCKS, isSatztechnikId, type SatztechnikId } from '@/lib/music/satzmodell'

/**
 * What a harmony round is made of.
 *
 * The Satztechniken are named **one by one** rather than by family, because
 * that is what makes a level a weakness rather than a rung: "Trugschluss only"
 * and "Quintfallsequenz only" are real things to practise, and a setting that
 * offered "cadences" as a single switch could not express either.
 */

export interface HarmonySettings {
  /** Keys, as `Eb:aeolian`. */
  keys: readonly string[]
  /** How many chords a progression comes to. */
  chords: readonly number[]
  cadences: readonly string[]
  blocks: readonly string[]
  freedom: Freedom
  /** Whether a cadence is played first to fix the key. */
  establish: boolean
  tempo: number
  questionsPerRound: number
}

/**
 * How much of a progression is a named Satzmodell and how much is a plain
 * walk.
 *
 * Not every progression should be a textbook example — a diet of nothing but
 * schemas is a poor ear-training diet, and real music is mostly ordinary
 * chords going somewhere. What makes the walk honest rather than arbitrary is
 * that it runs backwards from the cadence through the same table the blocks
 * join by, so it arrives somewhere; and that the analysis records `frei` for
 * what it produced rather than claiming a technique.
 */
export const FREEDOMS = ['strict', 'mixed', 'free'] as const
export type Freedom = (typeof FREEDOMS)[number]

export const FREE_WEIGHTS: Readonly<Record<Freedom, number>> = {
  strict: 0,
  mixed: 1,
  free: 6,
}

export function isFreedom(value: string): value is Freedom {
  return FREEDOMS.includes(value as Freedom)
}

export const CHORD_COUNTS: readonly number[] = [4, 5, 6, 7, 8]
export const ROUND_LENGTHS = [6, 10, 15] as const
export const TEMPOS: readonly number[] = [56, 72, 88]

export const CADENCE_CHOICES: readonly SatztechnikId[] = BLOCKS.filter(
  (block) => block.kind === 'cadence',
).map((block) => block.id)

export const BLOCK_CHOICES: readonly SatztechnikId[] = BLOCKS.filter(
  (block) => block.kind !== 'cadence' && block.kind !== 'opening',
).map((block) => block.id)

/** Major keys with at most three accidentals, which is where a beginner starts. */
export const DEFAULT_KEYS: readonly string[] = [
  'C:ionian',
  'G:ionian',
  'F:ionian',
  'D:ionian',
  'A:aeolian',
  'E:aeolian',
]

export const DEFAULT_SETTINGS: HarmonySettings = {
  keys: DEFAULT_KEYS,
  chords: [6],
  cadences: ['ganzschluss-vollkommen', 'halbschluss', 'trugschluss'],
  blocks: ['tonika-prolongation', 'zwischendominante', 'quintfall'],
  freedom: 'mixed',
  establish: true,
  tempo: 72,
  questionsPerRound: 6,
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []
}

function numberArray(value: unknown): readonly number[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'number') : []
}

/**
 * Defensive, like every other settings parser here: a list that comes back
 * empty falls back to the default rather than producing a round with nothing
 * in it, and an unknown id is dropped rather than reaching the generator.
 */
export function parseHarmonySettings(value: unknown): HarmonySettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const keys = stringArray(raw.keys).filter(isKeyKey)
  const chords = numberArray(raw.chords).filter((count) => CHORD_COUNTS.includes(count))
  const cadences = stringArray(raw.cadences).filter(
    (id) => isSatztechnikId(id) && CADENCE_CHOICES.includes(id as SatztechnikId),
  )
  const blocks = stringArray(raw.blocks).filter(
    (id) => isSatztechnikId(id) && BLOCK_CHOICES.includes(id as SatztechnikId),
  )

  const freedom =
    typeof raw.freedom === 'string' && isFreedom(raw.freedom) ? raw.freedom : undefined
  const tempo =
    typeof raw.tempo === 'number' && TEMPOS.includes(raw.tempo) ? raw.tempo : undefined
  const questions =
    typeof raw.questionsPerRound === 'number' &&
    (ROUND_LENGTHS as readonly number[]).includes(raw.questionsPerRound)
      ? raw.questionsPerRound
      : undefined

  return {
    keys: keys.length > 0 ? keys : DEFAULT_SETTINGS.keys,
    chords: chords.length > 0 ? chords : DEFAULT_SETTINGS.chords,
    cadences: cadences.length > 0 ? cadences : DEFAULT_SETTINGS.cadences,
    // Blocks may legitimately be empty: that is a level of nothing but
    // cadences and free motion, which is the easiest level there is.
    blocks,
    freedom: freedom ?? DEFAULT_SETTINGS.freedom,
    establish:
      typeof raw.establish === 'boolean' ? raw.establish : DEFAULT_SETTINGS.establish,
    tempo: tempo ?? DEFAULT_SETTINGS.tempo,
    questionsPerRound: questions ?? DEFAULT_SETTINGS.questionsPerRound,
  }
}

export function harmonySettings(key: string): SettingSpec<HarmonySettings> {
  return { key, fallback: DEFAULT_SETTINGS, parse: parseHarmonySettings }
}

export const ALL_KEY_CHOICES: readonly string[] = KEY_KEYS
