import { alterationInKey, type KeySignatureId } from '@/lib/music/keySignature'
import { isAlteration, type Alteration, type Letter, type Pitch } from '@/lib/music/pitch'
import { lettersFrom, tonicKey, type PitchClass } from '@/lib/music/scale'

/**
 * Thoroughbass figures.
 *
 * **A figure is not a chord. It is interval arithmetic above a bass, read
 * through a key signature.** `6` does not mean "first inversion"; it means *a
 * sixth above this bass, spelled as the key spells it*. Grove's article defines
 * every figure that way and never by root or inversion, which is what makes
 * this file possible without a chord model: there is no root here, no quality,
 * no inversion and no roman numeral, because none of them is what a figure
 * says. Those belong to harmonic analysis, which is a different subject.
 *
 * So the whole engine is a walk up the letters from the bass, asking the key
 * signature what each letter is:
 *
 *     6 above D, in C major   →  letter B  →  the key gives B♮   →  B
 *     ♭6 above D, in C major  →  letter B  →  B♮, a semitone down →  B♭
 *
 * Which is the same shape `degree.ts` already has: a degree names a note in a
 * mode, a figure names a note above a bass.
 */

/**
 * How a figure's number is altered — **against what the key already gives**,
 * not absolutely.
 *
 * Grove is explicit for the bare sign ("raised or depressed a Semitone") and
 * its own example settles the rest: with the signature of G major and an E♭
 * bass, `♭5` is B♭, taken down from the B♮ the signature spells. A `♮`, by
 * contrast, is absolute — it asks for the natural note whatever the key says.
 */
export type FigureAccidental = 'none' | 'sharp' | 'flat' | 'natural'

/** One line of a figure: an interval above the bass, and how it is altered. */
export interface FigureSign {
  /** Measured from the bass. Compound numbers are literal — a 9 is not a 2. */
  number: number
  accidental: FigureAccidental
}

/**
 * A whole figure standing under one bass note at one moment.
 *
 * Held highest-first, which is Grove's numerical-order rule. An **empty**
 * figure is the commonest one there is: "all Bass-notes unaccompanied by a
 * Figure are intended to bear Common Chords."
 */
export interface Figure {
  signs: readonly FigureSign[]
}

export const PLAIN_TRIAD: Figure = { signs: [] }

/**
 * The complete stacks a written figure can be an abbreviation of, in the order
 * a reader assumes them.
 *
 * **This is a table because the convention is a convention** — it is what
 * players were taught to take for granted, not something arithmetic can
 * recover. Grove states it case by case: "the addition of the Third being
 * taken as a matter of course"; "the Figure 7 only is needed … the addition of
 * the Third and Fifth being taken for granted"; "the 6 and the 4 being
 * understood".
 *
 * Order matters. Expansion picks the **first** stack that contains every
 * number written, so a bare `6` reads as 6/3 rather than 6/4, and a lone
 * accidental — which is the third and nothing else — reads as a plain triad.
 */
const STACKS: readonly (readonly number[])[] = [
  [5, 3],
  [6, 3],
  // **A bare 4 is a suspended fourth, not a six-four.** Grove is explicit:
  // "4 3 is always understood to mean 5/4 then 5/3 … in contradistinction to
  // 6/4 then 5/3". So it has to be found before `[6, 4]`, which a written
  // `6/4` still reaches because this one holds no 6.
  [5, 4],
  [6, 4],
  [7, 5, 3],
  [6, 5, 3],
  [6, 4, 3],
  [6, 4, 2],
  // The octave, which a suspended ninth resolves into. The 8 lands on the
  // bass's own letter, which is exactly what it means.
  [8, 5, 3],
  // The ninths, last so that nothing above them changes meaning: a bare `9`
  // finds the first stack holding a 9, and `9/7` the first holding both.
  [9, 5, 3],
  [9, 7, 5, 3],
  // Grove's eleventh and thirteenth "upon the Tonic Bass". Compound figures
  // over a bass that does not move, which is what makes them vocabulary rather
  // than span.
  //
  // **Each is shipped in one spelling only, and the reason is the model.** A
  // number names a letter, so 9 and 2 name the same one: `7/4/2` and `9/7/4`
  // are the same three notes, differing only in which octave the second is
  // written in — and register is exactly what a figure does not say. Offering
  // both would make a chord that two canonical figures answer, which is a
  // question with two right answers and one of them marked wrong. The same
  // goes for the thirteenth's `9/7/6/4` against `7/6/4/2`.
  [7, 4, 2],
  [7, 6, 4],
]

