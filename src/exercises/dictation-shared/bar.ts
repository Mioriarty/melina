import { TICKS_PER_BEAT, type TimeSignature } from '@/lib/music/meter'
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
 * Building a bar, one beat at a time — shared by both dictation exercises.
 *
 * The unit of randomness is the beat rather than the grid point, and that is
 * what makes the whole thing work: tuplets are simply cells with a division of
 * 3 or 5, so nothing here has a special case for them, and because a cell never
 * crosses a beat, no rhythm ever needs a tie to write down.
 *
 * A melody's phrase is several of these and nothing more. That the second
 * exercise to want a bar wanted exactly this one, with no argument added, is
 * the reason it lives here rather than in either of them.
 */

/** The part of a level that decides what a single bar may contain. */
export interface BarSpec {
  cellWeights: CellWeights
  /** Fewest impacts a bar may have, so a round is never mostly silence. */
  minOnsets: number
  /** Whether a bar may open before its first impact. */
  allowInitialRest: boolean
}

/** The cell groups a spec offers at all. */
export function allowedGroups(spec: BarSpec): readonly CellGroupId[] {
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
 *   and a harder one, so it is not on by default — and melodic dictation never
 *   allows it at all, because the note it gives away has to sit on beat one.
 * - **The beat after a tuplet has to be struck on its downbeat.** Otherwise
 *   the tuplet's last note runs past its own beat, and a note that outlives
 *   its bracket needs a tie — the one thing these exercises do not have. The
 *   engraver would cope by cutting the note short, but the sound and the
 *   spelling should agree.
 */
function candidates(
  spec: BarSpec,
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

/**
 * The most impacts one beat could still contribute.
 *
 * An upper bound over everything the level allows, used to see whether the
 * floor is still reachable. Silent cells cannot raise it and the tuplet rule
 * only ever removes them, so one number over the whole vocabulary is exact
 * enough to never forbid a cell that would in fact have been fine.
 */
function densestBeat(spec: BarSpec): number {
  return RHYTHM_CELLS.filter((cell) => (spec.cellWeights[cell.group] ?? 0) > 0).reduce(
    (most, cell) => Math.max(most, cell.attacks.length),
    0,
  )
}

/**
 * One bar, or `undefined` when the weights allow nothing that fits.
 *
 * **`minOnsets` is honoured while the bar is being built, never by throwing a
 * finished one away.** Drawing bars until one happens to clear the floor
 * sounds equivalent and is not: a bar survives that test in proportion to how
 * densely it happened to be drawn, so the levels quietly got a different
 * mixture from the one they declare. Measured on the shipped levels it halved
 * every `hold` — 25% of beats down to 13% in Beats — and in Off the Beat it
 * pushed plain eighths past the offbeats the level is named for. Topping a
 * thin bar up afterwards biases the same way, since what it adds is downbeats.
 *
 * So the floor is a constraint instead: a cell is refused only at the point
 * where taking it would put the floor out of reach for the beats that remain.
 * Every other beat is drawn from the level's weights untouched, which is what
 * makes a weight mean what it says.
 */
export function buildBar(
  random: Random,
  meter: TimeSignature,
  spec: BarSpec,
): Rhythm | undefined {
  const onsets: number[] = []
  const densest = densestBeat(spec)
  let afterTuplet = false

  for (let beat = 0; beat < meter.beats; beat += 1) {
    const allowed = candidates(spec, beat, afterTuplet)
    const remaining = meter.beats - beat - 1

    // Keep only the cells that leave the floor reachable. When nothing does,
    // the level cannot reach its own minimum at all — `difficulties.test.ts`
    // guards against shipping one — so take the densest and let `atLeast`
    // make up the rest rather than failing the round.
    const reachable = allowed.filter(
      (cell) =>
        onsets.length + cell.attacks.length + densest * remaining >= spec.minOnsets,
    )
    const usable = reachable.length > 0 ? reachable : allowed

    const cell = pickCell(random, spec.cellWeights, usable)
    if (cell === undefined) return undefined

    onsets.push(...cellTicks(cell, beat))
    afterTuplet = isTupletCell(cell)
  }

  return { meter, onsets }
}

/**
 * The last resort, for a floor the level cannot actually reach.
 *
 * `buildBar` already holds the floor in view as it goes, so a bar arrives here
 * short only when no bar the level can spell would have cleared it — asking
 * for five impacts in a bar of four quarters, say. Those gain plain downbeats:
 * always writable, never a tuplet, and they cannot break the rule about what
 * follows one.
 *
 * **Bounded by one impact per beat**, since a downbeat is all it will add.
 * Filling the gap with eighths would put a subdivision in the bar that the
 * level had switched off, which is a level to fix rather than a bar to fake —
 * so `difficulties.test.ts` insists every shipped level reaches its own
 * minimum, and nothing shipped should ever land here.
 *
 * It must stay the exception. What it adds is downbeats, so a level that leant
 * on it would quietly be a level with more quarter notes than it asked for —
 * the same way the rejection loop it replaced quietly had fewer held ones.
 */
export function atLeast(random: Random, rhythm: Rhythm, minOnsets: number): Rhythm {
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
