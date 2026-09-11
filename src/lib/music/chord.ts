import { getClef, type ClefId } from './clef'
import {
  intervalSemitones,
  transpose,
  type Interval,
  type IntervalQuality,
} from './interval'
import { chromaticValue, type Pitch } from './pitch'
import { TONIC_CHOICES, tonicKey, parseTonicKey, type PitchClass } from './scale'
import { defaultRegister, voiceChord } from './voicing'

/**
 * Chords — the four triads and the five sevenths.
 *
 * **A chord is spelled, never a set of pitch classes.** A half-diminished
 * seventh on B♭ is B♭ D♭ F♭ A♭ and not B♭ C♯ E G♯, and the difference is the
 * whole of what makes it readable — so a quality is stored as **the interval
 * from the root to each of its members**, exactly the shape `DEGREE_QUALITIES`
 * has in `scale.ts`, and `chordNotes` walks `transpose` rather than adding
 * semitones. A spelling needing a triple accidental comes back `undefined`
 * instead of being invented, which is the answer `transpose` gives everywhere
 * else for the same reason.
 *
 * This is a *sibling* of `figuredBass.ts`, not a replacement for it. That file
 * is right to need no chord model — a figure is interval arithmetic above a
 * bass, and root, quality and inversion are none of what a figure says. They
 * are what *naming* a chord says, which is a different subject read from the
 * other end.
 *
 * Names are translated, as everywhere in `lib/music`: German calls the
 * dominant seventh the Dominantseptakkord and the first inversion of a triad
 * the Sextakkord, neither of which survives a sentence assembled from English
 * parts. See `useMusicNames`.
 */

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'dominant-seventh'
  | 'major-seventh'
  | 'minor-seventh'
  | 'half-diminished-seventh'
  | 'diminished-seventh'

/**
 * In the order the app teaches them: the four triads, then the sevenths with
 * the dominant seventh first because it is the one that is everywhere.
 *
 * Fixed, so a quality always occupies the same key on the naming keyboard —
 * the same promise `catalog.ts` makes about interval qualities.
 */
export const CHORD_QUALITIES: readonly ChordQuality[] = [
  'major',
  'minor',
  'diminished',
  'augmented',
  'dominant-seventh',
  'major-seventh',
  'minor-seventh',
  'half-diminished-seventh',
  'diminished-seventh',
]

const q = (number: number, quality: IntervalQuality): Interval => ({ number, quality })

/**
 * Root to each member, in thirds.
 *
 * **Intervals rather than semitones**, which is what makes the spelling come
 * out. The diminished seventh is the case that proves it: its seventh is a
 * *diminished* seventh, so on B♭ it is A𝄫 — nine semitones above the root and
 * emphatically not a major sixth, however a keyboard would sound it.
 */
const MEMBER_INTERVALS: Record<ChordQuality, readonly Interval[]> = {
  major: [q(1, 'perfect'), q(3, 'major'), q(5, 'perfect')],
  minor: [q(1, 'perfect'), q(3, 'minor'), q(5, 'perfect')],
  diminished: [q(1, 'perfect'), q(3, 'minor'), q(5, 'diminished')],
  augmented: [q(1, 'perfect'), q(3, 'major'), q(5, 'augmented')],
  'dominant-seventh': [q(1, 'perfect'), q(3, 'major'), q(5, 'perfect'), q(7, 'minor')],
  'major-seventh': [q(1, 'perfect'), q(3, 'major'), q(5, 'perfect'), q(7, 'major')],
  'minor-seventh': [q(1, 'perfect'), q(3, 'minor'), q(5, 'perfect'), q(7, 'minor')],
  'half-diminished-seventh': [
    q(1, 'perfect'),
    q(3, 'minor'),
    q(5, 'diminished'),
    q(7, 'minor'),
  ],
  'diminished-seventh': [
    q(1, 'perfect'),
    q(3, 'minor'),
    q(5, 'diminished'),
    q(7, 'diminished'),
  ],
}

/**
 * What each position in a chord is called — the root, its third, its fifth and
 * its seventh. An index into `MEMBER_INTERVALS`, and the vocabulary both the
 * inversion and the Lage are named in.
 */
export type ChordMember = 'root' | 'third' | 'fifth' | 'seventh'

export const CHORD_MEMBERS: readonly ChordMember[] = ['root', 'third', 'fifth', 'seventh']

export function memberAt(index: number): ChordMember {
  return CHORD_MEMBERS[index] ?? 'root'
}

export function chordSize(quality: ChordQuality): number {
  return MEMBER_INTERVALS[quality].length
}

