import type { MetronomeMode } from '@/lib/audio/rhythmSchedule'
import { buildBar, type BarSpec } from '@/exercises/dictation-shared/bar'
import { getClef, type ClefId } from '@/lib/music/clef'
import {
  degreePitch,
  keySignatureFor,
  isScaleNote,
  nameMelody,
  stepNotes,
  type Degree,
  type DegreeAlteration,
  type DegreeNote,
} from '@/lib/music/degree'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { parseMeter, type TimeSignature } from '@/lib/music/meter'
import { chromaticValue, diatonicValue, type Pitch } from '@/lib/music/pitch'
import { impactCount, opensOnDownbeat, type Phrase } from '@/lib/music/phrase'
import type { CellWeights } from '@/lib/music/rhythmCells'
import {
  isCleanScale,
  isModeId,
  parseTonicKey,
  type ModeId,
  type PitchClass,
} from '@/lib/music/scale'
import {
  dealEvenly,
  randomPick,
  weightedPick,
  type Random,
} from '@/lib/utils/seededRandom'

import { rangeSteps } from './settings'

/**
 * Question generation for melodic dictation.
 *
 * A key, a phrase of bars, and a note on each impact. Both halves come from
 * where they already lived: the bars are `buildBar`'s, one at a time, exactly
 * as rhythmic dictation builds its one; the notes are drawn from `stepNotes`,
 * exactly as scale degrees draws its melody. What is new here is only how they
 * are put together, and one rule about the shape of a line.
 */

export interface MelodyQuestion {
  /** With its octave: the range is laid out around this. */
  tonic: Pitch
  mode: ModeId
  clef: ClefId
  /** Derived from the tonic and mode, and carried so notation is one lookup. */
  keySignature: KeySignatureId
  /** When the impacts fall, bar by bar. */
  phrase: Phrase
  /** The melody as the answer would give it, one degree per impact. */
  degrees: readonly Degree[]
  /** The notes those degrees name, in the order they sound. */
  pitches: readonly Pitch[]
  /** Beats per minute it is played at. */
  tempo: number
  metronome: MetronomeMode
  /** How many bars share a system — the notation's, not the music's. */
  barsPerSystem: number
}

/** What a round may draw on. The exercise's settings satisfy this. */
export interface MelodyRoundSpec {
  modes: readonly ModeId[]
  tonics: readonly string[]
  clefs: readonly ClefId[]
  low: string
  high: string
  alterations: boolean
  meters: readonly string[]
  cellWeights: CellWeights
  bars: number
  tempo: number
  metronome: MetronomeMode
  /** Fewest impacts per bar. */
  minOnsets: number
  questionsPerRound: number
}

/**
 * **One bar to a system, always.**
 *
 * The page reserves the widest bar a player could type, so two of those side
 * by side halve the staff. A phrase is read down the page instead, which is
 * how a short piece is written anyway.
 */
export const BARS_PER_SYSTEM = 1

/**
 * How often an altered note comes up on a level that allows them.
 *
 * Occasional on purpose, and for the same reason as in scale degrees: a melody
 * where every other note is chromatic stops being a melody in a key, which is
 * the thing the notes are heard against.
 */
const ALTERATION_CHANCE = 0.18

/**
 * How likely the next note is, by how far it is from the last one.
 *
 * **This is what makes a generated line a melody rather than a list of
 * pitches.** Drawing uniformly from a range of nine notes gives a leap on
 * almost every note, which is both unmusical and far harder to hear than the
 * level claims to be — the difficulty would come from the leaps rather than
 * from the subdivisions or the degrees the level actually names. Seconds are
 * therefore common, thirds ordinary, and anything wider rare.
 *
 * A repeated note is allowed and uncommon. Unlike in scale degrees, where a
 * repeat is a note not asked about, here the rhythm distinguishes them: two
 * notes on the same pitch a beat apart are two things to write down.
 */
const MOTION_WEIGHTS: readonly { within: number; weight: number }[] = [
  { within: 0, weight: 1.5 },
  { within: 2, weight: 8 },
  { within: 4, weight: 5 },
  { within: 7, weight: 2 },
  { within: 12, weight: 0.8 },
]
const FAR_WEIGHT = 0.2

