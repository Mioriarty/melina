import { alterationInKey, KEY_SIGNATURES, type KeySignatureId } from './keySignature'
import { chromaticValue, isAlteration, type Pitch } from './pitch'
import { scalePitches, signatureMode, type ModeId } from './scale'

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
  /**
   * Octaves away from the tonic's own, so `0` is the octave above the tonic
   * and `1` is the one above that. Absent means `0`.
   *
   * Scale degree identification never leaves that first octave and so never
   * sets it; melodic dictation ranges further, and a melody that touches the
   * fifth below its tonic and the octave above it needs both of those to be
   * *the same degree in different octaves* rather than two unrelated names.
   * A degree keeps its meaning wherever it sits, which is the whole reason
   * this is a field on the degree rather than a separate kind of thing.
   */
  octave?: number
}

/** The octave a degree sits in, with the common case spelled once. */
export function degreeOctave(degree: Degree): number {
  return degree.octave ?? 0
}

export function isDegreeNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= DEGREE_COUNT
}

export function isDegreeAlteration(value: number): value is DegreeAlteration {
  return value === -1 || value === 0 || value === 1
}

/* ------------------------------------------------------------------ steps

   A degree plus an octave is a position on the scale, and a melody's
   vocabulary is a contiguous run of them: "the first five" is 1 to 5, "the
   whole octave" is 1 to 1 an octave up, "around the tonic" is the fifth below
   to the fifth above. Counting them as one ladder is what lets a level name
   two ends and get everything between. */

/** Where a degree sits on that ladder. 0 is the tonic in its own octave. */
export function stepIndex(degree: Degree): number {
  return degreeOctave(degree) * DEGREE_COUNT + (degree.number - 1)
}

/** The plain degree at a rung. The inverse of `stepIndex`. */
export function stepAt(index: number): Degree {
  // Modulo that stays positive below the tonic's own octave.
  const number = (((index % DEGREE_COUNT) + DEGREE_COUNT) % DEGREE_COUNT) + 1
  const octave = Math.floor(index / DEGREE_COUNT)
  return octave === 0 ? { number, alteration: 0 } : { number, alteration: 0, octave }
}

/**
 * Every plain degree from `low` up to `high`, inclusive.
 *
 * The vocabulary a melody may use, and — one key each — the keyboard that
 * writes it down. Empty when the two are the wrong way round, so a level with
 * a nonsense range generates nothing rather than a keyboard nobody can answer
 * with.
 */
export function stepRange(low: Degree, high: Degree): readonly Degree[] {
  const from = stepIndex(low)
  const to = stepIndex(high)
  if (to < from) return []

  return Array.from({ length: to - from + 1 }, (_, offset) => stepAt(from + offset))
}

/* ------------------------------------------------------------------- keys */

const ACCIDENTAL_PREFIX: Record<DegreeAlteration, string> = {
  [-1]: 'b',
  0: '',
  1: '#',
}

/**
 * How an octave is marked: `5'` is a fifth an octave up, `5_` one an octave
 * down, and a bare `5` sits in the tonic's own octave.
 *
 * Helmholtz marks the octave below with a comma, and that is exactly what this
 * cannot use: `degreesKey` joins a melody with commas, and a separator that
 * also appears inside a value is a format that cannot be read back. The
 * underscore is the only change from the convention.
 */
const OCTAVE_UP = "'"
const OCTAVE_DOWN = '_'

function octaveSuffix(octave: number): string {
  return octave >= 0 ? OCTAVE_UP.repeat(octave) : OCTAVE_DOWN.repeat(-octave)
}

/** `3`, `b3`, `#3`, `5_`, `b3'` — the form a degree is stored and compared in. */
export function degreeKey(degree: Degree): string {
  const { number, alteration } = degree
  return `${ACCIDENTAL_PREFIX[alteration]}${number}${octaveSuffix(degreeOctave(degree))}`
}

/**
 * `undefined` for anything this does not spell.
 *
 * A key written before degrees carried an octave has no suffix and reads back
 * as the octave-zero degree it was, which is what keeps the rows scale degree
 * identification has already written legible.
 */
