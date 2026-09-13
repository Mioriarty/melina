import { keySignatureFor } from './degree'
import type { KeySignatureId } from './keySignature'
import { LETTERS, type Letter, type Pitch } from './pitch'
import {
  isCleanScale,
  parseTonicKey,
  scalePitches,
  tonicKey,
  TONIC_CHOICES,
  type ModeId,
  type PitchClass,
} from './scale'

/**
 * A key — a tonic and a mode.
 *
 * There was no such type before this: every exercise so far asks about a
 * scale, an interval or a chord standing on its own, so the pair
 * `(tonic, mode)` was passed around loose and nothing needed to name it.
 * Harmony does, because **every chord it describes is referred to a key
 * rather than to a pitch** — a `V` is only a `V` of something — and because a
 * key is the unit a progression, a modulation and an attempt-log row are all
 * stored in.
 *
 * **Major and minor only**, for now. The seven modes are all legal `ModeId`s
 * and the field is deliberately the general one, so the modal idiom the UdK
 * Kantionalsatz wants is a table addition rather than a change of shape — but
 * functional harmony is a major/minor subject and nothing here pretends
 * otherwise yet.
 *
 * **Minor is stored as `aeolian`, the natural minor, and the raised degrees
 * come from the chords.** That is not a simplification but the notation: no
 * key signature raises a seventh, so a minor key is written under the natural
 * minor's signature and the leading note is printed in front of the note that
 * carries it — which is exactly what `signatureMode` in `scale.ts` already
 * says, and exactly what falls out here if the dominant is simply *a major
 * triad on the fifth degree*. Storing harmonic minor as the key instead would
 * raise the seventh everywhere, including in the places where the music
 * lowers it again.
 */

export interface Key {
  tonic: PitchClass
  mode: ModeId
}

/** The modes functional harmony is written in. */
export const HARMONY_MODES: readonly ModeId[] = ['ionian', 'aeolian']

export function isHarmonyMode(value: string): boolean {
  return HARMONY_MODES.includes(value as ModeId)
}

export function isMinor(key: Key): boolean {
  return key.mode === 'aeolian'
}

/* ------------------------------------------------------------ stored form

   `Eb:aeolian` — colons because no part contains one, matching `chordKey`. */

export function keyKey(key: Key): string {
  return `${tonicKey(key.tonic)}:${key.mode}`
}

export function parseKeyKey(text: string): Key | undefined {
  const parts = text.trim().split(':')
  if (parts.length !== 2) return undefined
  const [tonic, mode] = parts as [string, string]

  const pitchClass = parseTonicKey(tonic)
  if (pitchClass === undefined || !isHarmonyMode(mode)) return undefined
  return { tonic: pitchClass, mode: mode as ModeId }
}

/* ------------------------------------------------------------- the ladder */

/**
 * The octave the key's own scale is spelled in.
 *
 * Arbitrary and internal: everything this file returns is a `PitchClass`, so
 * the octave only has to be somewhere `transpose` can work. Four is the octave
 * the rest of the app spells scratch pitches in.
 */
const SPELLING_OCTAVE = 4

export function keyPitch(key: Key): Pitch {
  return { ...key.tonic, octave: SPELLING_OCTAVE }
}

/** The seven notes of the key, tonic first. */
export function keyNotes(key: Key): readonly PitchClass[] | undefined {
  const scale = scalePitches(keyPitch(key), key.mode)
  if (scale === undefined) return undefined
  return scale.slice(0, 7).map((note) => ({
    letter: note.letter,
    alteration: note.alteration,
  }))
}

/** The note the key's scale has on a degree. `degree` is 1 to 7. */
export function degreeRoot(key: Key, degree: number): PitchClass | undefined {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) return undefined
  return keyNotes(key)?.[degree - 1]
}

/**
 * Which degree of the key a note is, and how far it stands from the note the
 * scale has there.
 *
 * **By letter, and the alteration is the difference** — so in C major an F♯ is
 * `{ number: 4, alteration: 1 }` and in C minor a D♭ is `{ number: 2,
 * alteration: -1 }`, which is the Neapolitan's own name. That is the classical
 * reading `degree.ts` already takes for melodies, applied to harmony: a degree
 * names the step of the scale it is in, and an accidental on one means only
 * "this is not the note the scale has there".
 */
export interface KeyDegree {
  number: number
  alteration: number
}

export function degreeOf(key: Key, note: PitchClass): KeyDegree | undefined {
  const notes = keyNotes(key)
  if (notes === undefined) return undefined

  const index = notes.findIndex((step) => step.letter === note.letter)
  const step = notes[index]
  if (step === undefined) return undefined

  return { number: index + 1, alteration: note.alteration - step.alteration }
}

/** The letter a figure number above a bass lands on — a walk up the ladder. */
export function letterAbove(bass: Letter, steps: number): Letter {
  const start = LETTERS.indexOf(bass)
  return LETTERS[(start + steps) % 7] as Letter
}

/**
 * The figure number of a note above a bass: a third is 3, a fifth 5, and the
 * bass's own letter is 8 rather than 1, because that is what a figure calls it
 * (`figuredBass.ts`'s `[8, 5, 3]` is there for exactly this).
 */
export function figureNumberOf(bass: Letter, note: Letter): number {
  const step = (LETTERS.indexOf(note) - LETTERS.indexOf(bass) + 7) % 7
  return step === 0 ? 8 : step + 1
}

/* -------------------------------------------------------------- soundness */

export function keySignatureOf(key: Key): KeySignatureId | undefined {
  return keySignatureFor(keyPitch(key), key.mode)
}

/**
 * Whether a key can be written down at all.
 *
 * The same bar `isCleanScale` sets — no double accidentals in the scale — plus
 * the requirement that a signature exists to print it under. D♭ minor spells
 * but is not a key anybody writes, and it drops out here rather than arriving
 * at the staff with no signature to be in.
 */
export function isCleanKey(key: Key): boolean {
  return isCleanScale(key.tonic, key.mode) && keySignatureOf(key) !== undefined
}

/** Every key the app offers, in circle-of-fifths order within each mode. */
export const KEY_CHOICES: readonly Key[] = HARMONY_MODES.flatMap((mode) =>
  TONIC_CHOICES.map((tonic) => ({ tonic, mode })).filter(isCleanKey),
)

export const KEY_KEYS: readonly string[] = KEY_CHOICES.map(keyKey)

export function isKeyKey(value: string): boolean {
  return KEY_KEYS.includes(value)
}
