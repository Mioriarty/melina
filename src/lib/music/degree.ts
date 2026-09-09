import { alterationInKey, KEY_SIGNATURES, type KeySignatureId } from './keySignature'
import { isAlteration, type Pitch } from './pitch'
import { scalePitches, type ModeId } from './scale'

/**
 * Scale degrees — what a note is *called* once a key is in your ear.
 *
 * **A degree names the step of the mode it is in.** In A aeolian, C is the
 * third, and it is written `3`; the mode's own spelling is the reference. So an
 * accidental on a degree means one thing only: *this note is not the one the
 * scale has there.* C♯ in A aeolian is `#3`.
 *
 * That is the classical reading rather than the jazz one, where minor's third
 * would be `♭3` because the parallel major is the reference. It is also the one
 * that falls straight out of `scale.ts`, which already stores a mode as the
 * interval from its tonic to each degree — so the seven keys keep the same
 * labels in every mode, and nothing has to be re-taught when the mode changes.
 *
 * Ids and arithmetic only; "third degree" and "dritte Stufe" live in the
 * `music` namespace. See `useMusicNames`.
 */

/** How many degrees a diatonic mode has, the octave excluded. */
export const DEGREE_COUNT = 7

export const DEGREE_NUMBERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

/** Against the mode's own spelling, never against the major scale. */
export type DegreeAlteration = -1 | 0 | 1

export const DEGREE_ALTERATIONS: readonly DegreeAlteration[] = [-1, 0, 1]

export interface Degree {
  /** 1 to 7. */
  number: number
  alteration: DegreeAlteration
}

export function isDegreeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= DEGREE_COUNT
}

export function isDegreeAlteration(value: number): value is DegreeAlteration {
  return value === -1 || value === 0 || value === 1
}

/* ------------------------------------------------------------------- keys */

const ACCIDENTAL_PREFIX: Record<DegreeAlteration, string> = {
  [-1]: 'b',
  0: '',
  1: '#',
}

/** `3`, `b3`, `#3` — the form a degree is stored and compared in. */
export function degreeKey({ number, alteration }: Degree): string {
  return `${ACCIDENTAL_PREFIX[alteration]}${number}`
}

export function parseDegreeKey(key: string): Degree | undefined {
  const match = /^([b#]?)([1-7])$/.exec(key)
  if (match === null) return undefined

  const alteration = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0
  return { number: Number(match[2]), alteration }
}

/** A whole melody: `1,3,b6,5`. Also the answer a question is asking for. */
export function degreesKey(degrees: readonly Degree[]): string {
  return degrees.map(degreeKey).join(',')
}

export function parseDegreesKey(key: string): Degree[] | undefined {
  if (key === '') return []

  const degrees = key.split(',').map(parseDegreeKey)
  return degrees.every((degree): degree is Degree => degree !== undefined)
    ? degrees
    : undefined
}

export function degreesEqual(a: readonly Degree[], b: readonly Degree[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (degree, index) =>
        degree.number === b[index]?.number && degree.alteration === b[index]?.alteration,
    )
  )
}

/* ---------------------------------------------------------------- pitches */

/**
 * The note a degree names, in the octave above the tonic.
 *
 * `undefined` when the alteration would run past a double accidental — the
 * same rule `scalePitches` follows, and the reason a key can be unpressable
 * rather than a question unanswerable. Nothing invents a triple accidental.
 */
export function degreePitch(
  tonic: Pitch,
  mode: ModeId,
  degree: Degree,
): Pitch | undefined {
  if (!isDegreeNumber(degree.number)) return undefined

  const scale = scalePitches(tonic, mode)
  const step = scale?.[degree.number - 1]
  if (step === undefined) return undefined

  const alteration = step.alteration + degree.alteration
  return isAlteration(alteration) ? { ...step, alteration } : undefined
}

/** The degrees a mode on this tonic can actually spell, alterations included. */
export function spellableDegrees(
  tonic: Pitch,
  mode: ModeId,
  numbers: readonly number[],
  alterations: readonly DegreeAlteration[],
): Degree[] {
  return numbers.flatMap((number) =>
    alterations
      .map((alteration) => ({ number, alteration }))
      .filter((degree) => degreePitch(tonic, mode, degree) !== undefined),
  )
}

/** The tonic triad — degrees 1, 3 and 5, plus the octave for some body. */
export function tonicTriad(tonic: Pitch, mode: ModeId): readonly Pitch[] | undefined {
  const scale = scalePitches(tonic, mode)
  if (scale === undefined) return undefined

  const chord = [scale[0], scale[2], scale[4], scale[7]]
  return chord.every((pitch): pitch is Pitch => pitch !== undefined) ? chord : undefined
}

/* --------------------------------------------------------- key signature */

/**
 * The key signature a mode on this tonic is written under.
 *
 * Found rather than tabulated: a diatonic mode is a rotation of some major
 * scale, so exactly one of the fifteen signatures already spells every one of
 * its notes, and the way to know which is to ask each of them. D dorian comes
 * out under no signature at all, E ionian under four sharps.
 *
 * `undefined` when no signature spells it — a scale needing a double accidental
 * has no key of its own — and the generator then does not offer that pairing,
 * the same way `isCleanScale` keeps unspellable scales out.
 */
export function keySignatureFor(tonic: Pitch, mode: ModeId): KeySignatureId | undefined {
  const scale = scalePitches(tonic, mode)
  if (scale === undefined) return undefined

  // The octave repeats the tonic, so only the seven distinct letters matter.
  const notes = scale.slice(0, DEGREE_COUNT)

  return KEY_SIGNATURES.find((signature) =>
    notes.every((note) => alterationInKey(note.letter, signature.id) === note.alteration),
  )?.id
}