function motionWeight(from: DegreeNote, to: DegreeNote): number {
  const distance = Math.abs(to.semitones - from.semitones)
  return MOTION_WEIGHTS.find((step) => distance <= step.within)?.weight ?? FAR_WEIGHT
}

export function allowedModes(spec: MelodyRoundSpec): readonly ModeId[] {
  return spec.modes.filter(isModeId)
}

export function allowedTonics(spec: MelodyRoundSpec): readonly PitchClass[] {
  return spec.tonics
    .map(parseTonicKey)
    .filter((tonic): tonic is PitchClass => tonic !== undefined)
}

/** The steps a level offers, which is also one key each on the keyboard. */
export function allowedSteps(spec: MelodyRoundSpec): readonly Degree[] {
  return rangeSteps(spec.low, spec.high)
}

export function allowedAlterations(spec: MelodyRoundSpec): readonly DegreeAlteration[] {
  return spec.alterations ? [-1, 0, 1] : [0]
}

/** The meters a spec actually permits. */
export function allowedMeters(spec: MelodyRoundSpec): readonly TimeSignature[] {
  return spec.meters
    .map(parseMeter)
    .filter((meter): meter is TimeSignature => meter !== undefined)
}

/**
 * Where a key can sit so the **whole range** is on the staff.
 *
 * The scale's own octave is not the question here: a level reaching a fifth
 * below the tonic needs that fifth drawable, and one reaching the octave above
 * needs that. So the ends of the range are what is checked, not the ends of the
 * scale — which is the same reasoning `fittingOctaves` applies to a scale, read
 * off the thing that actually has to fit.
 */
function placements(
  mode: ModeId,
  clefId: ClefId,
  tonics: readonly PitchClass[],
  steps: readonly Degree[],
): readonly Pitch[] {
  const clef = getClef(clefId)
  const [lowest] = steps
  const highest = steps[steps.length - 1]
  if (lowest === undefined || highest === undefined) return []

  const fits = (pitch: Pitch | undefined): pitch is Pitch =>
    pitch !== undefined &&
    chromaticValue(pitch) >= chromaticValue(clef.lowest) &&
    chromaticValue(pitch) <= chromaticValue(clef.highest) &&
    diatonicValue(pitch) >= diatonicValue(clef.lowest) &&
    diatonicValue(pitch) <= diatonicValue(clef.highest)

  return tonics
    .filter((tonic) => isCleanScale(tonic, mode))
    .flatMap((tonic) =>
      // The tonic's own octave is unconstrained, so every octave the clef
      // could possibly hold is tried and the range decides.
      Array.from({ length: 9 }, (_, octave) => ({ ...tonic, octave })),
    )
    .filter(
      (tonic) =>
        keySignatureFor(tonic, mode) !== undefined &&
        fits(degreePitch(tonic, mode, lowest)) &&
        fits(degreePitch(tonic, mode, highest)),
    )
}

/**
 * The bars of a phrase.
 *
 * Each is `buildBar`'s, untouched: rhythmic dictation's bar is what a bar is,
 * and melodic dictation asking for several of them changes nothing about how
 * one is made. `minOnsets` is therefore **per bar** rather than per phrase,
 * which is what makes a level's floor mean the same thing at one bar and at
 * four.
 *
 * A bar may never open in silence, in any bar of the phrase. Bar one has to
 * open with the note that is given away; the later bars could open in silence
 * and do not, because a phrase whose second bar starts on a rest is a phrase
 * whose player has nothing to hold the barline by.
 */
function buildPhrase(
  random: Random,
  meter: TimeSignature,
  spec: MelodyRoundSpec,
): Phrase | undefined {
  const barSpec: BarSpec = {
    cellWeights: spec.cellWeights,
    minOnsets: spec.minOnsets,
    allowInitialRest: false,
  }

  const bars: (readonly number[])[] = []
  for (let bar = 0; bar < spec.bars; bar += 1) {
    const built = buildBar(random, meter, barSpec)
    if (built === undefined) return undefined
    bars.push(built.onsets)
  }

  return { meter, bars }
}

/**
 * The notes of the melody, one per impact.
 *
 * **Notes, not names** — see `stepNotes`. What is drawn is sounding pitches, so
 * the melody cannot contain a note the range does not reach, nor one whose only
 * name is a second spelling of a note it already has. The names are chosen
 * afterwards, once the whole line is known and its direction can decide them.
 */
