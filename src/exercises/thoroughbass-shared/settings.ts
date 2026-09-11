import type { SettingSpec } from '@/lib/db/settings'
import { parseFigureKey } from '@/lib/music/figuredBass'
import {
  KEY_SIGNATURES,
  isKeySignatureId,
  type KeySignatureId,
} from '@/lib/music/keySignature'

/**
 * What a thoroughbass question may be, for both directions at once.
 *
 * The two exercises are mirror images — one writes the figure and the other
 * writes the chord — so what they may be asked about is the same thing said
 * once. Only the Dexie key differs, which is what `thoroughbassSettings` below
 * is for.
 *
 * **Four axes and no more**, which is what lets every level move exactly one of
 * them: which figures, which suspensions, which keys, and how many bass notes.
 *
 * Suspensions are their own axis rather than more figures, because they are:
 * a suspension is two figures under one bass note, which is span rather than
 * vocabulary.
 */
export interface ThoroughbassSettings {
  keySignatures: readonly KeySignatureId[]
  /** The figures this level asks about, as stored keys: `''`, `6`, `6/4`, `#3`. */
  figures: readonly string[]
  /** Suspensions, as the pair of figures they are written with: `4-3`. */
  suspensions: readonly string[]
  /** Bass notes per question. One is a single chord. */
  events: number
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const

/**
 * The figures the app teaches, in the order it teaches them.
 *
 * Triads, then the accidental that alters a third, then the sevenths. The bare
 * accidental sits with the triads rather than off with the altered figures
 * because that is where it belongs: `♯` under a bass note is the raised third
 * of a dominant in a minor key, which is about the commonest figure in the
 * repertoire after `6`.
 *
 * **Every one of them is the canonical spelling**, because that is what a
 * question stores and therefore what a level's accuracy filter matches on.
 */
export const FIGURE_CHOICES: readonly string[] = [
  // The everyday ones: triads, the sign that alters a third, the sevenths.
  '',
  '6',
  '6/4',
  '#3',
  'b3',
  'n3',
  '7',
  '6/5',
  '4/3',
  '2',
  // And the rest — a line moved out of the key, and the ninths. Every one of
  // them is still only an accidental on a stack that already existed, apart
  // from the two ninths, which is why the vocabulary grew this far without the
  // model growing with it.
  '#6',
  'b6',
  '6/#4',
  '6/b5',
  '#5',
  'b5',
  '#6/b5',
  '#6/4/3',
  '9',
  '9/7',
]

/**
 * The suspensions the app teaches, written as the pair they are figured with.
 *
 * **2–3 is deliberately absent.** It is the one suspension in which the *bass*
 * is the dissonance and resolves downward, so it cannot be written under a
 * single held bass note — it needs a bass that moves, which is a bass line and
 * not a suspension. Leaving it out is honest; faking it with a stationary bass
 * would teach the wrong thing.
 */
export const SUSPENSION_CHOICES: readonly string[] = ['4-3', '7-6', '9-8', '6-5']

export const KEY_SIGNATURE_CHOICES: readonly KeySignatureId[] = KEY_SIGNATURES.map(
  (signature) => signature.id,
)

/** Keys with at most one accidental: enough to be real, few enough to read. */
export const DEFAULT_KEY_SIGNATURES: readonly KeySignatureId[] = ['0', '1s', '1f']

export const DEFAULT_SETTINGS: ThoroughbassSettings = {
  keySignatures: DEFAULT_KEY_SIGNATURES,
  figures: ['', '6', '6/4'],
  suspensions: [],
  events: 1,
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

/**
 * Never trust a stored value. A figure key that no longer parses, a key
 * signature that no longer exists, and an empty list after filtering all fall
 * back rather than generating a round of nothing.
 */
export function parseThoroughbassSettings(
  value: unknown,
): ThoroughbassSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const keySignatures = (stringArray(raw.keySignatures) ?? []).filter(isKeySignatureId)
  const figures = (stringArray(raw.figures) ?? []).filter(
    (key) => parseFigureKey(key) !== undefined && FIGURE_CHOICES.includes(key),
  )
  const suspensions = (stringArray(raw.suspensions) ?? []).filter((key) =>
    SUSPENSION_CHOICES.includes(key),
  )
  const events =
    typeof raw.events === 'number' && Number.isInteger(raw.events) && raw.events >= 1
      ? raw.events
      : DEFAULT_SETTINGS.events

  return {
    keySignatures:
      keySignatures.length > 0 ? keySignatures : DEFAULT_SETTINGS.keySignatures,
    // A level may be nothing but suspensions, so an empty figure list is only
    // replaced by the default when there is nothing else to ask either.
    figures:
      figures.length > 0 || suspensions.length > 0 ? figures : DEFAULT_SETTINGS.figures,
    suspensions,
    events,
    questionsPerRound:
      oneOf(raw.questionsPerRound, ROUND_LENGTHS) ?? DEFAULT_SETTINGS.questionsPerRound,
  }
}

/** The same settings under one exercise's own key. */
export function thoroughbassSettings(key: string): SettingSpec<ThoroughbassSettings> {
  return { key, fallback: DEFAULT_SETTINGS, parse: parseThoroughbassSettings }
}
