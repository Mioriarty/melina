import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from './meter'

/**
 * A rhythm — and the claim that a rhythm is **a set of impacts and nothing
 * else**.
 *
 * A snare drum hit has no length. You cannot hear whether a note is held or
 * whether it stopped and was followed by a rest, so note values and rests are
 * an *engraving* decision and never a fact about the rhythm: they are not
 * generated, not stored, and not graded. Two spellings of the same impacts are
 * the same rhythm, which is exactly what makes "you put the impacts in the
 * right places" the whole of being correct — see `lib/notation/rhythmNotation.ts`
 * for the other half, where the spelling is decided.
 */
export interface Rhythm {
  meter: TimeSignature
  /** Strictly ascending tick offsets from the barline. May start after 0. */
  onsets: readonly number[]
}

/**
 * The storable form: `0,60,90,120`.
 *
 * A string rather than an array so a row in the attempt log stays flat, and
 * exact because the ticks are integers — see `TICKS_PER_BEAT`.
 */
export function onsetsKey(onsets: readonly number[]): string {
  return onsets.join(',')
}

export function parseOnsets(key: string): number[] | undefined {
  if (key === '') return []

  const onsets = key.split(',').map(Number)
  const usable = onsets.every(
    (tick, index) =>
      Number.isInteger(tick) &&
      tick >= 0 &&
      (index === 0 || tick > (onsets[index - 1] ?? 0)),
  )
  return usable ? onsets : undefined
}

/** Whether these impacts could have come out of this meter at all. */
export function isValidRhythm(rhythm: Rhythm): boolean {
  const total = ticksPerMeasure(rhythm.meter)
  return rhythm.onsets.every(
    (tick, index) =>
      Number.isInteger(tick) &&
      tick >= 0 &&
      tick < total &&
      (index === 0 || tick > (rhythm.onsets[index - 1] ?? 0)),
  )
}

/**
 * Whether two rhythms are the same — which is to say, the same impacts.
 *
 * The whole grading rule. Nothing about note values enters into it, because
 * nothing about note values can be heard.
 */
export function sameRhythm(a: Rhythm, b: Rhythm): boolean {
  return (
    a.meter.beats === b.meter.beats &&
    a.onsets.length === b.onsets.length &&
    a.onsets.every((tick, index) => tick === b.onsets[index])
  )
}

/**
 * How finely a rhythm is divided, as one label.
 *
 * Ordered by **what it asks of the player** rather than by the smallest gap in
 * it: a bar with one triplet in it is a triplet bar, even though a sixteenth
 * elsewhere in it is the shorter note. This is a label a breakdown groups by —
 * "you keep missing triplets" is the finding it exists to make possible — so
 * the most demanding thing present is the one worth naming.
 */
export const DIVISION_IDS = [
  'quarter',
  'eighth',
  'sixteenth',
  'triplet',
  'quintuplet',
] as const
export type DivisionId = (typeof DIVISION_IDS)[number]

export function isDivisionId(value: string): value is DivisionId {
  return (DIVISION_IDS as readonly string[]).includes(value)
}

/** The coarsest division a single tick could have come from. */
function divisionOfTick(tick: number): DivisionId {
  if (tick % TICKS_PER_BEAT === 0) return 'quarter'
  if (tick % (TICKS_PER_BEAT / 2) === 0) return 'eighth'
  if (tick % (TICKS_PER_BEAT / 3) === 0) return 'triplet'
  if (tick % (TICKS_PER_BEAT / 4) === 0) return 'sixteenth'
  return 'quintuplet'
}

export function rhythmDivision(rhythm: Rhythm): DivisionId {
  return rhythm.onsets.reduce<DivisionId>((finest, tick) => {
    const division = divisionOfTick(tick)
    return DIVISION_IDS.indexOf(division) > DIVISION_IDS.indexOf(finest)
      ? division
      : finest
  }, 'quarter')
}

/**
 * Whether anything is struck away from a beat.
 *
 * Named for what it measures rather than "syncopated", which properly means an
 * accent contradicting the metre and is a stronger claim than a tick landing
 * off the beat.
 */
export function isOffBeat(rhythm: Rhythm): boolean {
  return rhythm.onsets.some((tick) => tick % TICKS_PER_BEAT !== 0)
}

/** The impacts falling inside one beat, as offsets from that beat's start. */
export function onsetsInBeat(rhythm: Rhythm, beat: number): number[] {
  const start = beat * TICKS_PER_BEAT
  return rhythm.onsets
    .filter((tick) => tick >= start && tick < start + TICKS_PER_BEAT)
    .map((tick) => tick - start)
}
