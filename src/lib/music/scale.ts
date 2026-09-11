import { transpose, type Interval, type IntervalQuality } from './interval'
import {
  LETTERS,
  chromaticValue,
  diatonicValue,
  type Alteration,
  type Letter,
  type Pitch,
} from './pitch'

/**
 * The seven diatonic modes, and the scales built from them.
 *
 * A mode is stored as the interval from its tonic to each degree, not as a
 * list of semitones: that is what makes the spelling come out right. Dorian
 * on B flat has to be B♭ C D♭ E♭ F G A♭, never B♭ C C♯ D♯ …, and the only
 * way to guarantee it is to walk the letters and let `transpose` work out
 * each accidental.
 *
 * Names are translated — a mode is "dorisch" in German — so nothing here
 * carries a display string. See `useMusicNames`.
 */

export type ModeId =
  'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'

/**
 * In degree order: each mode starts on the next step of the major scale.
 * Fixed, so a mode always occupies the same key on the scale keyboard.
 */
export const MODE_IDS: readonly ModeId[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
]

/**
 * The quality of each scale degree, from the tonic. The eighth degree is the
 * octave in every mode and is added by `modeIntervals`, so only seven are
 * spelled out here.
 */
const DEGREE_QUALITIES: Record<ModeId, readonly IntervalQuality[]> = {
  ionian: ['perfect', 'major', 'major', 'perfect', 'perfect', 'major', 'major'],
  dorian: ['perfect', 'major', 'minor', 'perfect', 'perfect', 'major', 'minor'],
  phrygian: ['perfect', 'minor', 'minor', 'perfect', 'perfect', 'minor', 'minor'],
  lydian: ['perfect', 'major', 'major', 'augmented', 'perfect', 'major', 'major'],
  mixolydian: ['perfect', 'major', 'major', 'perfect', 'perfect', 'major', 'minor'],
  aeolian: ['perfect', 'major', 'minor', 'perfect', 'perfect', 'minor', 'minor'],
  locrian: ['perfect', 'minor', 'minor', 'perfect', 'diminished', 'minor', 'minor'],
}

export interface ModeDef {
  id: ModeId
  /** Which degree of the major scale the mode begins on. Ionian is 1. */
  degree: number
  /** Tonic to each degree, unison first and octave last: eight in all. */
  intervals: readonly Interval[]
}

function modeIntervals(id: ModeId): readonly Interval[] {
  const degrees = DEGREE_QUALITIES[id].map((quality, index) => ({
    number: index + 1,
    quality,
  }))
  return [...degrees, { number: 8, quality: 'perfect' }]
}

export const MODES: readonly ModeDef[] = MODE_IDS.map((id, index) => ({
  id,
  degree: index + 1,
  intervals: modeIntervals(id),
}))

export const DEFAULT_MODE_IDS: readonly ModeId[] = MODE_IDS

export function getMode(id: ModeId): ModeDef {
  const mode = MODES.find((entry) => entry.id === id)
  if (mode === undefined) throw new Error(`unknown mode: ${id}`)
  return mode
}

export function isModeId(value: string): value is ModeId {
  return MODE_IDS.includes(value as ModeId)
}

/* ---------------------------------------------------------------- scales */

/**
 * The eight pitches of a mode on a given tonic, ascending, closing on the
 * octave.
 *
 * `undefined` when the spelling runs past a double accidental — G♯ lydian
 * would need F triple sharp — which is the caller's cue to pick another
 * tonic rather than to print something no one would write.
 */
export function scalePitches(tonic: Pitch, mode: ModeId): readonly Pitch[] | undefined {
  const pitches: Pitch[] = []

  for (const interval of getMode(mode).intervals) {
    const degree = transpose(tonic, interval, 'up')
    if (degree === undefined) return undefined
    pitches.push(degree)
  }

  return pitches
}

/**
 * Which mode a run of pitches spells, if any.
 *
 * The inverse of `scalePitches`, and the reason the generator can be checked
 * rather than trusted: a question's notes must spell the mode it claims.
 */
export function modeOf(pitches: readonly Pitch[]): ModeId | undefined {
  const tonic = pitches[0]
  if (tonic === undefined || pitches.length !== 8) return undefined

  return MODE_IDS.find((id) => {
    const expected = scalePitches(tonic, id)
    if (expected === undefined) return false
    return expected.every((pitch, index) => {
      const actual = pitches[index]
      return (
        actual !== undefined &&
        actual.letter === pitch.letter &&
        actual.alteration === pitch.alteration &&
        actual.octave === pitch.octave
      )
    })
  })
}

/* ---------------------------------------------------------------- tonics */

/**
 * A tonic without an octave: the scale exercise cares which letter and
 * accidental a scale is built on, and lets the clef decide where it sits.
 */
export interface PitchClass {
  letter: Letter
  alteration: Alteration
}

/**
 * Whether two sets of notes are the same notes, however they are ordered.
 *
 * Lives here beside `PitchClass` rather than with either of the things that
 * needs it: a figured bass grades a realisation this way and chord writing
 * grades a written chord the same way, and two copies of "the same notes" is
 * two answers that could disagree.
 */