export function isChordQuality(value: string): value is ChordQuality {
  return CHORD_QUALITIES.includes(value as ChordQuality)
}

export function isSeventh(quality: ChordQuality): boolean {
  return chordSize(quality) === 4
}

export const TRIAD_QUALITIES: readonly ChordQuality[] = CHORD_QUALITIES.filter(
  (quality) => !isSeventh(quality),
)

export const SEVENTH_QUALITIES: readonly ChordQuality[] =
  CHORD_QUALITIES.filter(isSeventh)

/**
 * A chord, and where its members stand.
 *
 * **The inversion is which member is lowest and the Lage is which is highest**,
 * and the two are independent because everything between them is free: a
 * root-position triad is C–E–G in Quintlage and C–G–E′ in Terzlage, both with
 * the root in the bass. That is what lets Lage be a real answer axis without
 * four voices and without doubling a note — which is the only other way the
 * top of a three-note chord could be made to move.
 */
export interface Chord {
  root: PitchClass
  quality: ChordQuality
  /** The member in the bass. 0 root, 1 third, 2 fifth, 3 seventh. */
  inversion: number
  /** The member in the top voice — the Lage. Never the same as `inversion`. */
  top: number
}

/** Every inversion a chord of this size has. */
export function inversionsFor(quality: ChordQuality): readonly number[] {
  return Array.from({ length: chordSize(quality) }, (_, index) => index)
}

/**
 * The member that ends up on top when a chord is simply stacked upward from
 * its bass — the Lage a level that does not ask for one always gets.
 */
export function closePosition(quality: ChordQuality, inversion: number): number {
  const size = chordSize(quality)
  return (inversion + size - 1) % size
}

/** Every Lage a chord in this inversion can be voiced to. */
export function topsFor(quality: ChordQuality, inversion: number): readonly number[] {
  return inversionsFor(quality).filter((member) => member !== inversion)
}

export function closeChord(
  root: PitchClass,
  quality: ChordQuality,
  inversion = 0,
): Chord {
  return { root, quality, inversion, top: closePosition(quality, inversion) }
}

/**
 * The members of a chord, in member order — root, third, fifth, seventh.
 *
 * Octave-free, because which octave a member sits in is a fact about the
 * voicing rather than about the chord. `undefined` where a member would need a
 * triple accidental, which is `transpose`'s own answer and is what
 * `isCleanChord` turns into "pick a different root".
 */
export function chordNotes(
  root: PitchClass,
  quality: ChordQuality,
): readonly PitchClass[] | undefined {
  const notes: PitchClass[] = []
  for (const interval of MEMBER_INTERVALS[quality]) {
    const placed = transpose({ ...root, octave: 4 }, interval, 'up')
    if (placed === undefined) return undefined
    notes.push({ letter: placed.letter, alteration: placed.alteration })
  }
  return notes
}

/**
 * Which members stand where, from the bass up.
 *
 * The bass is the inversion and the top is the Lage; what is left fills in
 * between, taken in the order the chord itself runs — so the ordinary
 * close-position stacking is what comes out whenever the Lage is the one that
 * stacking would have produced anyway.
 */
export function voicingOrder(chord: Chord): readonly number[] {
  const size = chordSize(chord.quality)
  const cyclic = Array.from({ length: size }, (_, i) => (chord.inversion + i) % size)
  return [...cyclic.filter((member) => member !== chord.top), chord.top]
}

/** The chord's notes from the bass up, ready to be handed to `voiceChord`. */
export function chordVoicing(chord: Chord): readonly PitchClass[] | undefined {
  const notes = chordNotes(chord.root, chord.quality)
  if (notes === undefined) return undefined
  const order = voicingOrder(chord)
  const voiced = order.map((member) => notes[member])
  return voiced.every((note) => note !== undefined) ? (voiced as PitchClass[]) : undefined
}

/**
 * The chord on a staff.
 *
 * Placed by `voiceChord`, which is the single place in the app that decides
 * where a note sits — the same one thoroughbass realises into and the writing
 * keyboard previews from, so a question, the staff it is drawn on and the
 * verdict on an answer cannot come to disagree.
 */
export function chordPitches(
  chord: Chord,
  clef: ClefId = 'treble',
): readonly Pitch[] | undefined {
  const voicing = chordVoicing(chord)
  if (voicing === undefined) return undefined
  return voiceChord(voicing, defaultRegister(clef), clef)
}

