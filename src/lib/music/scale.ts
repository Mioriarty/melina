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
 * The scales melina asks about: the seven diatonic modes, and the two minor
 * scales that are not modes of anything.
 *
 * A scale is stored as the interval from its tonic to each degree, not as a
 * list of semitones: that is what makes the spelling come out right. Dorian
 * on B flat has to be B♭ C D♭ E♭ F G A♭, never B♭ C C♯ D♯ …, and the only
 * way to guarantee it is to walk the letters and let `transpose` work out
 * each accidental. Harmonic minor needed nothing new for exactly that reason
 * — an augmented second between its sixth and seventh is what two stored
 * intervals already say, and E♭ harmonic minor comes out C♭ D♮ rather than
 * B♮ D♮ without anyone tabulating it.
 *
 * Names are translated — a mode is "dorisch" in German — so nothing here
 * carries a display string. See `useMusicNames`.
 */

export type ModeId =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'harmonicMinor'
  | 'melodicMinor'

/**
 * In degree order: each mode starts on the next step of the major scale.
 * Fixed, so a mode always occupies the same key on the scale keyboard.
 */
export const DIATONIC_MODE_IDS: readonly ModeId[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
]

/**
 * The two minor scales that are **not** rotations of the major scale.
 *
 * Everything else here is one set of seven notes read from a different
 * starting point; these two raise a degree that no rotation raises, which is
 * why they have no degree of a major scale to begin on and no key signature
 * of their own. They are still scales in exactly the sense this file means —
 * an interval from the tonic to each degree — so nothing below had to learn
 * about them.
 *
 * They come after the seven so a mode never changes its place on the
 * keyboard.
 */
export const MINOR_SCALE_IDS: readonly ModeId[] = ['harmonicMinor', 'melodicMinor']

export const MODE_IDS: readonly ModeId[] = [...DIATONIC_MODE_IDS, ...MINOR_SCALE_IDS]

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
  // Aeolian with the seventh raised to a leading note. The augmented second
  // between the sixth and the seventh is what these two rows say, and it is
  // the sound the scale is known by.
  harmonicMinor: ['perfect', 'major', 'minor', 'perfect', 'perfect', 'minor', 'major'],
  // Aeolian with the sixth raised as well, so the leading note is reached by
  // a step. Going *down* that is not this scale at all — see
  // `ASCENDING_ONLY_MODE_IDS`.
  melodicMinor: ['perfect', 'major', 'minor', 'perfect', 'perfect', 'major', 'major'],
}

export interface ModeDef {
  id: ModeId
  /**
   * Which degree of the major scale the mode begins on. Ionian is 1.
   *
   * Absent for a scale that is not a rotation of the major scale: harmonic
   * and melodic minor raise a degree no rotation raises, so there is no
   * degree they could be said to begin on.
   */
  degree?: number
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

export const MODES: readonly ModeDef[] = MODE_IDS.map((id) => {
  const degree = DIATONIC_MODE_IDS.indexOf(id)
  return degree === -1
    ? { id, intervals: modeIntervals(id) }
    : { id, degree: degree + 1, intervals: modeIntervals(id) }
})

export const DEFAULT_MODE_IDS: readonly ModeId[] = MODE_IDS

export function getMode(id: ModeId): ModeDef {
  const mode = MODES.find((entry) => entry.id === id)
  if (mode === undefined) throw new Error(`unknown mode: ${id}`)
  return mode
}

export function isModeId(value: string): value is ModeId {
  return MODE_IDS.includes(value as ModeId)
}

/**
 * The scales that only exist going up.
 *
 * Melodic minor raises its sixth and seventh on the way to the tonic and
 * lowers them again coming down — descending, it *is* the natural minor. So
 * there are only two things a descending melodic minor could be, and both are
 * wrong: played with the raised degrees it is a scale no classical ear calls
 * melodic minor, and played the way the convention says it is aeolian note for
 * note, which is a question with two right answers. It is therefore only ever
 * asked ascending, and only ever as a *scale*: a melody in it would fall as
 * readily as it rises, and the app has no way to spell the difference.
 *
 * A fact about the music, so it lives here rather than in whichever exercise
 * would otherwise have had to know it.
 */
export const ASCENDING_ONLY_MODE_IDS: readonly ModeId[] = ['melodicMinor']

export function isAscendingOnly(mode: ModeId): boolean {
  return ASCENDING_ONLY_MODE_IDS.includes(mode)
}

/**
 * The scales a *melody* may be written in — everything but the ascending-only
 * ones.
 *
 * Scale reading and scale hearing ask about a scale, which is a run in one
 * direction and may be melodic minor. Scale degrees and melodic dictation
 * establish a key and then wander about inside it, which melodic minor cannot
 * be: its sixth and seventh depend on where the line is going.
 */
export const MELODY_MODE_IDS: readonly ModeId[] = MODE_IDS.filter(
  (mode) => !isAscendingOnly(mode),
)

export function isMelodyModeId(value: string): value is ModeId {
  return isModeId(value) && !isAscendingOnly(value)
}

/**
 * The mode whose key signature a scale is written under.
 *
 * Itself for a diatonic mode, which is a rotation of some major scale and so
 * has a signature of its own. Harmonic and melodic minor have none — no
 * signature raises a seventh — and are written the way they have always been
 * written: under the natural minor's signature, with the raised degrees
 * printed in front of the notes that carry them. That is not a fallback but
 * the notation, and it is why `keySignatureFor` asks this rather than hunting
 * for a signature that cannot exist.
 */
const SIGNATURE_MODES: Partial<Record<ModeId, ModeId>> = {
  harmonicMinor: 'aeolian',
  melodicMinor: 'aeolian',
}

export function signatureMode(mode: ModeId): ModeId {
  return SIGNATURE_MODES[mode] ?? mode
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
 *
 * The scale it is *written under* has to spell too, and that is not the same
 * question for harmonic and melodic minor. D♭ melodic minor is perfectly
 * spellable — raising the sixth is what turns B double flat into B♭ — but the
 * natural minor it is an alteration of is not, so there is no key for it to
 * be in and no signature to print it under. D♭ minor is not a key anybody
 * writes; C♯ minor is. For a diatonic mode `signatureMode` is the mode
 * itself, so this asks nothing new of the seven.
 */
export function isCleanScale(tonic: PitchClass, mode: ModeId): boolean {
  return [mode, signatureMode(mode)].every((id) => spellsCleanly(tonic, id))
}

function spellsCleanly(tonic: PitchClass, mode: ModeId): boolean {
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
