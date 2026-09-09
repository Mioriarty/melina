import type { MetronomeMode } from '@/lib/audio/rhythmSchedule'
import { TICKS_PER_BEAT, parseMeter, type TimeSignature } from '@/lib/music/meter'
import type { Rhythm } from '@/lib/music/rhythm'
import {
  CELL_GROUP_IDS,
  RHYTHM_CELLS,
  cellTicks,
  cellsInGroup,
  isTupletCell,
  startsSilent,
  type CellGroupId,
  type CellWeights,
  type RhythmCell,
} from '@/lib/music/rhythmCells'
import {
  dealEvenly,
  randomPick,
  weightedPick,
  type Random,
} from '@/lib/utils/seededRandom'

/**
 * Building a bar, one beat at a time.
 *
 * The unit of randomness is the beat rather than the grid point, and that is
 * what makes the whole thing work: tuplets are simply cells with a division of
 * 3 or 5, so nothing here has a special case for them, and because a cell never
 * crosses a beat, no rhythm ever needs a tie to write down.
 */

export interface RhythmQuestion {
  rhythm: Rhythm
  /** Beats per minute it is played at. */
  tempo: number
  metronome: MetronomeMode
}

/** What a round may draw on. The exercise's settings satisfy this. */
export interface RhythmRoundSpec {
  /** Meter keys, e.g. `4/4`. */
  meters: readonly string[]
  cellWeights: CellWeights
  tempo: number
  metronome: MetronomeMode
  /** Fewest impacts a bar may have, so a round is never mostly silence. */
  minOnsets: number
  /** Whether a bar may open before its first impact. */
  allowInitialRest: boolean
  questionsPerRound: number
}

/** The meters a spec actually permits. */
export function allowedMeters(spec: RhythmRoundSpec): readonly TimeSignature[] {
  return spec.meters
    .map(parseMeter)
    .filter((meter): meter is TimeSignature => meter !== undefined)
}

/** The cell groups a spec offers at all. */
export function allowedGroups(spec: RhythmRoundSpec): readonly CellGroupId[] {
  return CELL_GROUP_IDS.filter((group) => (spec.cellWeights[group] ?? 0) > 0)
}

/**
 * Choose one cell.
 *
 * The **group** is weighted and the cell within it is uniform, so a weight
 * means what it looks like it means: `sixteenth: 3` is three parts sixteenths
 * however many patterns that group happens to hold. Weighting each cell
 * instead would silently make the larger groups heavier.
 */
function pickCell(
  random: Random,
  weights: CellWeights,
  allowed: readonly RhythmCell[],
): RhythmCell | undefined {
  const groups = CELL_GROUP_IDS.filter((group) =>
    allowed.some((cell) => cell.group === group),
  )

  const group = weightedPick(random, groups, (id) => weights[id] ?? 0)
  if (group === undefined) return undefined

  const choices = cellsInGroup(group).filter((cell) => allowed.includes(cell))
  const [first, ...rest] = choices
  return first === undefined ? undefined : randomPick(random, [first, ...rest])
}

/**
 * Which cells may stand in this beat.
 *
 * Two rules, and both are about what can be *written* rather than what can be
 * heard:
 *
 * - A bar may only open in silence when the level says so. It is a real skill
 *   and a harder one, so it is not on by default.
 * - **The beat after a tuplet has to be struck on its downbeat.** Otherwise
 *   the tuplet's last note runs past its own beat, and a note that outlives
 *   its bracket needs a tie — the one thing this exercise does not have. The
 *   engraver would cope by cutting the note short, but the sound and the
 *   spelling should agree.
 */
function candidates(
  spec: RhythmRoundSpec,
  beat: number,
  afterTuplet: boolean,
): readonly RhythmCell[] {
  return RHYTHM_CELLS.filter((cell) => {
    if ((spec.cellWeights[cell.group] ?? 0) <= 0) return false
    if (!startsSilent(cell)) return true
    if (afterTuplet) return false
    return beat > 0 || spec.allowInitialRest
  })
}

/** One bar, or `undefined` when the weights allow nothing that fits. */
function buildBar(
  random: Random,
  meter: TimeSignature,
  spec: RhythmRoundSpec,
): Rhythm | undefined {
  const onsets: number[] = []
  let afterTuplet = false

  for (let beat = 0; beat < meter.beats; beat += 1) {
    const cell = pickCell(random, spec.cellWeights, candidates(spec, beat, afterTuplet))
    if (cell === undefined) return undefined

    onsets.push(...cellTicks(cell, beat))
    afterTuplet = isTupletCell(cell)
  }

  return { meter, onsets }
}

/**
 * Make sure a bar has enough in it to be worth hearing.
 *
 * A bar can come out almost empty when the level is weighted towards held
 * notes, and a round of those is silence with a barline. Rather than rejecting
 * it forever, the thinnest bars gain plain downbeats: always writable, never a
 * tuplet, and they cannot break the rule about what follows one.
 *
 * **Bounded by one impact per beat**, since a downbeat is all it will add — a
 * level asking for five impacts in a bar of four quarters is asking for
 * something its own vocabulary cannot spell, and filling the gap with eighths
 * would put a subdivision in the bar that the level had switched off. That is a
 * level to fix rather than a bar to fake, so `difficulties.test.ts` insists
 * every shipped level reaches its own minimum.
 */
function atLeast(random: Random, rhythm: Rhythm, minOnsets: number): Rhythm {
  const onsets = new Set(rhythm.onsets)
  const beats = dealEvenly(
    random,
    Array.from({ length: rhythm.meter.beats }, (_, beat) => beat),
    rhythm.meter.beats,
  )

  for (const beat of beats) {
    if (onsets.size >= minOnsets) break
    onsets.add(beat * TICKS_PER_BEAT)
  }

  return { ...rhythm, onsets: [...onsets].sort((a, b) => a - b) }
}

/** How many bars to draw before settling for one that has to be filled out. */
const ATTEMPTS = 8

export function buildQuestion(
  random: Random,
  meter: TimeSignature,
  spec: RhythmRoundSpec,
): RhythmQuestion | undefined {
  let bar: Rhythm | undefined

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    bar = buildBar(random, meter, spec)
    if (bar === undefined) return undefined
    if (bar.onsets.length >= spec.minOnsets) break
  }

  if (bar === undefined) return undefined

  return {
    rhythm: atLeast(random, bar, spec.minOnsets),
    tempo: spec.tempo,
    metronome: spec.metronome,
  }
}

/**
 * Generate a whole round up front.
 *
 * The meters are dealt evenly so a level offering three of them asks all
 * three, rather than leaving one of them out of a round of ten by chance.
 */
export function generateRound(random: Random, spec: RhythmRoundSpec): RhythmQuestion[] {
  const meters = allowedMeters(spec)
  if (meters.length === 0 || allowedGroups(spec).length === 0) return []

  return dealEvenly(random, meters, spec.questionsPerRound).flatMap((meter) => {
    const question = buildQuestion(random, meter, spec)
    return question === undefined ? [] : [question]
  })
}