/** Whether every note of the chord lands where the staff can show it. */
export function fitsClef(chord: Chord, clef: ClefId): boolean {
  const pitches = chordPitches(chord, clef)
  if (pitches === undefined) return false
  const { lowest, highest } = getClef(clef)
  return pitches.every(
    (note) =>
      chromaticValue(note) >= chromaticValue(lowest) &&
      chromaticValue(note) <= chromaticValue(highest),
  )
}

/**
 * Whether a quality spells cleanly on this root — **computed, never
 * tabulated**, which is the move `isCleanScale` makes for the same reason.
 *
 * **A double accidental is allowed, and exactly one of them.** That is not a
 * compromise: a diminished seventh above C *is* B double flat, and there is no
 * other way to write it — the chord is a stack of thirds, the seventh has to be
 * a B of some kind, and nine semitones above C is where that B lands. Refusing
 * doubles outright would refuse the chord on half the roots it actually lives
 * on, and would teach a spelling nobody uses.
 *
 * What is refused is a chord needing **two** of them. A diminished seventh on
 * E♭ would want both B𝄫 and D𝄫; those spellings are legal and no one writes
 * them, because such a chord is always respelled instead. The rule is the
 * boundary between notation that is read and notation that is only derived,
 * and it falls out of the spelling rather than needing anyone to work the
 * exceptions out again when a quality is added.
 */
const MAX_DOUBLE_ACCIDENTALS = 1

export function isCleanChord(root: PitchClass, quality: ChordQuality): boolean {
  const notes = chordNotes(root, quality)
  if (notes === undefined) return false
  return (
    notes.filter((note) => Math.abs(note.alteration) > 1).length <= MAX_DOUBLE_ACCIDENTALS
  )
}

/**
 * Whether writing this chord down needs a double accidental.
 *
 * The writing keyboard has to offer one where it does — see `ChordKeyboard`,
 * whose accidental switches stack to a double on a second press for exactly
 * this chord and no other reason.
 */
export function needsDoubleAccidental(root: PitchClass, quality: ChordQuality): boolean {
  return (chordNotes(root, quality) ?? []).some((note) => Math.abs(note.alteration) > 1)
}

/** The offered roots a quality can actually be spelled on. */
export function cleanRoots(quality: ChordQuality): readonly PitchClass[] {
  return TONIC_CHOICES.filter((root) => isCleanChord(root, quality))
}

/**
 * The thoroughbass figure an inversion is known by: `6/4`, `6/5`, `2`.
 *
 * **A table, because the convention is a convention** — the same reason
 * `STACKS` is one in `figuredBass.ts`. These are the abbreviations harmony
 * teaching uses for the inversions themselves, and they are what makes the
 * braid between the two subjects visible on a key: a Sextakkord *is* what a
 * figured `6` stands for.
 *
 * What is deliberately **not** here is the accidentals a real figured bass
 * would carry. The first inversion of a C augmented triad is figured `6/♯3`
 * over its E, and it is still a first inversion — this labels where the members
 * stand, not what would be printed under a bass. Asking `figuredBass.ts` for
 * the answer instead would have produced the second thing while looking like
 * the first.
 */
const INVERSION_FIGURES: Record<number, readonly string[]> = {
  3: ['5/3', '6', '6/4'],
  4: ['7', '6/5', '4/3', '2'],
}

export function inversionFigure(quality: ChordQuality, inversion: number): string {
  return INVERSION_FIGURES[chordSize(quality)]?.[inversion] ?? ''
}

/* ------------------------------------------------------- what can be heard */

/** Semitones above the root for each member, in member order. */
function memberSemitones(quality: ChordQuality): readonly number[] {
  return MEMBER_INTERVALS[quality].map((interval) => intervalSemitones(interval) ?? 0)
}

/**
 * Whether the chord sounds the same when its own inversions are played —
 * **computed from the interval content**, not kept in a list.
 *
 * An augmented triad divides the octave into three equal parts and a fully
 * diminished seventh into four, so rotating either one gives back the same
 * sound under another name: E–G♯–C is E augmented in root position quite as
 * truthfully as it is C augmented in first inversion. Both readings are right,
 * and nothing in the sound chooses between them.
 */
export function isSymmetric(quality: ChordQuality): boolean {
  const set = [...memberSemitones(quality)]
    .map((value) => value % 12)
    .sort((a, b) => a - b)
  const key = set.join(',')

  return set.some((base, index) => {
    if (index === 0) return false
    const rotated = set.map((value) => (value - base + 12) % 12).sort((a, b) => a - b)
    return rotated.join(',') === key
  })
}

