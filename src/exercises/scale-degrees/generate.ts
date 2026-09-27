import { getClef, type ClefId } from '@/lib/music/clef'
import {
  degreePitch,
  isScaleNote,
  keySignatureFor,
  nameMelody,
  parseDegreeKey,
  stepIndex,
  stepNotes,
  type Degree,
  type DegreeAlteration,
  type DegreeNote,
} from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { chromaticValue, diatonicValue, type Pitch } from '@/lib/music/pitch'
import {
  fittingOctaves,
  isCleanScale,
  isMelodyModeId,
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
  /** With its octave: every step of the melody is counted from this. */
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
  /**
   * Which steps may appear, as degree keys with their octave: `1` is the
   * tonic, `7_` the seventh *below* it and `1'` the octave above. A level may
   * offer only the first five, or the first five and the leading note beneath.
   */
  degrees: readonly string[]
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

/**
 * The modes a spec permits — and melodic minor is never one of them.
 *
 * `isMelodyModeId` rather than `isModeId`: this exercise puts a key in the
 * ear and then wanders about inside it, and melodic minor's sixth and seventh
 * depend on which way the line is going, which a melody with no fixed
 * direction cannot say. Enforced here rather than only in the settings form,
 * so no caller can ask for one.
 */
export function allowedModes(spec: DegreeRoundSpec): readonly ModeId[] {
  return spec.modes.filter(isMelodyModeId)
}

export function allowedTonics(spec: DegreeRoundSpec): readonly PitchClass[] {
  return spec.tonics
    .map(parseTonicKey)
    .filter((tonic): tonic is PitchClass => tonic !== undefined)
}

/**
 * The steps a spec offers, low to high, plain and without strays.
 *
 * **Octave-specific**, and that is the point: the seventh below the tonic and
 * the seventh above it are different notes to hear and different keys to
 * press, and a melody that dips under its tonic to the leading note is as
 * ordinary as one that climbs to the fifth.
 */
export function allowedSteps(spec: DegreeRoundSpec): readonly Degree[] {
  const seen = new Set<number>()
  return spec.degrees
    .map(parseDegreeKey)
    .filter((step): step is Degree => step !== undefined && step.alteration === 0)
    .filter((step) => {
      const rung = stepIndex(step)
      if (seen.has(rung)) return false
      seen.add(rung)
      return true
    })
    .sort((a, b) => stepIndex(a) - stepIndex(b))
}

export function allowedAlterations(spec: DegreeRoundSpec): readonly DegreeAlteration[] {
  return spec.alterations ? [-1, 0, 1] : [0]
}

/**
 * Where a key can sit so its tonic's octave, and every step the level reaches
 * outside it, is on the staff.
 *
 * The octave above the tonic always has to fit — that is the same question a
 * scale asks, so it is the same helper — and a level reaching below the tonic
 * or past its octave then narrows that further by its outermost steps.
 */
function placements(
  mode: ModeId,
  clefId: ClefId,
  tonics: readonly PitchClass[],
  steps: readonly Degree[],
): readonly Pitch[] {
  const clef = getClef(clefId)
  const onStaff = (pitch: Pitch | undefined) =>
    pitch !== undefined &&
    chromaticValue(pitch) >= chromaticValue(clef.lowest) &&
    chromaticValue(pitch) <= chromaticValue(clef.highest) &&
    diatonicValue(pitch) >= diatonicValue(clef.lowest) &&
    diatonicValue(pitch) <= diatonicValue(clef.highest)

  const lowest = steps[0]
  const highest = steps[steps.length - 1]

  return tonics
    .filter((tonic) => isCleanScale(tonic, mode))
    .flatMap((tonic) =>
      fittingOctaves(tonic, mode, clef.lowest, clef.highest).map((octave) => ({
        ...tonic,
        octave,
      })),
    )
    .filter(
      (tonic) =>
        (lowest === undefined || onStaff(degreePitch(tonic, mode, lowest))) &&
        (highest === undefined || onStaff(degreePitch(tonic, mode, highest))),
    )
    .filter((tonic) => keySignatureFor(tonic, mode) !== undefined)
}

/**
 * One melody, as a run of notes.
 *
 * **Notes, not names.** What is drawn here is sounding pitches — see
 * `stepNotes` — so the melody cannot contain a note the level does not
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
  const offered = stepNotes(tonic, mode, allowedSteps(spec), allowedAlterations(spec))
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
    const options = placements(mode, clef, tonics, allowedSteps(spec))
    const [first, ...rest] = options
    if (first === undefined) continue

    const tonic = randomPick(random, [first, ...rest])
    const keySignature = keySignatureFor(tonic, mode)
    const notes = buildMelody(random, tonic, mode, spec)
    if (keySignature === undefined || notes === undefined) continue

    const degrees = nameMelody(tonic, mode, notes)
    const pitches = degrees.map((degree) => degreePitch(tonic, mode, degree))
    // `stepNotes` only ever collects degrees that spell, so this cannot
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
    allowedSteps(spec).length === 0 ||
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
