import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, type TimeSignature } from './meter'
import {
  isOffBeat,
  isValidRhythm,
  onsetsInBeat,
  onsetsKey,
  parseOnsets,
  rhythmDivision,
  sameRhythm,
  type Rhythm,
} from './rhythm'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }

const beat = (n: number) => n * TICKS_PER_BEAT

function rhythm(onsets: readonly number[], meter = FOUR_FOUR): Rhythm {
  return { meter, onsets }
}

describe('onset keys', () => {
  it('round-trips', () => {
    for (const onsets of [[], [0], [0, 60, 90, 120], [15, 20, 45, 180]]) {
      expect(parseOnsets(onsetsKey(onsets))).toEqual(onsets)
    }
  })

  it('refuses a key that is not ascending, whole and positive', () => {
    // These only arise from a hand-edited row or one written by a version that
    // stored something else; they must cost that row, not the whole query.
    expect(parseOnsets('60,0')).toBeUndefined()
    expect(parseOnsets('0,0')).toBeUndefined()
    expect(parseOnsets('0,22.5')).toBeUndefined()
    expect(parseOnsets('-15')).toBeUndefined()
    expect(parseOnsets('nonsense')).toBeUndefined()
  })
})

describe('sameRhythm', () => {
  it('is the whole of being correct: the impacts and nothing else', () => {
    expect(sameRhythm(rhythm([0, 60, 90]), rhythm([0, 60, 90]))).toBe(true)
    expect(sameRhythm(rhythm([0, 60, 90]), rhythm([0, 60, 91]))).toBe(false)
    expect(sameRhythm(rhythm([0, 60]), rhythm([0, 60, 120]))).toBe(false)
  })

  it('separates rhythms that differ only by meter', () => {
    expect(sameRhythm(rhythm([0, 60]), rhythm([0, 60], THREE_FOUR))).toBe(false)
  })
})

describe('isValidRhythm', () => {
  it('keeps every impact inside the bar', () => {
    expect(isValidRhythm(rhythm([0, 180]))).toBe(true)
    // 240 is the barline, which belongs to the next bar.
    expect(isValidRhythm(rhythm([0, 240]))).toBe(false)
    expect(isValidRhythm(rhythm([0, 180], THREE_FOUR))).toBe(false)
  })

  it('accepts a bar that starts with a rest, and an empty one', () => {
    expect(isValidRhythm(rhythm([60, 120]))).toBe(true)
    expect(isValidRhythm(rhythm([]))).toBe(true)
  })
})

describe('rhythmDivision', () => {
  it('names the most demanding division present, not the shortest note', () => {
    // A bar holding both a triplet and a sixteenth is a triplet bar: it is a
    // label a breakdown groups by, and the triplet is what was hard about it.
    expect(rhythmDivision(rhythm([0, 20, 40, 60, 75, 90]))).toBe('triplet')
    expect(rhythmDivision(rhythm([0, 15, 30, 45]))).toBe('sixteenth')
    expect(rhythmDivision(rhythm([0, 30, 60]))).toBe('eighth')
    expect(rhythmDivision(rhythm([0, 60, 120, 180]))).toBe('quarter')
    expect(rhythmDivision(rhythm([0, 12, 24, 36, 48]))).toBe('quintuplet')
  })

  it('calls a bar of nothing but downbeats quarters', () => {
    expect(rhythmDivision(rhythm([]))).toBe('quarter')
  })
})

describe('isOffBeat', () => {
  it('is true as soon as anything lands away from a beat', () => {
    expect(isOffBeat(rhythm([0, 60, 120, 180]))).toBe(false)
    expect(isOffBeat(rhythm([0, 30]))).toBe(true)
    expect(isOffBeat(rhythm([0, 20]))).toBe(true)
  })
})

describe('onsetsInBeat', () => {
  it('reports offsets from the beat, not from the bar', () => {
    expect(onsetsInBeat(rhythm([0, 20, 40, beat(1), beat(1) + 30]), 0)).toEqual([
      0, 20, 40,
    ])
    expect(onsetsInBeat(rhythm([0, 20, 40, beat(1), beat(1) + 30]), 1)).toEqual([0, 30])
    expect(onsetsInBeat(rhythm([0]), 3)).toEqual([])
  })
})