export function parseDegreeKey(key: string): Degree | undefined {
  const match = /^([b#]?)([1-7])('*|_*)$/.exec(key)
  if (match === null) return undefined

  const alteration = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0
  const marks = match[3] ?? ''
  const octave = marks.startsWith(OCTAVE_DOWN) ? -marks.length : marks.length

  const degree: Degree = { number: Number(match[2]), alteration }
  return octave === 0 ? degree : { ...degree, octave }
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
 * The note a degree names.
 *
 * In the octave above the tonic by default, and `degree.octave` octaves from
 * there — the spelling is the scale's own either way, since transposing by a
 * whole octave changes no letter and no accidental.
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
  if (!isAlteration(alteration)) return undefined

  return { ...step, alteration, octave: step.octave + degreeOctave(degree) }
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
 * Every distinct note the allowed steps can name, once each and in order.
 *
 * **Bounded by the steps themselves.** A level offering the first five degrees
 * is asking about the notes from the tonic up to the fifth, so a flattened
 * tonic sits below everything it teaches and a raised fifth above — neither is
 * in the level, however the keyboard spells it. Reading the range off the
 * outermost steps rather than tabulating it means a level that widens its
 * range widens on its own. It is also what keeps a raised seventh out of a
 * major key, where it is not a seventh at all but the octave.
 *
 * Across octaves that last case is the interesting one: with the range running
 * up to the octave above the tonic, a raised seventh and that octave are one
 * sound under two names, and collecting by sounding pitch is what stops a
 * melody being drawn twice from the same note.
 */
export function stepNotes(
  tonic: Pitch,
  mode: ModeId,
  steps: readonly Degree[],
  alterations: readonly DegreeAlteration[],
): readonly DegreeNote[] {
  const usable = steps.filter((step) => isDegreeNumber(step.number))
  const rungs = usable.map(stepIndex)
  if (usable.length === 0) return []

  const edge = (rung: number): number | undefined => {
    const pitch = degreePitch(tonic, mode, stepAt(rung))
    return pitch === undefined ? undefined : semitonesAbove(tonic, pitch)
  }

  const lowest = edge(Math.min(...rungs))
  const highest = edge(Math.max(...rungs))
  if (lowest === undefined || highest === undefined) return []

  const byNote = new Map<number, Degree[]>()

  for (const step of usable) {
    for (const alteration of alterations) {
      const octave = degreeOctave(step)
      const degree: Degree =
        octave === 0
          ? { number: step.number, alteration }
          : { number: step.number, alteration, octave }

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

/**
 * The same, for a level that names degree *numbers* within one octave.
 *
 * Scale degree identification offers a set rather than a range — a level on
 * the tonic triad is 1, 3 and 5 with 2 and 4 left out — so it names what it
 * wants and the bound still comes from the outermost of them.
 */
export function degreeNotes(
  tonic: Pitch,
  mode: ModeId,
  numbers: readonly number[],
  alterations: readonly DegreeAlteration[],
): readonly DegreeNote[] {
  return stepNotes(
    tonic,
    mode,
    numbers.map((number) => ({ number, alteration: 0 })),
    alterations,
  )
}

/** Whether a note is one the mode itself has, rather than one from outside it. */
export function isScaleNote(note: DegreeNote): boolean {
  return note.names.some((name) => name.alteration === 0)
}

/**
 * The names for a sound that do not need a **double accidental** to write.
 *
 * Two names for one note are equally altered as degrees and can be wildly
 * unequal on the page. In B♭ mixolydian the note a semitone under the octave is
 * both ♯7 and ♭1 of the octave above — the first spells A♮, the second B𝄫, and
 * only one of them is a note anybody writes. Reading the *pitch* rather than
 * the degree is what tells them apart, since a degree's alteration says how far
 * it sits from the mode's own step and nothing at all about what gets drawn.
 *
 * **Only doubles are ruled out, deliberately.** An earlier version kept the
 * smallest printed accidental of the two, which is a different and worse rule:
 * in F♯ major it turned a rising ♯4 — B♯, the conventional spelling of an
 * ascending chromatic note — into C♮, purely because a natural is less ink than
 * a sharp. Choosing between two single accidentals is exactly what the
 * direction of the line is for, so both survive and `nameMelody` decides.
 */
function writableSpellings(
  tonic: Pitch,
  mode: ModeId,
  names: readonly Degree[],
): readonly Degree[] {
  const plain = names.filter((name) => {
    const pitch = degreePitch(tonic, mode, name)
    return pitch !== undefined && Math.abs(pitch.alteration) < 2
  })

  // All of them double? Then there is nothing to prefer, and the line decides
  // as it always did.
  return plain.length > 0 ? plain : names
}

/**
 * Name each note of a melody, following the line.
 *
 * A note the scale has takes the scale's own name. One from outside it has two
 * equally true names — the degree below raised, or the one above lowered — and
 * the one to print is the one that says where the line is going: raised when it
 * carries on up, lowered when it turns back down. That is how a chromatic note
 * is written, and it is why a run through ♯4 to 5 does not come out as ♭5 to 5.
 *
 * **Unless one of them cannot be written.** The direction rule assumes the two
 * names cost the same on the page, which stops being true once a melody leaves
 * the tonic's own octave: B𝄫 and A♮ are one sound, and no line's direction
 * makes the double flat the right way to write it. So spellings needing a
 * double accidental drop out first, and the direction decides among what is
 * left — which is still both of them in every ordinary case.
 */
export function nameMelody(
  tonic: Pitch,
  mode: ModeId,
  notes: readonly DegreeNote[],
): Degree[] {
  return notes.map((note, index) => {
    const [plainest] = note.names
    if (plainest.alteration === 0) return plainest

    const usable = writableSpellings(tonic, mode, note.names)
    const [simplest] = usable
    const raised = usable.find((name) => name.alteration === 1)
    const lowered = usable.find((name) => name.alteration === -1)
    if (raised === undefined) return lowered ?? simplest ?? plainest
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
 * The search runs on `signatureMode`, not on the mode itself, and that is the
 * whole of what harmonic and melodic minor needed here. No signature raises a
 * seventh, so asking for one that spells A harmonic minor outright would come
 * back with nothing and quietly empty every level offering it. What is asked
 * for instead is the signature of the scale it is written under — A minor's —
 * and the raised degrees then print an accidental, because `melodyMei` prints
 * whatever differs from the signature. That is exactly how the scale has
 * always been written down.
 *
 * `undefined` when no signature spells it — a scale needing a double accidental
 * has no key of its own — and the generator then does not offer that pairing,
 * the same way `isCleanScale` keeps unspellable scales out.
 */
export function keySignatureFor(tonic: Pitch, mode: ModeId): KeySignatureId | undefined {
  const scale = scalePitches(tonic, signatureMode(mode))
  if (scale === undefined) return undefined

  // The octave repeats the tonic, so only the seven distinct letters matter.
  const notes = scale.slice(0, DEGREE_COUNT)

  return KEY_SIGNATURES.find((signature) =>
    notes.every((note) => alterationInKey(note.letter, signature.id) === note.alteration),
  )?.id
}
