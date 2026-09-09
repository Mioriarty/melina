import { alterationInKey, KEY_SIGNATURES, type KeySignatureId } from './keySignature'
import { chromaticValue, isAlteration, type Pitch } from './pitch'
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

/** Semitones from the tonic up to a note. Negative below it. */
export function semitonesAbove(tonic: Pitch, value: Pitch): number {
  return chromaticValue(value) - chromaticValue(tonic)
}

/**
 * A note a melody may use, together with every degree that names it.
 *
 * **The vocabulary is notes, not names.** A degree and an alteration is a
 * spelling, and spellings are not what a player hears: in a major key ♯1 and
 * ♭2 are one sound under two names, so a question that wanted one and refused
 * the other would be unanswerable however well you listened. Worse, ♯3 in that
 * key *is* the fourth — a name for a note that already has a plainer one, and
 * nothing anybody would call it.
 *
 * Collecting by sounding pitch settles both at once. Each note appears once,
 * carrying the names it can go by, so a question is a run of notes and a
 * reading of it is right when it names those notes — by any of their names.
 */
export interface DegreeNote {
  /** Semitones above the tonic. */
  semitones: number
  /** Every degree naming it: the scale's own first, then raised, then lowered. */
  names: readonly [Degree, ...Degree[]]
}

/** The scale's own name for a note, if it has one, is always the plainest. */
function plainestFirst(a: Degree, b: Degree): number {
  return Math.abs(a.alteration) - Math.abs(b.alteration) || b.alteration - a.alteration
}

/**
 * Every distinct note the allowed degrees can name, once each and in order.
 *
 * **Bounded by the degrees themselves.** A level offering the first five
 * degrees is asking about the notes from the tonic up to the fifth, so a
 * flattened tonic sits below everything it teaches and a raised fifth above —
 * neither is in the level, however the keyboard spells it. Reading the range
 * off the outermost degrees rather than tabulating it means a level that adds
 * a degree widens on its own. It is also what keeps a raised seventh out of a
 * major key, where it is not a seventh at all but the octave.
 */
export function degreeNotes(
  tonic: Pitch,
  mode: ModeId,
  numbers: readonly number[],
  alterations: readonly DegreeAlteration[],
): readonly DegreeNote[] {
  const usable = numbers.filter(isDegreeNumber)
  if (usable.length === 0) return []

  const edge = (number: number): number | undefined => {
    const pitch = degreePitch(tonic, mode, { number, alteration: 0 })
    return pitch === undefined ? undefined : semitonesAbove(tonic, pitch)
  }

  const lowest = edge(Math.min(...usable))
  const highest = edge(Math.max(...usable))
  if (lowest === undefined || highest === undefined) return []

  const byNote = new Map<number, Degree[]>()

  for (const number of usable) {
    for (const alteration of alterations) {
      const degree: Degree = { number, alteration }
      const pitch = degreePitch(tonic, mode, degree)
      if (pitch === undefined) continue

      const semitones = semitonesAbove(tonic, pitch)
      if (semitones < lowest || semitones > highest) continue

      byNote.set(semitones, [...(byNote.get(semitones) ?? []), degree])
    }
  }

  return [...byNote.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([semitones, found]) => {
      const [first, ...rest] = [...found].sort(plainestFirst)
      return first === undefined ? [] : [{ semitones, names: [first, ...rest] as const }]
    })
}

/** Whether a note is one the mode itself has, rather than one from outside it. */
export function isScaleNote(note: DegreeNote): boolean {
  return note.names.some((name) => name.alteration === 0)
}

/**
 * Name each note of a melody, following the line.
 *
 * A note the scale has takes the scale's own name. One from outside it has two
 * equally true names — the degree below raised, or the one above lowered — and
 * the one to print is the one that says where the line is going: raised when it
 * carries on up, lowered when it turns back down. That is how a chromatic note
 * is written, and it is why a run through ♯4 to 5 does not come out as ♭5 to 5.
 */
export function nameMelody(notes: readonly DegreeNote[]): Degree[] {
  return notes.map((note, index) => {
    const [plainest] = note.names
    if (plainest.alteration === 0) return plainest

    const raised = note.names.find((name) => name.alteration === 1)
    const lowered = note.names.find((name) => name.alteration === -1)
    if (raised === undefined) return lowered ?? plainest
    if (lowered === undefined) return raised

    // Where it is heading, or — on the last note — where it came from.
    const next = notes[index + 1]
    const previous = notes[index - 1]
    const rising =
      next !== undefined
        ? next.semitones > note.semitones
        : previous === undefined || previous.semitones < note.semitones

    return rising ? raised : lowered
  })
}

/**
 * Whether two readings of a melody name the same notes.
 *
 * By sound, never by spelling: ♯1 and ♭2 are the same note, and no amount of
 * listening tells them apart, so a reading that picks either has heard it.
 */
export function degreesSoundEqual(
  tonic: Pitch,
  mode: ModeId,
  a: readonly Degree[],
  b: readonly Degree[],
): boolean {
  if (a.length !== b.length) return false

  return a.every((degree, index) => {
    const other = b[index]
    if (other === undefined) return false

    const one = degreePitch(tonic, mode, degree)
    const two = degreePitch(tonic, mode, other)
    return (
      one !== undefined &&
      two !== undefined &&
      chromaticValue(one) === chromaticValue(two)
    )
  })
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
