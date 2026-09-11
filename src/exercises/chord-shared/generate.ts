import {
  chordPitches,
  chordSize,
  cleanRoots,
  closePosition,
  fitsClef,
  hearableInversions,
  inversionsFor,
  isCleanChord,
  topsFor,
  type Chord,
  type ChordQuality,
} from '@/lib/music/chord'
import type { ClefId } from '@/lib/music/clef'
import type { PlayDirection } from '@/lib/music/direction'
import type { Pitch } from '@/lib/music/pitch'
import { parseTonicKey, tonicKey, type PitchClass } from '@/lib/music/scale'
import { dealEvenly, randomPick, type Random } from '@/lib/utils/seededRandom'

import type { ChordSettings } from './settings'

/**
 * Question generation, shared by all three chord exercises.
 *
 * Reading, hearing and writing ask the generator for the same thing — a chord,
 * spelled, standing a particular way, placed where a clef can show it — and
 * differ only in which end of it the player is given. One generator means a
 * spelling bug can only exist in one place.
 */

/** What the answer is actually made of, which the question decides. */
export interface ChordAsks {
  /** Name the root. Reading only: a chord in isolation has no audible one. */
  root: boolean
  /** Name which member is in the bass. */
  inversion: boolean
  /** Name which member is on top. */
  lage: boolean
}

export interface ChordQuestion {
  chord: Chord
  clef: ClefId
  direction: PlayDirection
  /** The chord placed on the staff, from the bass up. */
  pitches: readonly Pitch[]
  /**
   * Which rows the keyboard shows and the verdict reads.
   *
   * Carried on the **question** rather than worked out again beside it, so the
   * keyboard, the grading and the summary cannot come to disagree about what
   * was being asked. It is also where the one rule an ear imposes lands: a
   * symmetric chord has no audible inversion, so by ear it is simply not one
   * of the things asked about.
   */
  asks: ChordAsks
}

/**
 * What a round may draw on, with the two things the exercise fixes rather than
 * the level.
 */
export interface ChordRoundSpec extends ChordSettings {
  /**
   * Whether the chord is heard rather than seen. Narrows which inversions can
   * honestly be asked for — see `hearableInversions`.
   */
  byEar: boolean
  /** Whether the answer names the root. Reading only. */
  namesRoot: boolean
}

const PLACEMENT_TRIES = 40

/** The roots a level offers that this quality can actually be spelled on. */
export function allowedRoots(
  spec: ChordRoundSpec,
  quality: ChordQuality,
): readonly PitchClass[] {
  const wanted = new Set(spec.roots)
  const found = cleanRoots(quality).filter((root) => wanted.has(tonicKey(root)))
  // A level naming only roots this quality cannot stand on would otherwise
  // serve a short round in silence; falling back to every clean root is the
  // same call `allowedFigures` makes for an empty figure list.
  return found.length > 0 ? found : cleanRoots(quality)
}

/**
 * The inversions this round can honestly ask this quality for.
 *
 * Two narrowings, and they compose: what the level offers, and what an ear can
 * tell apart. **Whether the inversion is asked at all falls out of the same
 * list** — one entry is not a question, it is a row with a single key on it.
 */
export function availableInversions(
  spec: ChordRoundSpec,
  quality: ChordQuality,
): readonly number[] {
  const byEar = spec.byEar ? hearableInversions(quality) : inversionsFor(quality)
  const found = byEar.filter((inversion) => spec.inversions.includes(inversion))
  // A level asking for third inversions and offering triads has none to draw;
  // root position is always available and is what it falls back to.
  return found.length > 0 ? found : [0]
}

/** What the answer is made of for a given quality under these settings. */
export function asksFor(spec: ChordRoundSpec, chord: Chord): ChordAsks {
  return {
    root: spec.namesRoot && spec.roots.length > 1,
    inversion: availableInversions(spec, chord.quality).length > 1,
    lage: spec.lage && topsFor(chord.quality, chord.inversion).length > 1,
  }
}

/**
 * Which rows the naming keyboard offers.
 *
 * **Read off the round rather than off the question**, and that is not a
 * detail: `asksFor` answers per quality, and a row that appeared for some
 * questions and not others would tell the player which quality it was before
 * they had named it. A symmetric chord has no audible inversion, so the row
 * stays on the screen and simply stops being required the moment the quality
 * is chosen — which is a thing the player learns rather than a tell.
 */
export function keyboardRows(spec: ChordRoundSpec): ChordAsks {
  return {
    root: spec.namesRoot && spec.roots.length > 1,
    inversion: spec.qualities.some(
      (quality) => availableInversions(spec, quality).length > 1,
    ),
    lage: spec.lage,
  }
}

/**
 * One question for a given quality.
 *
 * Tries roots and clefs until the whole chord lands where the staff can show
 * it. A chord voiced to its lowest Lage spans a tenth, which not every root
 * will fit in every clef, so this is a search rather than a construction —
 * exactly what `buildQuestion` does for an interval.
 */
export function buildQuestion(
  random: Random,
  spec: ChordRoundSpec,
  quality: ChordQuality,
): ChordQuestion | undefined {
  const roots = allowedRoots(spec, quality)
  const inversions = availableInversions(spec, quality)
  if (roots.length === 0 || spec.clefs.length === 0) return undefined

  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt += 1) {
    const root = randomPick(random, roots as [PitchClass, ...PitchClass[]])
    if (!isCleanChord(root, quality)) continue

    const inversion = randomPick(random, inversions as [number, ...number[]])
    const tops = spec.lage
      ? topsFor(quality, inversion)
      : [closePosition(quality, inversion)]
    const top = randomPick(random, tops as [number, ...number[]])

    const chord: Chord = { root, quality, inversion, top }
    const clef = randomPick(random, spec.clefs as [ClefId, ...ClefId[]])
    if (!fitsClef(chord, clef)) continue

    const pitches = chordPitches(chord, clef)
    if (pitches === undefined || pitches.length !== chordSize(quality)) continue

    return {
      chord,
      clef,
      direction: randomPick(
        random,
        spec.directions as [PlayDirection, ...PlayDirection[]],
      ),
      pitches,
      asks: asksFor(spec, chord),
    }
  }

  return undefined
}

/**
 * A whole round, dealt so every quality the level names comes up.
 *
 * `dealEvenly` rather than a uniform pick, for the reason every other exercise
 * uses it: a level offering nine qualities should not be able to spend a round
 * of ten on three of them.
 */
export function generateRound(random: Random, spec: ChordRoundSpec): ChordQuestion[] {
  if (spec.qualities.length === 0) return []

  const deck = dealEvenly(random, spec.qualities, spec.questionsPerRound)
  const questions: ChordQuestion[] = []

  for (const quality of deck) {
    const question = buildQuestion(random, spec, quality)
    if (question !== undefined) questions.push(question)
  }

  return questions
}

/** The roots a level offers, as pitch classes, for the naming keyboard. */
export function rootChoices(spec: ChordRoundSpec): readonly PitchClass[] {
  return spec.roots
    .map(parseTonicKey)
    .filter((root): root is PitchClass => root !== undefined)
}
