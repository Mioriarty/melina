import { TICKS_PER_BEAT } from './meter'

/**
 * The vocabulary a bar is built from: **one beat at a time**.
 *
 * A cell is a division of the beat plus which of its parts are struck. That
 * one idea buys three things at once:
 *
 * - **Tuplets need no mechanism.** A triplet is `division: 3` and a quintuplet
 *   is `division: 5`. Nothing anywhere else in the app has to know they exist.
 * - **No ties are needed**, because a tuplet never crosses a beat — which is
 *   the only place a tie would have become unavoidable.
 * - **Rhythms come out idiomatic.** Rolling a coin per grid point across the
 *   whole bar reaches patterns like "the second and third sixteenth only",
 *   which is a valid set of impacts and not a rhythm anyone would write. The
 *   list below is the patterns that are, so a level picks from music rather
 *   than from arithmetic.
 *
 * Cells are grouped, and a level names groups with a weight each — see
 * `CellGroupId`. That is what lets a level say both *which* subdivisions exist
 * in it and *how often* each one should come up.
 */

export interface RhythmCell {
  id: string
  /** How many equal parts the beat is split into. Must divide `TICKS_PER_BEAT`. */
  division: number
  /** Which parts are struck, ascending, each within `[0, division)`. */
  attacks: readonly number[]
  group: CellGroupId
}

export const CELL_GROUP_IDS = [
  'quarter',
  'hold',
  'eighth',
  'offbeat',
  'sixteenth',
  'dotted',
  'triplet',
  'quintuplet',
] as const
export type CellGroupId = (typeof CELL_GROUP_IDS)[number]

export function isCellGroupId(value: string): value is CellGroupId {
  return (CELL_GROUP_IDS as readonly string[]).includes(value)
}

/**
 * Every cell, listed once.
 *
 * No two cells may describe the same impacts — `4/[0,2]` is not here because
 * it *is* `2/[0,1]`, and a duplicate would quietly make one group heavier than
 * its weight claims.
 */
export const RHYTHM_CELLS: readonly RhythmCell[] = [
  { id: 'quarter', division: 1, attacks: [0], group: 'quarter' },

  // Nothing struck: the previous note simply runs on, which is where half,
  // dotted half and whole notes come from. Without this every bar would be a
  // wall of quarters.
  { id: 'hold', division: 1, attacks: [], group: 'hold' },

  { id: 'two-eighths', division: 2, attacks: [0, 1], group: 'eighth' },
  { id: 'offbeat-eighth', division: 2, attacks: [1], group: 'offbeat' },

  { id: 'four-sixteenths', division: 4, attacks: [0, 1, 2, 3], group: 'sixteenth' },
  { id: 'eighth-two-sixteenths', division: 4, attacks: [0, 2, 3], group: 'sixteenth' },
  { id: 'two-sixteenths-eighth', division: 4, attacks: [0, 1, 2], group: 'sixteenth' },
  {
    id: 'sixteenth-eighth-sixteenth',
    division: 4,
    attacks: [0, 1, 3],
    group: 'sixteenth',
  },

  { id: 'late-sixteenths', division: 4, attacks: [2, 3], group: 'offbeat' },
  { id: 'last-sixteenth', division: 4, attacks: [3], group: 'offbeat' },

  { id: 'dotted-eighth-sixteenth', division: 4, attacks: [0, 3], group: 'dotted' },
  { id: 'sixteenth-dotted-eighth', division: 4, attacks: [0, 1], group: 'dotted' },

  { id: 'triplet', division: 3, attacks: [0, 1, 2], group: 'triplet' },
  { id: 'triplet-long-short', division: 3, attacks: [0, 2], group: 'triplet' },
  { id: 'triplet-short-long', division: 3, attacks: [0, 1], group: 'triplet' },

  { id: 'quintuplet', division: 5, attacks: [0, 1, 2, 3, 4], group: 'quintuplet' },
]

/**
 * How likely each group is, per level. `0` means the group is not offered at
 * all, so one field says both which subdivisions a level contains and how
 * often each should come up.
 */
export type CellWeights = Readonly<Record<CellGroupId, number>>

/** Every group switched off, to be spread over. */
export const NO_CELLS: CellWeights = {
  quarter: 0,
  hold: 0,
  eighth: 0,
  offbeat: 0,
  sixteenth: 0,
  dotted: 0,
  triplet: 0,
  quintuplet: 0,
}

export function cellsInGroup(group: CellGroupId): readonly RhythmCell[] {
  return RHYTHM_CELLS.filter((cell) => cell.group === group)
}

/** Where a cell's impacts land, as ticks from the start of the bar. */
export function cellTicks(cell: RhythmCell, beat: number): number[] {
  const unit = TICKS_PER_BEAT / cell.division
  return cell.attacks.map((slot) => beat * TICKS_PER_BEAT + slot * unit)
}

/** A cell no player can hear the start of: nothing struck on the beat. */
export function startsSilent(cell: RhythmCell): boolean {
  return cell.attacks[0] !== 0
}

/**
 * Whether a cell is a tuplet — which is to say, whether it needs a bracket.
 *
 * A `division: 3` cell that only strikes its first part is a plain quarter
 * note and nothing else, so the question is about the impacts rather than
 * about the division it was drawn from.
 */
export function isTupletCell(cell: RhythmCell): boolean {
  const unit = TICKS_PER_BEAT / cell.division
  return cell.attacks.some((slot) => (slot * unit) % (TICKS_PER_BEAT / 4) !== 0)
}