/**
 * The ways each stack may be written down, shortest first.
 *
 * The shortest is what gets printed; every one of them is accepted. Two forms
 * are given for the third inversion because both are genuinely current: Grove
 * blesses the bare `2` ("more common, and always perfectly intelligible"),
 * while `4/2` is the standard modern spelling. Accepting both is not the same
 * as accepting a redundant figure — `6/3` where `6` is idiomatic stays wrong.
 */
const ABBREVIATIONS = new Map<string, readonly (readonly number[])[]>([
  ['5,3', [[]]],
  ['6,3', [[6]]],
  ['6,4', [[6, 4]]],
  ['7,5,3', [[7]]],
  ['6,5,3', [[6, 5]]],
  ['6,4,3', [[4, 3]]],
  ['6,4,2', [[2], [4, 2]]],
  ['5,4', [[4]]],
  ['8,5,3', [[8]]],
  ['9,5,3', [[9]]],
  // "The Figures 9/7 … indicate a Chord of the Ninth, taken by direct
  // percussion" — struck, as against the `9` of a 9–8 suspension, which is a
  // ninth over a plain triad and resolves.
  ['9,7,5,3', [[9, 7]]],
  ['7,4,2', [[7, 4, 2]]],
  ['7,6,4', [[7, 6, 4]]],
])

const stackKey = (stack: readonly number[]) => stack.join(',')

/** The letter a number above this bass lands on. */
function letterAbove(bass: Letter, number: number): Letter {
  const letters = lettersFrom(bass)
  return letters[(number - 1) % 7] as Letter
}

/** What a figure's accidental makes of the note the key would have spelled. */
function alterationFor(
  letter: Letter,
  keySignature: KeySignatureId,
  accidental: FigureAccidental,
): Alteration | undefined {
  const base = alterationInKey(letter, keySignature)
  const target =
    accidental === 'none'
      ? base
      : accidental === 'natural'
        ? 0
        : accidental === 'sharp'
          ? base + 1
          : base - 1

  return isAlteration(target) ? target : undefined
}

/** The inverse: the sign that would ask for this alteration, if one can. */
function accidentalFor(
  letter: Letter,
  keySignature: KeySignatureId,
  alteration: Alteration,
): FigureAccidental | undefined {
  const base = alterationInKey(letter, keySignature)
  if (alteration === base) return 'none'
  if (alteration === 0) return 'natural'
  if (alteration === base + 1) return 'sharp'
  if (alteration === base - 1) return 'flat'
  // Two semitones from what the key gives cannot be asked for with one sign.
  return undefined
}

/** Highest number first, which is how a figure is read down the column. */
function sorted(signs: readonly FigureSign[]): readonly FigureSign[] {
  return [...signs].sort((a, b) => b.number - a.number)
}

/**
 * The complete stack a written figure stands for, with the lines the
 * convention leaves out filled back in.
 *
 * `undefined` for a figure naming numbers no stack holds — which is what a
 * defensive parser and the keyboard's own guard rails are for.
 */
export function expandFigure(figure: Figure): Figure | undefined {
  const written = new Map(figure.signs.map((sign) => [sign.number, sign.accidental]))
  const stack = STACKS.find((candidate) =>
    [...written.keys()].every((number) => candidate.includes(number)),
  )
  if (stack === undefined) return undefined

  return {
    signs: stack.map((number) => ({
      number,
      accidental: written.get(number) ?? 'none',
    })),
  }
}

