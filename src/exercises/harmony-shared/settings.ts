import type { SettingSpec } from '@/lib/db/settings'
import type { ChordMember } from '@/lib/music/chord'
import { isRuleId, SELECTABLE_RULE_IDS, type RuleId } from '@/lib/music/voiceLeading'
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

/* ------------------------------------------------ writing one down, in four parts */

/**
 * What a four-part writing round is made of.
 *
 * The progression half is `HarmonySettings` unchanged — the same keys, the same
 * cadences, the same Satztechniken — because what is written down is a
 * progression like any other. What is added is the two things only a *writing*
 * exercise has: which Lage the prompt may ask the setting to open in, and which
 * rules the answer is marked against.
 *
 * Here rather than in the exercise folder, because the chorale is the same
 * settings with a longer progression and a soprano given instead of a bass —
 * `chord-shared/settings.ts` holds its three exercises' settings for the same
 * reason.
 */
export interface CadenceSettings extends HarmonySettings {
  /** Which Lagen the opening chord may be asked to stand in. */
  lagen: readonly ChordMember[]
  /** The voice-leading rules an answer is held to. */
  rules: readonly RuleId[]
}

/**
 * The rules a level may name here — every Satzfehler **but the range**.
 *
 * The keyboard offers a voice nothing outside its own compass, so a range fault
 * is not something a player can commit however hard they try. Offering the rule
 * anyway would put a switch on the settings screen that can never change an
 * outcome, which is worse than leaving it out. It stays in the model, where the
 * generator is still held to it.
 */
export const CADENCE_RULE_CHOICES: readonly RuleId[] = SELECTABLE_RULE_IDS.filter(
  (id) => id !== 'range',
)

/**
 * Which Lage a cadence may be asked to open in.
 *
 * The three a written exam names — *"Beginnen Sie in der angegebenen Lage"* —
 * and the three a triad has. A seventh chord could open in Septlage too, but a
 * cadence opens on a triad, and the vocabulary is better kept to what is
 * actually asked for.
 */
export const OPENING_LAGEN: readonly ChordMember[] = ['root', 'third', 'fifth']

export const LAGE_CHOICES: readonly ChordMember[] = OPENING_LAGEN

export const DEFAULT_CADENCE_SETTINGS: CadenceSettings = {
  ...DEFAULT_SETTINGS,
  keys: ['C:ionian', 'G:ionian', 'F:ionian'],
  chords: [4],
  cadences: ['ganzschluss-vollkommen', 'halbschluss'],
  blocks: [],
  freedom: 'mixed',
  // Nothing is heard until the answer is in, so there is no key to establish.
  establish: false,
  lagen: [...OPENING_LAGEN],
  rules: [...CADENCE_RULE_CHOICES],
}

export function parseCadenceSettings(value: unknown): CadenceSettings | undefined {
  const base = parseHarmonySettings(value)
  if (base === undefined) return undefined

  const raw = value as Record<string, unknown>
  const lagen = stringArray(raw.lagen).filter((id): id is ChordMember =>
    (LAGE_CHOICES as readonly string[]).includes(id),
  )
  const rules = stringArray(raw.rules).filter(
    (id): id is RuleId => isRuleId(id) && CADENCE_RULE_CHOICES.includes(id),
  )

  return {
    ...base,
    establish: false,
    lagen: lagen.length > 0 ? lagen : DEFAULT_CADENCE_SETTINGS.lagen,
    // A level with no rules at all is legitimate — it is the one that asks only
    // for the right chords — so an empty list is kept rather than replaced.
    rules,
  }
}

export function cadenceSettings(key: string): SettingSpec<CadenceSettings> {
  return { key, fallback: DEFAULT_CADENCE_SETTINGS, parse: parseCadenceSettings }
}