/**
 * The inversions a chord of this quality can be asked for **by ear**.
 *
 * The same rule `HEARABLE_INTERVAL_KEYS` states for intervals, arrived at the
 * same way: a question whose answer cannot be heard is not a hard question but
 * an unanswerable one. A symmetric chord's inversion is exactly that, so by ear
 * it is only ever asked in root position — and the naming keyboard does not
 * ask for the inversion of one at all, rather than asking for something the
 * player would have to guess.
 *
 * Reading is untouched: there the spelling is on the page, and which note is
 * the root is something you can see.
 */
export function hearableInversions(quality: ChordQuality): readonly number[] {
  return isSymmetric(quality) ? [0] : inversionsFor(quality)
}

/**
 * What a voicing sounds like: the semitones of each note above the bass.
 *
 * Taken from the placed chord rather than from the arithmetic, so it is the
 * sound as the staff actually draws it. Two chords with the same signature are
 * the same sound, whatever they are called — which is what
 * `chord.test.ts` holds every hearing level to.
 */
export function chordSignature(chord: Chord): readonly number[] {
  const pitches = chordPitches(chord)
  const bass = pitches?.[0]
  if (pitches === undefined || bass === undefined) return []
  return pitches.map((note) => chromaticValue(note) - chromaticValue(bass))
}

/* ---------------------------------------------------------- reading it back */

/**
 * The chord a written stack of notes spells — the round trip.
 *
 * The same trick `modeOf` plays on the scale generator and `onsetsOf` on the
 * rhythm one: the generator is *checked* against the model rather than trusted,
 * by reading its own output back and insisting on what went in. It is also what
 * the reading exercise's verdict could be built on, and what proves a question
 * has one answer rather than two.
 *
 * `undefined` for anything that is not one of the nine qualities — which
 * includes a stack with a note doubled, since a chord here is its distinct
 * members and nothing else.
 */
export function readChord(pitches: readonly Pitch[]): Chord | undefined {
  const bass = pitches[0]
  const top = pitches[pitches.length - 1]
  if (bass === undefined || top === undefined) return undefined

  const written = pitches.map((note) => tonicKey(note))
  if (new Set(written).size !== written.length) return undefined

  for (const quality of CHORD_QUALITIES) {
    if (chordSize(quality) !== pitches.length) continue

    for (const candidate of pitches) {
      const root = { letter: candidate.letter, alteration: candidate.alteration }
      const notes = chordNotes(root, quality)
      if (notes === undefined) continue

      const keys = notes.map(tonicKey)
      if (keys.length !== written.length) continue
      if (![...written].sort().every((key, i) => key === [...keys].sort()[i])) continue

      const inversion = keys.indexOf(tonicKey(bass))
      const highest = keys.indexOf(tonicKey(top))
      if (inversion === -1 || highest === -1 || inversion === highest) continue

      const chord: Chord = { root, quality, inversion, top: highest }
      // The members between the two ends are not free: `voicingOrder` fixes
      // them, so a stack that is not the one this chord voices to is a stack
      // this chord did not write.
      const voiced = chordVoicing(chord)?.map(tonicKey)
      if (voiced === undefined || voiced.join(',') !== written.join(',')) continue

      return chord
    }
  }

  return undefined
}

export function sameChord(a: Chord, b: Chord): boolean {
  return (
    tonicKey(a.root) === tonicKey(b.root) &&
    a.quality === b.quality &&
    a.inversion === b.inversion &&
    a.top === b.top
  )
}

/* --------------------------------------------------------------- stored form

   `Eb:dominant-seventh:1:3` — root, quality, inversion, Lage. Colons because
   no part contains one, so a key reads back to exactly what wrote it. Only the
   machine form lives here; every word a player reads is translated. */

export function chordKey(chord: Chord): string {
  return `${tonicKey(chord.root)}:${chord.quality}:${chord.inversion}:${chord.top}`
}

export function parseChordKey(key: string): Chord | undefined {
  const parts = key.trim().split(':')
  if (parts.length !== 4) return undefined
  const [rootKey, quality, inversion, top] = parts as [string, string, string, string]

  const root = parseTonicKey(rootKey)
  if (root === undefined || !isChordQuality(quality)) return undefined

  const size = chordSize(quality)
  const bass = Number(inversion)
  const highest = Number(top)
  if (!Number.isInteger(bass) || bass < 0 || bass >= size) return undefined
  if (!Number.isInteger(highest) || highest < 0 || highest >= size) return undefined
  if (bass === highest) return undefined

  return { root, quality, inversion: bass, top: highest }
}