/**
 * The notes a figure asks for above a bass, in the key.
 *
 * **Octave-free.** A figure says which notes, never where they sit — the
 * player chooses the voicing, and two realisations an octave apart are the
 * same answer. `undefined` where a note would need a triple accidental, the
 * same answer `transpose` gives for the same reason.
 */
export function figurePitches(
  bass: Pitch,
  keySignature: KeySignatureId,
  figure: Figure,
): readonly PitchClass[] | undefined {
  const expanded = expandFigure(figure)
  if (expanded === undefined) return undefined

  const notes: PitchClass[] = []
  for (const sign of expanded.signs) {
    const letter = letterAbove(bass.letter, sign.number)
    const alteration = alterationFor(letter, keySignature, sign.accidental)
    if (alteration === undefined) return undefined
    notes.push({ letter, alteration })
  }
  return notes
}

/** Whether two sets of notes are the same notes, however they are ordered. */
export function sameNotes(a: readonly PitchClass[], b: readonly PitchClass[]): boolean {
  if (a.length !== b.length) return false
  const keys = new Set(a.map(tonicKey))
  return keys.size === a.length && b.every((note) => keys.has(tonicKey(note)))
}

export interface CanonicalOptions {
  /**
   * Whether this figure follows another on the same bass note — the one case
   * in which Grove has the full form written out ("It is only necessary to
   * figure the Common Chord, when it follows some other Harmony, on the same
   * Bass-note"). Derived from the question rather than set by hand.
   */
  afterAnother?: boolean
  /**
   * What stood under the same bass immediately before this figure.
   *
   * **A figure following another writes only the lines that moved**, which is
   * the whole of how a suspension is figured: `4 3` is 5/4 then 5/3, and the
   * second of those is written `3` because the 5 did not go anywhere. Without
   * it the resolution of a 4–3 would have to be written as an unfigured bass,
   * which is not something a dash can be followed by.
   */
  previous?: readonly PitchClass[]
}

/**
 * Every conventional way of writing these notes over this bass, shortest
 * first.
 *
 * A **list**, because grading accepts any of them and only the first gets
 * printed. What it will not accept is a line the convention omits: writing out
 * `6/3` under a plain first inversion is the thing "a wholesome rule forbids
 * … any Figure not absolutely necessary for the expression of the Composer's
 * intention".
 *
 * **A line carrying an accidental is always written**, whatever the
 * abbreviation would drop, because the accidental is exactly the thing that is
 * not taken for granted. That single rule is where the bare `♯` comes from: a
 * plain triad abbreviates to nothing at all, so an altered third leaves only
 * its sign behind — "the Figure 3 being always suppressed in modern
 * Thoroughbasses, and the Accidental Sign alone inserted in its place".
 */
