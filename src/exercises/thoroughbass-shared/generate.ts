import {
  canonicalFigures,
  figureKey,
  figurePitches,
  parseFigureKey,
  preferredFigure,
  type Figure,
} from '@/lib/music/figuredBass'
import { getClef } from '@/lib/music/clef'
import {
  alterationInKey,
  isKeySignatureId,
  type KeySignatureId,
} from '@/lib/music/keySignature'
import {
  diatonicValue,
  letterFromDiatonicValue,
  octaveFromDiatonicValue,
  pitch,
  type Pitch,
} from '@/lib/music/pitch'
import type { PitchClass } from '@/lib/music/scale'
import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

import { voiceChord } from './voicing'

/** One bass note and everything standing under and over it. */
export interface BassEvent {
  bass: Pitch
  /**
   * Successive figures under this one bass note. One today; two is a
   * suspension, and the list is what will make that a generator and a level
   * rather than a rebuild.
   */
  figures: readonly Figure[]
  /** What each figure asks for above the bass, as written notes without octaves. */
  notes: readonly (readonly PitchClass[])[]
  /** Those notes placed on the treble staff — see `voiceChord`. */
  chord: readonly Pitch[]
}

export interface ThoroughbassQuestion {
  keySignature: KeySignatureId
  events: readonly BassEvent[]
}

/**
 * What a round may draw on. The exercises' settings satisfy this.
 *
 * Three axes and no more, which is what lets every level move exactly one of
 * them: **which figures**, **which keys**, and **how many bass notes**.
 */
export interface ThoroughbassRoundSpec {
  keySignatures: readonly KeySignatureId[]
  /** The figures this level asks about, as stored keys: `''`, `6`, `6/4`, `#3`. */
  figures: readonly string[]
  /** Bass notes per question. One is a single chord. */
  events: number
  questionsPerRound: number
}

/**
 * Where the chord sits: above middle C, so it is unmistakably the treble
 * staff's and never crowds the bass note under it.
 */
export const CHORD_FLOOR: Pitch = pitch('B', 0, 3)

/** How many bass notes to try before giving this question up as unplaceable. */
const PLACEMENT_TRIES = 24

export function allowedKeySignatures(
  spec: ThoroughbassRoundSpec,
): readonly KeySignatureId[] {
  const found = spec.keySignatures.filter(isKeySignatureId)
  return found.length === 0 ? ['0'] : found
}

export function allowedFigures(spec: ThoroughbassRoundSpec): readonly string[] {
  const found = spec.figures.filter((key) => parseFigureKey(key) !== undefined)
  return found.length === 0 ? [''] : found
}

/**
 * Every note of the key that can stand on the bass staff without a ledger line.
 *
 * **The bass belongs to the key, and that is the whole of keeping a question
 * sensible.** A figure with no accidental resolves to the notes the signature
 * spells, so a bass drawn from the key can never produce a sonority from
 * nowhere — the rule needs no table of which figure suits which degree, and
 * nothing has to be worked out again when a figure is added.
 */
export function bassNotes(keySignature: KeySignatureId): readonly Pitch[] {
  const { staffLowest, staffHighest } = getClef('bass')
  const notes: Pitch[] = []

  for (
    let step = diatonicValue(staffLowest);
    step <= diatonicValue(staffHighest);
    step += 1
  ) {
    const letter = letterFromDiatonicValue(step)
    notes.push({
      letter,
      alteration: alterationInKey(letter, keySignature),
      octave: octaveFromDiatonicValue(step),
    })
  }
  return notes
}

/** Whether every note of a chord lands where the treble staff can show it. */
function onTrebleStaff(chord: readonly Pitch[]): boolean {
  const { lowest, highest } = getClef('treble')
  return chord.every(
    (note) =>
      diatonicValue(note) >= diatonicValue(lowest) &&
      diatonicValue(note) <= diatonicValue(highest),
  )
}

/**
 * One bass note under one figure.
 *
 * **The figure the question asks is the canonical one, derived from the notes
 * rather than from what was drawn.** The level names a figure to aim for, that
 * figure is resolved against the bass, and the question then asks for whatever
 * the conventional way of writing those notes turns out to be. Doing it in that
 * order means a question can never ask for a figure that is not canonical —
 * which under canonical-required grading would be a question whose right answer
 * is marked wrong.
 */