function buildLine(
  random: Random,
  tonic: Pitch,
  mode: ModeId,
  spec: MelodyRoundSpec,
  length: number,
): readonly DegreeNote[] | undefined {
  const offered = stepNotes(tonic, mode, allowedSteps(spec), allowedAlterations(spec))
  const plain = offered.filter(isScaleNote)
  if (plain.length === 0 || length === 0) return undefined

  // The opening note is given away, so it is worth it being one the key is
  // easy to reckon from: a member of the tonic triad if the range holds one.
  const anchors = plain.filter((note) => {
    const above = ((note.semitones % 12) + 12) % 12
    return above === 0 || above === 3 || above === 4 || above === 7
  })
  const opening = anchors.length > 0 ? anchors : plain
  const [firstChoice, ...restChoices] = opening
  if (firstChoice === undefined) return undefined

  const line: DegreeNote[] = [randomPick(random, [firstChoice, ...restChoices])]

  for (let index = 1; index < length; index += 1) {
    // Altered notes are the exception, so they are drawn against a chance
    // rather than sitting in the pool as equals with the scale's own notes.
    const chromatic = offered.filter((note) => !isScaleNote(note))
    const pool = chromatic.length > 0 && random() < ALTERATION_CHANCE ? chromatic : plain

    const previous = line[line.length - 1] as DegreeNote
    const next = weightedPick(random, pool, (note) => motionWeight(previous, note))
    if (next === undefined) return undefined
    line.push(next)
  }

  return line
}

export function buildQuestion(
  random: Random,
  meter: TimeSignature,
  mode: ModeId,
  spec: MelodyRoundSpec,
): MelodyQuestion | undefined {
  const tonics = allowedTonics(spec)
  const steps = allowedSteps(spec)
  if (tonics.length === 0 || spec.clefs.length === 0 || steps.length === 0) {
    return undefined
  }

  // A mode may not fit every clef at every range, so try a few pairings before
  // giving up on the question rather than dropping it from the round.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
    const options = placements(mode, clef, tonics, steps)
    const [first, ...rest] = options
    if (first === undefined) continue

    const tonic = randomPick(random, [first, ...rest])
    const keySignature = keySignatureFor(tonic, mode)
    const phrase = buildPhrase(random, meter, spec)
    if (keySignature === undefined || phrase === undefined) continue

    // The first note is shown, so a phrase has to have somewhere to show it —
    // and something left over to be asked about once it has.
    if (!opensOnDownbeat(phrase) || impactCount(phrase) < 2) continue

    const line = buildLine(random, tonic, mode, spec, impactCount(phrase))
    if (line === undefined) continue

    const degrees = nameMelody(tonic, mode, line)
    const pitches = degrees.map((degree) => degreePitch(tonic, mode, degree))
    // `stepNotes` only ever collects degrees that spell, so this cannot fail —
    // it is here so the type says so rather than an assertion.
    if (!pitches.every((pitch): pitch is Pitch => pitch !== undefined)) continue

    return {
      tonic,
      mode,
      clef,
      keySignature,
      phrase,
      degrees,
      pitches,
      tempo: spec.tempo,
      metronome: spec.metronome,
      barsPerSystem: BARS_PER_SYSTEM,
    }
  }

  return undefined
}

/**
 * Generate a whole round up front.
 *
 * Both the modes and the metres are dealt evenly, so a level offering three of
 * either asks all three rather than leaving one out of a round of ten by
 * chance.
 */
export function generateRound(random: Random, spec: MelodyRoundSpec): MelodyQuestion[] {
  const modes = allowedModes(spec)
  const meters = allowedMeters(spec)

  if (
    modes.length === 0 ||
    meters.length === 0 ||
    allowedTonics(spec).length === 0 ||
    allowedSteps(spec).length === 0 ||
    spec.clefs.length === 0
  ) {
    return []
  }

  const byMode = dealEvenly(random, modes, spec.questionsPerRound)
  const byMeter = dealEvenly(random, meters, spec.questionsPerRound)

  return byMode.flatMap((mode, index) => {
    const meter = byMeter[index] ?? byMeter[0]
    if (meter === undefined) return []
    const question = buildQuestion(random, meter, mode, spec)
    return question === undefined ? [] : [question]
  })
}