export function canonicalFigures(
  bass: Pitch,
  keySignature: KeySignatureId,
  notes: readonly PitchClass[],
  { afterAnother = false, previous }: CanonicalOptions = {},
): readonly Figure[] {
  const found: Figure[] = []

  for (const stack of STACKS) {
    if (stack.length !== notes.length) continue

    const signs: FigureSign[] = []
    for (const number of stack) {
      const letter = letterAbove(bass.letter, number)
      const note = notes.find((candidate) => candidate.letter === letter)
      if (note === undefined) break
      const accidental = accidentalFor(letter, keySignature, note.alteration)
      if (accidental === undefined) break
      signs.push({ number, accidental })
    }
    if (signs.length !== stack.length) continue

    const altered = new Set(
      signs.filter((sign) => sign.accidental !== 'none').map((sign) => sign.number),
    )
    // **The lines this figure moved** — the ones whose note was not already
    // sounding under the same bass a moment ago. First in the list, because
    // where there is a previous figure that is what actually gets written:
    // `4 3` is 5/4 then 5/3, and the second of those is a `3` because the 5
    // did not go anywhere.
    const standing = new Set((previous ?? []).map(tonicKey))
    const moved = signs
      .filter((sign) => {
        const letter = letterAbove(bass.letter, sign.number)
        const note = notes.find((candidate) => candidate.letter === letter)
        return note !== undefined && !standing.has(tonicKey(note))
      })
      .map((sign) => sign.number)

    // The **full form**, written out, is legitimate only for a figure that
    // follows another on the same bass note — Grove gives that as the one
    // reason to write `5/3` or `6/3` at all. Under one figure per bass note it
    // is not an alternative spelling but a mistake, which is why it is added
    // here rather than sitting in `ABBREVIATIONS` as another accepted form.
    const forms = [
      ...(previous !== undefined && moved.length > 0 ? [moved] : []),
      ...(ABBREVIATIONS.get(stackKey(stack)) ?? []),
      ...(afterAnother ? [stack] : []),
    ]

    for (const form of forms) {
      const shown = new Set([...form, ...altered])
      const written = { signs: sorted(signs.filter((sign) => shown.has(sign.number))) }
      if (!found.some((already) => figuresEqual(already, written))) found.push(written)
    }
  }

  return found
}

/** The one that gets printed: the shortest conventional form. */
export function preferredFigure(
  bass: Pitch,
  keySignature: KeySignatureId,
  notes: readonly PitchClass[],
  options: CanonicalOptions = {},
): Figure | undefined {
  return canonicalFigures(bass, keySignature, notes, options)[0]
}

export function figuresEqual(a: Figure, b: Figure): boolean {
  const left = sorted(a.signs)
  const right = sorted(b.signs)
  return (
    left.length === right.length &&
    left.every((sign, index) => {
      const other = right[index]
      return (
        other !== undefined &&
        sign.number === other.number &&
        sign.accidental === other.accidental
      )
    })
  )
}

/** Whether a written figure is one of the conventional ways to write these notes. */
export function isCanonical(
  bass: Pitch,
  keySignature: KeySignatureId,
  notes: readonly PitchClass[],
  written: Figure,
  options: CanonicalOptions = {},
): boolean {
  return canonicalFigures(bass, keySignature, notes, options).some((figure) =>
    figuresEqual(figure, written),
  )
}

/* ------------------------------------------------------------- stored form

   `#3` within a column, `/` between the lines of one column, `-` between
   successive figures under one bass note — which is the dash a suspension is
   written with anyway — and `,` between bass notes. Every separator is a
   character no value contains, so a key reads back to exactly what wrote it. */

const ACCIDENTAL_KEYS: Record<FigureAccidental, string> = {
  none: '',
  sharp: '#',
  flat: 'b',
  natural: 'n',
}

const KEY_ACCIDENTALS = new Map<string, FigureAccidental>([
  ['', 'none'],
  ['#', 'sharp'],
  ['b', 'flat'],
  ['n', 'natural'],
])

const SIGN_PATTERN = /^([#bn]?)(\d{1,2})$/

export function signKey(sign: FigureSign): string {
  return `${ACCIDENTAL_KEYS[sign.accidental]}${sign.number}`
}

export function figureKey(figure: Figure): string {
  return sorted(figure.signs).map(signKey).join('/')
}

export function parseFigureKey(key: string): Figure | undefined {
  const text = key.trim()
  if (text === '') return PLAIN_TRIAD

  const signs: FigureSign[] = []
  for (const part of text.split('/')) {
    const match = SIGN_PATTERN.exec(part)
    const symbol = match?.[1]
    const digits = match?.[2]
    if (symbol === undefined || digits === undefined) return undefined

    const accidental = KEY_ACCIDENTALS.get(symbol)
    const number = Number(digits)
    if (accidental === undefined || number < 2 || number > 14) return undefined
    if (signs.some((sign) => sign.number === number)) return undefined

    signs.push({ number, accidental })
  }
  return { signs: sorted(signs) }
}
