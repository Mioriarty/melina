import type { SettingSpec } from '@/lib/db/settings'
import {
  CHORD_QUALITIES,
  chordSize,
  isChordQuality,
  type ChordQuality,
} from '@/lib/music/chord'
import { isClefId, type ClefId } from '@/lib/music/clef'
import {
  DEFAULT_PLAY_DIRECTIONS,
  isPlayDirection,
  type PlayDirection,
} from '@/lib/music/direction'
import { NATURAL_TONIC_KEYS, TONIC_KEYS, isTonicKey } from '@/lib/music/scale'

/**
 * What a chord question may be, for all three exercises at once.
 *
 * Reading, hearing and writing ask about the same thing and differ only in
 * which end they are read from, so what they may be asked about is one thing
 * said once — the same move thoroughbass makes for its two directions. Only the
 * Dexie key differs, which is what `chordSettings` below is for.
 *
 * **Five axes and no more**, which is what lets every level move exactly one of
 * them: which qualities, which inversions, whether the Lage is asked, which
 * roots, and which clefs. Direction is a sixth and belongs to hearing, but it
 * is stored for all three because a reading question is still playable once its
 * answer is out.
 */
export interface ChordSettings {
  qualities: readonly ChordQuality[]
  /** Which members may stand in the bass: 0 root, 1 third, 2 fifth, 3 seventh. */
  inversions: readonly number[]
  /**
   * Whether the Lage — which member stands on top — is part of the answer.
   *
   * A boolean rather than a list, because it is one question: with it off every
   * chord is stacked straight up from its bass and the row is not asked at all,
   * and with it on every Lage the chord has is fair game. A list would let a
   * level offer exactly one, which is a row with one key on it.
   */
  lage: boolean
  /** Roots the chord may be built on, as tonic keys: `C`, `Eb`, `F#`. */
  roots: readonly string[]
  clefs: readonly ClefId[]
  /**
   * How the chord is sounded. `harmonic` is a block chord and the other two are
   * arpeggios — the same three `PlayDirection` already names for an interval,
   * reused whole rather than restated, translations included.
   *
   * It is a level axis rather than a control on the round screen, because it is
   * a real difficulty: a block chord is harder to take apart than the same
   * notes played one after another, and choosing it mid-question would be
   * choosing how hard the question is after seeing it.
   */
  directions: readonly PlayDirection[]
  questionsPerRound: number
}

export const ROUND_LENGTHS = [10, 20, 30] as const

/** Every inversion any quality in the vocabulary has. */
export const INVERSION_CHOICES: readonly number[] = [0, 1, 2, 3]

export const QUALITY_CHOICES: readonly ChordQuality[] = CHORD_QUALITIES

export const ROOT_CHOICES: readonly string[] = TONIC_KEYS

/** The white notes: enough to be real, and no accidental to read past. */
export const DEFAULT_ROOTS: readonly string[] = NATURAL_TONIC_KEYS

export const DEFAULT_SETTINGS: ChordSettings = {
  qualities: ['major', 'minor'],
  inversions: [0],
  lage: false,
  roots: DEFAULT_ROOTS,
  clefs: ['treble'],
  directions: DEFAULT_PLAY_DIRECTIONS,
  questionsPerRound: 10,
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined
}

function numberArray(value: unknown): number[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
    ? value
    : undefined
}

/**
 * Never trust a stored value. A quality that no longer exists, a clef that
 * does not, an inversion no chord has — all fall back rather than generating a
 * round of nothing.
 *
 * An inversion is filtered against the **largest** chord in the vocabulary
 * rather than against each quality: a level offering the third inversion and
 * triads is not wrong, it simply has no third inversion of a triad to draw,
 * and the generator narrows per quality where it actually matters.
 */
export function parseChordSettings(value: unknown): ChordSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>

  const qualities = (stringArray(raw.qualities) ?? []).filter(isChordQuality)
  const widest = Math.max(...CHORD_QUALITIES.map(chordSize))
  const inversions = (numberArray(raw.inversions) ?? []).filter(
    (inversion) => Number.isInteger(inversion) && inversion >= 0 && inversion < widest,
  )
  const roots = (stringArray(raw.roots) ?? []).filter(isTonicKey)
  const clefs = (stringArray(raw.clefs) ?? []).filter(isClefId)
  const directions = (stringArray(raw.directions) ?? []).filter(isPlayDirection)
  const questions = raw.questionsPerRound

  return {
    qualities: qualities.length > 0 ? qualities : DEFAULT_SETTINGS.qualities,
    inversions: inversions.length > 0 ? inversions : DEFAULT_SETTINGS.inversions,
    lage: typeof raw.lage === 'boolean' ? raw.lage : DEFAULT_SETTINGS.lage,
    roots: roots.length > 0 ? roots : DEFAULT_SETTINGS.roots,
    clefs: clefs.length > 0 ? clefs : DEFAULT_SETTINGS.clefs,
    directions: directions.length > 0 ? directions : DEFAULT_SETTINGS.directions,
    questionsPerRound:
      typeof questions === 'number' &&
      (ROUND_LENGTHS as readonly number[]).includes(questions)
        ? questions
        : DEFAULT_SETTINGS.questionsPerRound,
  }
}

/** The same settings under one exercise's own key. */
export function chordSettings(key: string): SettingSpec<ChordSettings> {
  return { key, fallback: DEFAULT_SETTINGS, parse: parseChordSettings }
}
