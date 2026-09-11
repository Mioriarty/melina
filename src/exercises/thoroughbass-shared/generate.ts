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
  /** Those notes placed on the treble staff, one chord per figure. */
  chords: readonly (readonly Pitch[])[]
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
  /**
   * Suspensions, as the pair of figures they are written with: `4-3`.
   *
   * A separate axis from `figures` because it is a separate axis: a suspension
   * is not a harder figure but **two figures under one bass note**, which is
   * span rather than vocabulary. The dash is the one a suspension is written
   * with anyway, and the same one the keyboard types it with.
   */
  suspensions: readonly string[]
  /** Bass notes per question. One is a single chord. */
  events: number
  questionsPerRound: number
}

/**
 * Where a chord starts: just under middle C, so the lowest note it can take is
 * middle C itself — one ledger line under the treble staff, which is ordinary
 * notation rather than something to avoid.
 *
 * **The floor also decides where the keyboard's row of keys wraps**, because
 * each key draws the note at the place pressing it would put it. With a B the
 * wrap falls between B and C, which is the end of the row and invisible; raised
 * to a D it fell between D and E, and the row read C and D an octave above
 * everything after them. The ceiling is checked separately by `onTrebleStaff`.
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
  const found = [...spec.figures, ...spec.suspensions].filter(
    (key) => parseWanted(key) !== undefined,
  )
  return found.length === 0 ? [''] : found
}

/**
 * A level's vocabulary entry as the figures it stands for.
 *
 * One figure, or the two of a suspension split on the dash they are written
 * with. `undefined` for anything that will not parse, which is what keeps a
 * stale stored setting from reaching the generator.
 */
export function parseWanted(key: string): readonly Figure[] | undefined {
  const parts = key.split('-')
  const figures: Figure[] = []
  for (const part of parts) {
    const figure = parseFigureKey(part)
    if (figure === undefined) return undefined
    figures.push(figure)
  }
  return figures.length === 0 ? undefined : figures
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

  if (notes.length === 0) return undefined

  // Lowest first, so each chord builds upward from the bass in close position.
  // Every one is voiced from the same floor, so two chords under one bass can
  // be read against each other rather than drifting apart.
  const chords = notes.map((chord) => voiceChord(CHORD_FLOOR, [...chord].reverse()))
  return { bass, figures, notes, chords }
}

export function buildEvent(
  random: Random,
  keySignature: KeySignatureId,
  wanted: string,
): BassEvent | undefined {
  const asked = parseWanted(wanted)
  if (asked === undefined) return undefined

  const candidates = bassNotes(keySignature)
  if (candidates.length === 0) return undefined

  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt += 1) {
    const bass = randomPick(random, candidates as [Pitch, ...Pitch[]])
    const event = placeOn(bass, keySignature, asked)
    if (event !== undefined) return event
  }

  return undefined
}

/** One bass note tried against the figures a level asked for. */
function placeOn(
  bass: Pitch,
  keySignature: KeySignatureId,
  asked: readonly Figure[],
): BassEvent | undefined {
  const written: Figure[] = []
  let previous: readonly PitchClass[] | undefined

  for (const [position, figure] of asked.entries()) {
    const notes = figurePitches(bass, keySignature, figure)
    if (notes === undefined) return undefined

    // A third raised into a double sharp is legal and no one writes it. The
    // same reasoning as `isCleanScale`: work it out from the spelling rather
    // than keeping a list of which bass notes to avoid.
    if (notes.some((note) => Math.abs(note.alteration) > 1)) return undefined

    const preferred = preferredFigure(bass, keySignature, notes, {
      afterAnother: position > 0,
      ...(previous === undefined ? {} : { previous }),
    })
    if (preferred === undefined) return undefined

    // **The canonical form has to come out as the one the level asked for.**
    // A `♮3` in a key that already spells the third natural is not a figure at
    // all — the sign changes nothing, so the conventional way to write those
    // notes is no figure — and a level asking for one would be showing a
    // question whose answer is something else. For the second half of a
    // suspension the same check does a second job: a resolution that moved
    // nothing has no difference form, so it cannot come out as the figure that
    // was asked for and the bass is refused.
    if (figureKey(preferred) !== figureKey(figure)) return undefined

    written.push(preferred)
    previous = notes
  }

  const event = describeEvent(bass, keySignature, written)
  return event === undefined || !event.chords.every(onTrebleStaff) ? undefined : event
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

/**
 * Every note a question sounds, bass and chords together.
 *
 * A suspension sounds as one chord — the held note and its resolution at once
 * — rather than as two in succession, because what is being asked about is
 * which notes the figures name and not how they are played. `playChord` takes
 * the lot and sounds them together.
 */
export function soundingNotes(question: ThoroughbassQuestion): readonly Pitch[] {
  return question.events.flatMap((event) => [event.bass, ...event.chords.flat()])
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

  // What stood under the same bass a moment ago, which is what lets the
  // resolution of a suspension be written as the line that moved — `4 3`
  // rather than `4` and then a figure for the whole triad under it.
  const previous = position > 0 ? event.notes[position - 1] : undefined

  return canonicalFigures(event.bass, question.keySignature, notes, {
    afterAnother: position > 0,
    ...(previous === undefined ? {} : { previous }),
  }).some((figure) => figureKey(figure) === figureKey(written))
}
