import { getClef, type ClefId } from '@/lib/music/clef'
import {
  DEGREE_NUMBERS,
  degreeNotes,
  degreePitch,
  isScaleNote,
  keySignatureFor,
  nameMelody,
  type Degree,
  type DegreeAlteration,
  type DegreeNote,
} from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import {
  fittingOctaves,
  isCleanScale,
  isModeId,
  parseTonicKey,
  type ModeId,
  type PitchClass,
} from '@/lib/music/scale'
import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

/**
 * Question generation for scale degree identification.
 *
 * A key, a tonic triad to put it in the ear, and a short melody drawn from that
 * one scale. The melody has no rhythm — what is being asked is *which note*,
 * and a rhythm on top of it would be a second question.
 */

export interface DegreeQuestion {
  /** With its octave: the melody sits in the octave above this. */
  tonic: Pitch
  mode: ModeId
  clef: ClefId
  /** Derived from the tonic and mode, and carried so notation is one lookup. */
  keySignature: KeySignatureId
  /** The melody, as the answer would give it. */
  degrees: readonly Degree[]
  /** The notes those degrees name, in the order they sound. */
  pitches: readonly Pitch[]
}

/** What a round may draw on. The exercise's settings satisfy this. */
export interface DegreeRoundSpec {
  modes: readonly ModeId[]
  /** Tonic keys, e.g. `Bb`. */
  tonics: readonly string[]
  clefs: readonly ClefId[]
  /** Which degree numbers may appear. A level may offer only the first five. */
  degrees: readonly number[]
  /** Whether a note may be raised or lowered out of the scale. */
  alterations: boolean
  /** How many notes the melody has. */
  melodyLength: number
  /** Whether the melody always opens on the tonic. */
  startOnTonic: boolean
  questionsPerRound: number
}

/**
 * How often an altered note comes up on a level that allows them.
 *
 * Occasional on purpose. A melody where every other note is chromatic stops
 * being a melody in a key, which is the thing the degrees are heard against.
 */
const ALTERATION_CHANCE = 0.22

export function allowedModes(spec: DegreeRoundSpec): readonly ModeId[] {
  return spec.modes.filter(isModeId)
}

export function allowedTonics(spec: DegreeRoundSpec): readonly PitchClass[] {
  return spec.tonics
    .map(parseTonicKey)
    .filter((tonic): tonic is PitchClass => tonic !== undefined)
}

/** The degree numbers a spec offers, in order and without strays. */
export function allowedDegrees(spec: DegreeRoundSpec): readonly number[] {
  return DEGREE_NUMBERS.filter((number) => spec.degrees.includes(number))
}

export function allowedAlterations(spec: DegreeRoundSpec): readonly DegreeAlteration[] {
  return spec.alterations ? [-1, 0, 1] : [0]
}

/**
 * Where a key can sit so the whole octave above its tonic is on the staff.
 *
 * The melody never leaves that octave, so this is the whole of the range
 * question — and it is the same one a scale asks, so it is the same helper.
 */
function placements(
  mode: ModeId,
  clefId: ClefId,
  tonics: readonly PitchClass[],
): readonly Pitch[] {
  const clef = getClef(clefId)

  return tonics
    .filter((tonic) => isCleanScale(tonic, mode))
    .flatMap((tonic) =>
      fittingOctaves(tonic, mode, clef.lowest, clef.highest).map((octave) => ({
        ...tonic,
        octave,
      })),
    )
    .filter((tonic) => keySignatureFor(tonic, mode) !== undefined)
}

/**
 * One melody, as a run of notes.
 *
 * **Notes, not names.** What is drawn here is sounding pitches — see
 * `degreeNotes` — so the melody cannot contain a note the level does not
 * reach, nor one whose only name is a spelling of a note it already has. The
 * names are chosen afterwards, once the whole line is known and its direction
 * can decide them.
 *
 * Notes are drawn one at a time rather than dealt evenly: a melody is a
 * sequence, not a survey, and forcing it to cover the offered degrees would
 * make every question the same shape. Immediate repeats are skipped, since a
 * note repeated is a note not asked about.
 */
function buildMelody(
  random: Random,
  tonic: Pitch,
  mode: ModeId,
  spec: DegreeRoundSpec,
): readonly DegreeNote[] | undefined {
  const offered = degreeNotes(tonic, mode, allowedDegrees(spec), allowedAlterations(spec))
  const plain = offered.filter(isScaleNote)
  if (plain.length === 0) return undefined

  const melody: DegreeNote[] = []

  for (let index = 0; index < spec.melodyLength; index += 1) {
    if (index === 0 && spec.startOnTonic) {
      const home = plain.find((note) => note.semitones === 0)
      if (home !== undefined) {
        melody.push(home)
        continue
      }
    }

    // Altered notes are the exception, so they are drawn against a chance
    // rather than sitting in the pool as equals with the scale's own notes.
    const chromatic = offered.filter((note) => !isScaleNote(note))
    const pool = chromatic.length > 0 && random() < ALTERATION_CHANCE ? chromatic : plain

    const previous = melody[melody.length - 1]
    const choices = pool.filter(
      (note) => previous === undefined || note.semitones !== previous.semitones,
    )

    const [first, ...rest] = choices.length > 0 ? choices : pool
    if (first === undefined) return undefined
    melody.push(randomPick(random, [first, ...rest]))
  }

  return melody
}

export function buildQuestion(
  random: Random,
  mode: ModeId,
  spec: DegreeRoundSpec,
): DegreeQuestion | undefined {
  const tonics = allowedTonics(spec)
  if (tonics.length === 0 || spec.clefs.length === 0) return undefined

  // A mode may not fit every clef, so try a few pairings before giving up on
  // the question rather than dropping it from the round.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
    const options = placements(mode, clef, tonics)
    const [first, ...rest] = options
    if (first === undefined) continue

    const tonic = randomPick(random, [first, ...rest])
    const keySignature = keySignatureFor(tonic, mode)
    const notes = buildMelody(random, tonic, mode, spec)
    if (keySignature === undefined || notes === undefined) continue

    const degrees = nameMelody(tonic, mode, notes)
    const pitches = degrees.map((degree) => degreePitch(tonic, mode, degree))
    // `degreeNotes` only ever collects degrees that spell, so this cannot
    // fail — it is here so the type says so rather than an assertion.
    if (!pitches.every((pitch): pitch is Pitch => pitch !== undefined)) continue

    return { tonic, mode, clef, keySignature, degrees, pitches }
  }

  return undefined
}

/**
 * Generate a whole round up front.
 *
 * The modes are dealt evenly so a level offering three of them asks all three,
 * rather than leaving one out of a round of ten by chance.
 */
export function generateRound(random: Random, spec: DegreeRoundSpec): DegreeQuestion[] {
  const modes = allowedModes(spec)

  if (
    modes.length === 0 ||
    allowedTonics(spec).length === 0 ||
    allowedDegrees(spec).length === 0 ||
    spec.clefs.length === 0 ||
    spec.melodyLength < 1
  ) {
    return []
  }

  return dealEvenly(random, modes, spec.questionsPerRound).flatMap((mode) => {
    const question = buildQuestion(random, mode, spec)
    return question === undefined ? [] : [question]
  })
}
