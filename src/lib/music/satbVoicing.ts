import { chordNotes, isSeventh, type Chord } from './chord'
import { eventChord, eventNotes, type HarmonicEvent } from './harmony'
import { keyNotes, type Key } from './key'
import { chromaticValue, isAlteration, pitch, type Pitch } from './pitch'
import { tonicKey, type PitchClass } from './scale'

/**
 * What a four-part setting **is**, before anything judges one.
 *
 * The vocabulary three modules share and none of them owns: `voiceLeading.ts`
 * holds the rules a setting is held to, `satb.ts` generates through them, and
 * the exercises read a finished one. Keeping the nouns here rather than in
 * either of the other two is what makes the dependencies a line — vocabulary,
 * then rules, then search — instead of a cycle.
 *
 * Nothing here decides anything. There is no rule in this file, no cost and no
 * verdict: a `Voicing` is four pitches, a `Move` is two of them side by side,
 * and an `EventContext` is what a chord holds, worked out once so the rules do
 * not each work it out again.
 */

export type VoiceId = 'soprano' | 'alto' | 'tenor' | 'bass'

/** Top down, which is the order a score is read in. */
export const VOICES: readonly VoiceId[] = ['soprano', 'alto', 'tenor', 'bass']

/**
 * Bottom up, which is the order a setting is **written** in.
 *
 * A chorale is built from its bass: the bass is given, the tenor stands on it,
 * the alto on the tenor and the soprano on top. So the answer surface fills in
 * this order and the reading surfaces in the other, and neither has to reverse
 * the other's list at the call site.
 */
export const VOICES_UP: readonly VoiceId[] = ['bass', 'tenor', 'alto', 'soprano']

export type Voicing = Readonly<Record<VoiceId, Pitch>>

export interface VoiceRange {
  lowest: Pitch
  highest: Pitch
}

/**
 * Chorale ranges, which are **not** the staff ranges in `clef.ts`.
 *
 * Those are geometry — the staff plus two ledger lines — and they say nothing
 * about what a voice can sing. These are the ordinary compass of a four-part
 * chorus, deliberately conservative: a setting that stays inside them is
 * singable by amateurs, which is what the idiom is for.
 */
export const SATB_RANGES: Readonly<Record<VoiceId, VoiceRange>> = {
  soprano: { lowest: pitch('C', 0, 4), highest: pitch('G', 0, 5) },
  alto: { lowest: pitch('G', 0, 3), highest: pitch('D', 0, 5) },
  tenor: { lowest: pitch('C', 0, 3), highest: pitch('G', 0, 4) },
  bass: { lowest: pitch('E', 0, 2), highest: pitch('C', 0, 4) },
}

/** Widest gap allowed between neighbouring upper voices, in semitones. */
export const UPPER_SPACING = 12
/** Tenor to bass may open further, which is the ordinary chorale texture. */
export const LOWER_SPACING = 19
/** Beyond this a voice is leaping rather than moving. */
export const COMFORTABLE_LEAP = 5
export const WIDE_LEAP = 9

/** How far one voice moved, in semitones. Signed: up is positive. */
export function step(from: Pitch, to: Pitch): number {
  return chromaticValue(to) - chromaticValue(from)
}

/** Reduced to within the octave, so a twelfth reads as a fifth. */
export function reduced(lower: Pitch, upper: Pitch): number {
  return (((chromaticValue(upper) - chromaticValue(lower)) % 12) + 12) % 12
}

export const PERFECT_FIFTH = 7
export const PERFECT_OCTAVE = 0

/** Two notes of one pitch class, whatever octave either stands in. */
export const samePitchClass = (a: PitchClass, b: PitchClass) =>
  tonicKey(a) === tonicKey(b)

export type Motion = 'parallel' | 'similar' | 'contrary' | 'oblique' | 'none'

/** How a pair of voices moves between two chords. */
export function motionBetween(
  from: readonly [Pitch, Pitch],
  to: readonly [Pitch, Pitch],
): Motion {
  const upper = step(from[0], to[0])
  const lower = step(from[1], to[1])

  if (upper === 0 && lower === 0) return 'none'
  if (upper === 0 || lower === 0) return 'oblique'
  if (upper > 0 !== lower > 0) return 'contrary'
  return upper === lower ? 'parallel' : 'similar'
}

/* ------------------------------------------------------- what a chord holds */

/**
 * Everything about one event the rules need, worked out once.
 *
 * `readChord` walks nine qualities against every rotation of a stack, which is
 * far too much to repeat inside a search that evaluates thousands of edges. So
 * the search builds one of these per event and the rules read it.
 */
export interface EventContext {
  event: HarmonicEvent
  /** The distinct notes of the sonority, bass first. */
  notes: readonly PitchClass[]
  chord: Chord | undefined
  root: PitchClass | undefined
  fifth: PitchClass | undefined
  seventh: PitchClass | undefined
  /** The key's own leading note, when this chord contains it. */
  leadingNote: PitchClass | undefined
  /** Whether this chord is the one the key is named after. */
  isTonic: boolean
  /** Notes that do not belong to the key, which must never be doubled. */
  altered: readonly PitchClass[]
}

/** The note a semitone below the tonic — the key's leading note, raised in minor. */
export function leadingNoteOf(key: Key): PitchClass | undefined {
  const notes = keyNotes(key)
  const tonic = notes?.[0]
  const seventh = notes?.[6]
  if (tonic === undefined || seventh === undefined) return undefined

  const distance =
    (chromaticValue({ ...tonic, octave: 5 }) -
      chromaticValue({ ...seventh, octave: 4 }) +
      12) %
    12
  if (distance === 1) return seventh

  const raised = seventh.alteration + 1
  return isAlteration(raised) ? { letter: seventh.letter, alteration: raised } : undefined
}

export function contextOf(key: Key, event: HarmonicEvent): EventContext {
  const notes = eventNotes(event)
  const chord = eventChord(event)
  const inKey = new Set((keyNotes(key) ?? []).map(tonicKey))
  const leading = leadingNoteOf(key)

  const members = chord === undefined ? undefined : chordMembers(chord)

  return {
    event,
    notes,
    chord,
    root: chord?.root,
    fifth: members?.fifth,
    seventh: members?.seventh,
    leadingNote:
      leading !== undefined && notes.some((note) => samePitchClass(note, leading))
        ? leading
        : undefined,
    isTonic: chord !== undefined && samePitchClass(chord.root, key.tonic),
    altered: notes.filter((note) => !inKey.has(tonicKey(note))),
  }
}

function chordMembers(chord: Chord): {
  fifth: PitchClass | undefined
  seventh: PitchClass | undefined
} {
  // `chordNotes` is member-ordered — root, third, fifth, seventh — so the
  // index *is* the member.
  const notes = chordNotes(chord.root, chord.quality)
  return { fifth: notes?.[2], seventh: isSeventh(chord.quality) ? notes?.[3] : undefined }
}

/* ---------------------------------------------------------- the two shapes */

/** One chord standing still, and the two it stands between. */
export interface Move {
  from: EventContext
  to: EventContext
  before: Voicing
  after: Voicing
}

export interface Satz {
  key: Key
  events: readonly HarmonicEvent[]
  voicings: readonly Voicing[]
}

/** One chord's four notes, bass upward, which is how a staff reads them. */
export function voicingPitches(voicing: Voicing): readonly Pitch[] {
  return [voicing.bass, voicing.tenor, voicing.alto, voicing.soprano]
}
