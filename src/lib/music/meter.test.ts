import { describe, expect, it } from 'vitest'

import {
  TICKS_PER_BEAT,
  beatGroups,
  isMeterKey,
  maxDurationAt,
  meterKey,
  metricLevel,
  parseMeter,
  ticksPerMeasure,
  METER_KEYS,
  type TimeSignature,
} from './meter'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }
const TWO_FOUR: TimeSignature = { beats: 2, unit: 4 }
const FIVE_FOUR: TimeSignature = { beats: 5, unit: 4 }

/** Note values in ticks, so the assertions read as music rather than as sums. */
const SIXTEENTH = TICKS_PER_BEAT / 4
const EIGHTH = TICKS_PER_BEAT / 2
const QUARTER = TICKS_PER_BEAT
const HALF = TICKS_PER_BEAT * 2
const DOTTED_HALF = TICKS_PER_BEAT * 3
const WHOLE = TICKS_PER_BEAT * 4

/** `1e`, `2&`, `4a` — counted positions, as ticks from the barline. */
function count(beat: number, sub: '' | 'e' | '&' | 'a' = ''): number {
  const offset = { '': 0, e: 1, '&': 2, a: 3 }[sub]
  return (beat - 1) * TICKS_PER_BEAT + offset * SIXTEENTH
}

describe('ticks', () => {
  it('divides a beat by four, three and five without a remainder', () => {
    // The whole reason the number is 60: sixteenths, triplets and quintuplets
    // all land on whole ticks, so a rhythm is compared exactly and never
    // rounded.
    for (const division of [1, 2, 3, 4, 5, 6]) {
      expect(TICKS_PER_BEAT % division, `division ${division}`).toBe(0)
    }
  })
})

describe('meter keys', () => {
  it('round-trips every key it offers', () => {
    for (const key of METER_KEYS) {
      const meter = parseMeter(key)
      expect(meter, key).toBeDefined()
      expect(meterKey(meter as TimeSignature)).toBe(key)
    }
  })

  it('refuses what it does not engrave', () => {
    // 6/8 is two dotted beats, not six beats: supporting it means changing
    // what a beat is, so it is absent rather than silently wrong.
    expect(parseMeter('6/8')).toBeUndefined()
    expect(isMeterKey('6/8')).toBe(false)
    expect(parseMeter('nonsense')).toBeUndefined()
  })

  it('groups the beats of every meter into the beats it has', () => {
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      const total = beatGroups(meter).reduce((sum, group) => sum + group, 0)
      expect(total, key).toBe(meter.beats)
    }
  })
})

describe('maxDurationAt in 4/4', () => {
  // The table this exercise was specified from, asserted as written.
  const TABLE: readonly [string, number, number][] = [
    ['1', count(1), WHOLE],
    ['1e', count(1, 'e'), SIXTEENTH],
    ['1&', count(1, '&'), EIGHTH],
    ['1a', count(1, 'a'), SIXTEENTH],
    ['2', count(2), QUARTER],
    ['2e', count(2, 'e'), SIXTEENTH],
    ['2&', count(2, '&'), EIGHTH],
    ['2a', count(2, 'a'), SIXTEENTH],
    ['3', count(3), HALF],
    ['3e', count(3, 'e'), SIXTEENTH],
    ['3&', count(3, '&'), EIGHTH],
    ['3a', count(3, 'a'), SIXTEENTH],
    ['4', count(4), QUARTER],
    ['4&', count(4, '&'), EIGHTH],
  ]

  it.each(TABLE)('allows %s up to %i ticks', (_label, tick, expected) => {
    expect(maxDurationAt(FOUR_FOUR, tick)).toBe(expected)
  })
})

describe('maxDurationAt in the other meters', () => {
  it('lets a note fill 3/4 from the downbeat and half of it from beat 2', () => {
    expect(maxDurationAt(THREE_FOUR, count(1))).toBe(DOTTED_HALF)
    // Beat 2 to the barline is a half note, and nothing stronger intervenes.
    expect(maxDurationAt(THREE_FOUR, count(2))).toBe(HALF)
    expect(maxDurationAt(THREE_FOUR, count(3))).toBe(QUARTER)
  })

  it('lets a note fill 2/4 from the downbeat', () => {
    expect(maxDurationAt(TWO_FOUR, count(1))).toBe(HALF)
    expect(maxDurationAt(TWO_FOUR, count(2))).toBe(QUARTER)
  })

  it('stops at the 3 + 2 seam in 5/4', () => {
    // The group boundary at beat 4 is what makes beat 4 the start of something
    // rather than the middle of it. Inside the first group 5/4 behaves exactly
    // like a bar of 3/4, so beat 2 still reaches a half note — it is the seam,
    // not the beat, that stops a note.
    expect(maxDurationAt(FIVE_FOUR, count(2))).toBe(HALF)
    expect(maxDurationAt(FIVE_FOUR, count(3))).toBe(QUARTER)
    expect(maxDurationAt(FIVE_FOUR, count(4))).toBe(HALF)
    expect(maxDurationAt(FIVE_FOUR, count(5))).toBe(QUARTER)
  })
})

describe('maxDurationAt everywhere', () => {
  it('never lets a note cross the barline', () => {
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      const total = ticksPerMeasure(meter)
      for (let tick = 0; tick < total; tick += 1) {
        expect(tick + maxDurationAt(meter, tick), `${key} @ ${tick}`).toBeLessThanOrEqual(
          total,
        )
      }
    }
  })

  it('always allows at least something', () => {
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      for (let tick = 0; tick < ticksPerMeasure(meter); tick += 1) {
        expect(maxDurationAt(meter, tick), `${key} @ ${tick}`).toBeGreaterThan(0)
      }
    }
  })

  it('never lets a note cross a boundary stronger than its own', () => {
    // The rule itself, restated as a property: whatever the table says, no
    // allowed span may contain a stronger boundary in its interior.
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      const total = ticksPerMeasure(meter)
      for (let tick = 0; tick < total; tick += 1) {
        const level = metricLevel(meter, tick)
        const end = tick + maxDurationAt(meter, tick)
        for (let inner = tick + 1; inner < end; inner += 1) {
          expect(
            metricLevel(meter, inner),
            `${key}: ${tick}..${end} @ ${inner}`,
          ).toBeGreaterThanOrEqual(level)
        }
      }
    }
  })
})

describe('metricLevel', () => {
  it('makes the barline the strongest thing in the bar', () => {
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      for (let tick = 1; tick < ticksPerMeasure(meter); tick += 1) {
        expect(metricLevel(meter, tick), `${key} @ ${tick}`).toBeGreaterThan(
          metricLevel(meter, 0),
        )
      }
    }
  })

  it('ranks the half bar above the other beats in 4/4', () => {
    // What makes a half note legal on beat 3 and illegal on beat 2.
    expect(metricLevel(FOUR_FOUR, count(3))).toBeLessThan(
      metricLevel(FOUR_FOUR, count(2)),
    )
    expect(metricLevel(FOUR_FOUR, count(2))).toBe(metricLevel(FOUR_FOUR, count(4)))
  })

  it('puts a triplet position below every written subdivision', () => {
    const triplet = TICKS_PER_BEAT / 3
    expect(metricLevel(FOUR_FOUR, triplet)).toBeGreaterThan(
      metricLevel(FOUR_FOUR, SIXTEENTH),
    )
  })
})
