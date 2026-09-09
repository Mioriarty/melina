/**
 * Metre, and the metric hierarchy that decides how long a note may be.
 *
 * Ids and arithmetic only — "four four" and "Vier Viertel" live in the `music`
 * namespace, like every other name a player reads.
 *
 * Only `n/4` for now. 6/8 and 12/8 are not "six beats" and "twelve beats": they
 * are two and four *dotted* beats, which changes what a beat is rather than how
 * many there are, so they need their own grouping and are deliberately left out
 * rather than half-supported.
 */

/**
 * Ticks in one beat.
 *
 * 60 is LCM(4, 3, 5): sixteenths, triplets and quintuplets all land on whole
 * numbers. That is the whole reason for the number — a rhythm can then be
 * compared with `===`, stored as a plain string and never rounded, which is
 * what lets "did you put the impacts in the right places" be exact.
 */
export const TICKS_PER_BEAT = 60

export interface TimeSignature {
  beats: number
  /** Quarter-note beats only. See the note above about 6/8. */
  unit: 4
}

export const METER_KEYS = ['2/4', '3/4', '4/4', '5/4', '6/4'] as const
export type MeterKey = (typeof METER_KEYS)[number]

export function isMeterKey(value: string): value is MeterKey {
  return (METER_KEYS as readonly string[]).includes(value)
}

export function meterKey(meter: TimeSignature): MeterKey {
  return `${meter.beats}/${meter.unit}` as MeterKey
}

/** `undefined` for anything this app does not engrave — see the note on 6/8. */
export function parseMeter(key: string): TimeSignature | undefined {
  if (!isMeterKey(key)) return undefined
  const beats = Number(key.slice(0, key.indexOf('/')))
  return { beats, unit: 4 }
}

export function ticksPerMeasure(meter: TimeSignature): number {
  return meter.beats * TICKS_PER_BEAT
}

/**
 * How the beats of a bar clump together.
 *
 * 4/4 is two halves rather than four equal beats, which is exactly why a note
 * on beat 3 may be a half note and one on beat 2 may not. 5/4 is 3 + 2 by
 * convention; nothing here stops it being 2 + 3, but it has to be one of them
 * and the choice belongs in a table rather than in an argument at every call.
 */
const BEAT_GROUPS: Record<MeterKey, readonly number[]> = {
  '2/4': [2],
  '3/4': [3],
  '4/4': [2, 2],
  '5/4': [3, 2],
  '6/4': [3, 3],
}

export function beatGroups(meter: TimeSignature): readonly number[] {
  return BEAT_GROUPS[meterKey(meter)] ?? [meter.beats]
}

/**
 * How strong the beat at a tick is. **Smaller is stronger** — 0 is the barline.
 *
 * The levels are the boundaries a note is not allowed to cross, in order:
 * barline, beat group, beat, eighth, sixteenth, and anything finer (which is
 * to say inside a tuplet).
 */
export const BARLINE_LEVEL = 0
const GROUP_LEVEL = 1
const BEAT_LEVEL = 2
const EIGHTH_LEVEL = 3
const SIXTEENTH_LEVEL = 4
const FINER_LEVEL = 5

/** Ticks at which a beat group begins, excluding the barline itself. */
function groupBoundaries(meter: TimeSignature): readonly number[] {
  const boundaries: number[] = []
  let beat = 0
  for (const group of beatGroups(meter)) {
    beat += group
    if (beat < meter.beats) boundaries.push(beat * TICKS_PER_BEAT)
  }
  return boundaries
}

export function metricLevel(meter: TimeSignature, tick: number): number {
  if (tick % ticksPerMeasure(meter) === 0) return BARLINE_LEVEL
  if (groupBoundaries(meter).includes(tick)) return GROUP_LEVEL
  if (tick % TICKS_PER_BEAT === 0) return BEAT_LEVEL
  if (tick % (TICKS_PER_BEAT / 2) === 0) return EIGHTH_LEVEL
  if (tick % (TICKS_PER_BEAT / 4) === 0) return SIXTEENTH_LEVEL
  return FINER_LEVEL
}

/**
 * The longest a note starting here may be, in ticks.
 *
 * **A note may not cross a boundary stronger than the one it starts on.** That
 * single sentence is the whole rule, and it reproduces the familiar table for
 * 4/4 exactly — a whole note may start on beat 1, a half note on beat 3, a
 * quarter on beats 2 and 4, an eighth on the "and", a sixteenth on the "e" and
 * the "a" — while generalising to 3/4 and 5/4 without anyone tabulating them.
 *
 * Only the ceiling: what actually gets written is this capped by the gap to the
 * next impact, and then rounded down to a value that exists. See
 * `lib/notation/rhythmNotation.ts`.
 */
export function maxDurationAt(meter: TimeSignature, tick: number): number {
  const total = ticksPerMeasure(meter)
  const level = metricLevel(meter, tick)

  // Every boundary below `FINER_LEVEL` sits on a multiple of a sixteenth, so
  // stepping by sixteenths reaches all of them — and from inside a tuplet, the
  // next sixteenth is itself the first place a note is allowed to end.
  const step = TICKS_PER_BEAT / 4
  for (let t = Math.floor(tick / step) * step + step; t < total; t += step) {
    if (metricLevel(meter, t) < level) return t - tick
  }

  // Nothing stronger before the barline, which stops every note regardless.
  return total - tick
}
