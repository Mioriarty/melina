import { describe, expect, it } from 'vitest'

import { CATALOG, DEFAULT_INTERVAL_KEYS } from '@/lib/music/catalog'
import { CLEFS, getClef } from '@/lib/music/clef'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import {
  intervalBetween,
  intervalKey,
  intervalsEqual,
  parseIntervalKey,
  type Interval,
} from '@/lib/music/interval'
import { chromaticValue, pitchKey } from '@/lib/music/pitch'
import { createRandom } from '@/lib/utils/seededRandom'

import { allowedIntervals, buildQuestion, dealIntervals, generateRound } from './generate'
import { DEFAULT_SETTINGS, type IntervalReadingSettings } from './settings'

const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7919)

describe('dealIntervals', () => {
  it('deals every interval before repeating any', () => {
    const allowed = allowedIntervals(DEFAULT_SETTINGS)
    const dealt = dealIntervals(createRandom(1), allowed, allowed.length)
    const keys = new Set(dealt.map(intervalKey))
    expect(keys.size).toBe(allowed.length)
  })

  it('deals the requested count even when it exceeds the option count', () => {
    const allowed = allowedIntervals(DEFAULT_SETTINGS)
    expect(dealIntervals(createRandom(2), allowed, 50)).toHaveLength(50)
    expect(dealIntervals(createRandom(3), allowed, 3)).toHaveLength(3)
  })

  it('is deterministic for a seed', () => {
    const allowed = allowedIntervals(DEFAULT_SETTINGS)
    const a = dealIntervals(createRandom(9), allowed, 20).map(intervalKey)
    const b = dealIntervals(createRandom(9), allowed, 20).map(intervalKey)
    expect(a).toEqual(b)
  })
})

describe('buildQuestion', () => {
  it('produces notes that really do form the requested interval', () => {
    // The load-bearing property: if this drifts, the app teaches the wrong
    // answer while looking entirely correct.
    let checked = 0

    for (const seed of SEEDS) {
      const random = createRandom(seed)
      for (const interval of CATALOG) {
        for (const clef of CLEFS) {
          const question = buildQuestion(random, interval, clef.id, '0')
          if (question === undefined) continue

          const measured = intervalBetween(question.lower, question.upper)
          expect(
            measured,
            `${pitchKey(question.lower)}-${pitchKey(question.upper)} should be ${intervalKey(interval)}`,
          ).toEqual(interval)
          checked += 1
        }
      }
    }

    expect(checked).toBeGreaterThan(1000)
  })

  it('keeps both notes inside the clef range', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const random = createRandom(seed)
      for (const interval of CATALOG) {
        for (const clef of CLEFS) {
          const question = buildQuestion(random, interval, clef.id, '0')
          if (question === undefined) continue

          const { lowest, highest } = getClef(clef.id)
          for (const note of [question.lower, question.upper]) {
            expect(chromaticValue(note)).toBeGreaterThanOrEqual(chromaticValue(lowest))
            expect(chromaticValue(note)).toBeLessThanOrEqual(chromaticValue(highest))
          }
        }
      }
    }
  })

  it('never needs a triple accidental', () => {
    for (const seed of SEEDS) {
      const random = createRandom(seed)
      for (const interval of CATALOG) {
        for (const clef of CLEFS) {
          const question = buildQuestion(random, interval, clef.id, '0')
          if (question === undefined) continue
          for (const note of [question.lower, question.upper]) {
            expect(Math.abs(note.alteration)).toBeLessThanOrEqual(2)
          }
        }
      }
    }
  })

  it('can place every default interval in every clef', () => {
    // A silent failure here would mean an interval quietly never gets asked.
    for (const key of DEFAULT_INTERVAL_KEYS) {
      const interval = parseIntervalKey(key) as Interval
      for (const clef of CLEFS) {
        const placed = SEEDS.some(
          (seed) =>
            buildQuestion(createRandom(seed), interval, clef.id, '0') !== undefined,
        )
        expect(placed, `${key} never fits in the ${clef.id} clef`).toBe(true)
      }
    }
  })
})

describe('generateRound', () => {
  it('generates a full round', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const round = generateRound(createRandom(seed), DEFAULT_SETTINGS)
      expect(round).toHaveLength(DEFAULT_SETTINGS.questionsPerRound)
    }
  })

  it('only uses the allowed clefs, keys and intervals', () => {
    const settings: IntervalReadingSettings = {
      clefs: ['alto'],
      keySignatures: ['3f', '4s'],
      intervals: ['m3', 'P5', 'A4'],
      questionsPerRound: 20,
    }

    for (const seed of SEEDS.slice(0, 10)) {
      for (const question of generateRound(createRandom(seed), settings)) {
        expect(question.clef).toBe('alto')
        expect(settings.keySignatures).toContain(question.keySignature)
        expect(settings.intervals).toContain(intervalKey(question.interval))
      }
    }
  })

  it('spreads the allowed intervals rather than repeating a few', () => {
    const round = generateRound(createRandom(42), {
      ...DEFAULT_SETTINGS,
      questionsPerRound: 30,
    })
    const counts = new Map<string, number>()
    for (const question of round) {
      const key = intervalKey(question.interval)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    // 30 questions over 14 default intervals: each appears at least twice
    // and no interval runs away with the round.
    expect(counts.size).toBe(allowedIntervals(DEFAULT_SETTINGS).length)
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3)
  })

  it('works with every clef and key signature', () => {
    for (const clef of CLEFS) {
      for (const signature of KEY_SIGNATURES) {
        const round = generateRound(createRandom(7), {
          ...DEFAULT_SETTINGS,
          clefs: [clef.id],
          keySignatures: [signature.id],
          questionsPerRound: 10,
        })
        expect(round.length, `${clef.id} / ${signature.id}`).toBe(10)
        for (const question of round) {
          expect(
            intervalsEqual(
              intervalBetween(question.lower, question.upper) as Interval,
              question.interval,
            ),
          ).toBe(true)
        }
      }
    }
  })

  it('returns nothing when the settings allow nothing', () => {
    expect(
      generateRound(createRandom(1), { ...DEFAULT_SETTINGS, intervals: [] }),
    ).toEqual([])
    expect(generateRound(createRandom(1), { ...DEFAULT_SETTINGS, clefs: [] })).toEqual([])
  })
})