/**
 * A bass event worked out from its bass note and its figures.
 *
 * The one place a `BassEvent` is assembled, so the generator and the attempt
 * log's way back out cannot come to disagree about what a row means. Everything
 * but the bass and the figures is derived, which is the same rule the log
 * itself follows.
 */
export function describeEvent(
  bass: Pitch,
  keySignature: KeySignatureId,
  figures: readonly Figure[],
): BassEvent | undefined {
  const notes: (readonly PitchClass[])[] = []
  for (const figure of figures) {
    const found = figurePitches(bass, keySignature, figure)
    if (found === undefined) return undefined
    notes.push(found)
  }

  const first = notes[0]
  if (first === undefined) return undefined

  // Lowest first, so the chord builds upward from the bass in close position.
  return { bass, figures, notes, chord: voiceChord(CHORD_FLOOR, [...first].reverse()) }
}

export function buildEvent(
  random: Random,
  keySignature: KeySignatureId,
  wanted: string,
): BassEvent | undefined {
  const asked = parseFigureKey(wanted)
  if (asked === undefined) return undefined

  const candidates = bassNotes(keySignature)
  if (candidates.length === 0) return undefined

  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt += 1) {
    const bass = randomPick(random, candidates as [Pitch, ...Pitch[]])
    const notes = figurePitches(bass, keySignature, asked)
    if (notes === undefined) continue

    // A third raised into a double sharp is legal and no one writes it. The
    // same reasoning as `isCleanScale`: work it out from the spelling rather
    // than keeping a list of which bass notes to avoid.
    if (notes.some((note) => Math.abs(note.alteration) > 1)) continue

    const figure = preferredFigure(bass, keySignature, notes)
    if (figure === undefined) continue

    // **The canonical form has to come out as the one the level asked for.**
    // A `♮3` in a key that already spells the third natural is not a figure at
    // all — the sign changes nothing, so the conventional way to write those
    // notes is no figure — and a level asking for one would be showing a
    // question whose answer is something else. Rather than tabulate which
    // signs suit which keys, try another bass and let the model say.
    if (figureKey(figure) !== figureKey(asked)) continue

    const event = describeEvent(bass, keySignature, [figure])
    if (event === undefined || !onTrebleStaff(event.chord)) continue

    return event
  }

  return undefined
}

export function buildQuestion(
  random: Random,
  keySignature: KeySignatureId,
  wanted: readonly string[],
): ThoroughbassQuestion | undefined {
  const events: BassEvent[] = []
  for (const figure of wanted) {
    const event = buildEvent(random, keySignature, figure)
    if (event === undefined) return undefined
    events.push(event)
  }
  return events.length === 0 ? undefined : { keySignature, events }
}

/**
 * A whole round, dealt so every figure the level names comes up.
 *
 * `dealEvenly` rather than a uniform pick, for the same reason the other
 * exercises use it: a level offering seven figures should not be able to spend
 * a round of ten on three of them.
 */
export function generateRound(
  random: Random,
  spec: ThoroughbassRoundSpec,
): ThoroughbassQuestion[] {
  const keys = allowedKeySignatures(spec)
  const figures = allowedFigures(spec)
  const events = Math.max(1, spec.events)

  const deck = dealEvenly(random, figures, spec.questionsPerRound * events)
  const questions: ThoroughbassQuestion[] = []

  for (let index = 0; index < spec.questionsPerRound; index += 1) {
    const wanted = deck.slice(index * events, (index + 1) * events)
    let question: ThoroughbassQuestion | undefined
    for (
      let attempt = 0;
      attempt < PLACEMENT_TRIES && question === undefined;
      attempt += 1
    ) {
      question = buildQuestion(
        random,
        randomPick(random, keys as [KeySignatureId, ...KeySignatureId[]]),
        wanted,
      )
    }
    if (question !== undefined) questions.push(question)
  }

  return questions
}

/** Whether a written figure is one the question would accept. */
export function acceptsFigure(
  question: ThoroughbassQuestion,
  index: number,
  position: number,
  written: Figure,
): boolean {
  const event = question.events[index]
  const notes = event?.notes[position]
  if (event === undefined || notes === undefined) return false

  return canonicalFigures(event.bass, question.keySignature, notes, {
    afterAnother: position > 0,
  }).some((figure) => figureKey(figure) === figureKey(written))
}