export function sameNotes(a: readonly PitchClass[], b: readonly PitchClass[]): boolean {
  if (a.length !== b.length) return false
  const keys = new Set(a.map(tonicKey))
  return keys.size === a.length && b.every((note) => keys.has(tonicKey(note)))
}

/** Machine form, matching `pitchKey` without the octave: `Bb`, `F#`, `C`. */
export function tonicKey({ letter, alteration }: PitchClass): string {
  const symbol = alteration < 0 ? 'b'.repeat(-alteration) : '#'.repeat(alteration)
  return `${letter}${symbol}`
}

const TONIC_PATTERN = /^([A-G])(bb|b|#|##|)$/

export function parseTonicKey(key: string): PitchClass | undefined {
  const match = TONIC_PATTERN.exec(key.trim())
  const letter = match?.[1]
  const symbol = match?.[2]
  if (letter === undefined || symbol === undefined) return undefined

  const alteration = symbol.startsWith('b') ? -symbol.length : symbol.length
  return { letter: letter as Letter, alteration: alteration as Alteration }
}

/**
 * The tonics the exercise offers, ordered by how far round the circle of
 * fifths they sit.
 *
 * Only naturals and single accidentals: the staff is deliberately keyless, so
 * every alteration is printed, and a scale on G♭ or A♯ is six or seven
 * accidentals in eight notes — a reading of the accidentals rather than of
 * the mode. Which of these actually work for a given mode is not fixed here,
 * because it depends on the mode: `cleanTonics` answers that.
 */
export const TONIC_CHOICES: readonly PitchClass[] = [
  { letter: 'C', alteration: 0 },
  { letter: 'G', alteration: 0 },
  { letter: 'D', alteration: 0 },
  { letter: 'A', alteration: 0 },
  { letter: 'E', alteration: 0 },
  { letter: 'B', alteration: 0 },
  { letter: 'F', alteration: 0 },
  { letter: 'B', alteration: -1 },
  { letter: 'E', alteration: -1 },
  { letter: 'A', alteration: -1 },
  { letter: 'D', alteration: -1 },
  { letter: 'F', alteration: 1 },
  { letter: 'C', alteration: 1 },
]

export const TONIC_KEYS: readonly string[] = TONIC_CHOICES.map(tonicKey)

export const NATURAL_TONIC_KEYS: readonly string[] = TONIC_CHOICES.filter(
  (tonic) => tonic.alteration === 0,
).map(tonicKey)

export const DEFAULT_TONIC_KEYS: readonly string[] = [
  ...NATURAL_TONIC_KEYS,
  'Bb',
  'Eb',
  'F#',
]

export function isTonicKey(value: string): boolean {
  return TONIC_KEYS.includes(value)
}

/**
 * Whether a mode on this tonic spells cleanly — no double accidentals, no
 * spelling `transpose` refuses.
 *
 * B locrian is fine; B♭ locrian needs C♭ and F♭, which is still legal but
 * already rare; A♭ locrian needs B double flat, which is not. Checking the
 * scale itself rather than keeping a hand-written table means a mode can be
 * added without anyone having to work the exceptions out again.
 */
export function isCleanScale(tonic: PitchClass, mode: ModeId): boolean {
  const pitches = scalePitches({ ...tonic, octave: 4 }, mode)
  if (pitches === undefined) return false
  return pitches.every((pitch) => Math.abs(pitch.alteration) <= 1)
}

/** The offered tonics a mode can actually be spelled on. */
export function cleanTonics(mode: ModeId): readonly PitchClass[] {
  return TONIC_CHOICES.filter((tonic) => isCleanScale(tonic, mode))
}

/**
 * How many accidentals the scale prints on a keyless staff — its reading
 * weight. Every degree that is not natural has to carry a sign.
 */
export function printedAccidentals(tonic: PitchClass, mode: ModeId): number {
  const pitches = scalePitches({ ...tonic, octave: 4 }, mode)
  if (pitches === undefined) return Number.POSITIVE_INFINITY
  // The closing octave repeats the tonic, so it is not counted twice.
  return pitches.slice(0, 7).filter((pitch) => pitch.alteration !== 0).length
}

/**
 * Every octave a scale on this tonic fits into, within a range.
 *
 * The whole scale has to fit — a tonic that sits nicely on the staff is
 * useless if its octave is two ledger lines above it.
 */
export function fittingOctaves(
  tonic: PitchClass,
  mode: ModeId,
  lowest: Pitch,
  highest: Pitch,
): readonly number[] {
  const octaves: number[] = []

  for (let octave = lowest.octave - 1; octave <= highest.octave + 1; octave += 1) {
    const pitches = scalePitches({ ...tonic, octave }, mode)
    if (pitches === undefined) continue

    const fits = pitches.every(
      (pitch) =>
        chromaticValue(pitch) >= chromaticValue(lowest) &&
        chromaticValue(pitch) <= chromaticValue(highest) &&
        diatonicValue(pitch) >= diatonicValue(lowest) &&
        diatonicValue(pitch) <= diatonicValue(highest),
    )
    if (fits) octaves.push(octave)
  }

  return octaves
}

/** Letter names in order from a tonic, for tests and for reading a scale back. */
export function lettersFrom(tonic: Letter): readonly Letter[] {
  const start = LETTERS.indexOf(tonic)
  return LETTERS.map((_, index) => LETTERS[(start + index) % 7] as Letter)
}
