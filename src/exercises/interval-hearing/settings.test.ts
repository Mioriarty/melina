import { describe, expect, it } from 'vitest'

import { HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'
import { intervalSemitones, parseIntervalKey } from '@/lib/music/interval'

import { DEFAULT_SETTINGS, INTERVAL_HEARING_SETTINGS } from './settings'

const parse = INTERVAL_HEARING_SETTINGS.parse

describe('interval hearing settings', () => {
  it('accepts a well-formed stored value', () => {
    const stored = {
      clefs: ['alto'],
      keySignatures: ['3f'],
      intervals: ['m3', 'P5'],
      directions: ['descending'],
      instrument: 'harp',
      staffOnly: true,
      questionsPerRound: 10,
    }
    expect(parse(stored)).toEqual(stored)
  })

  it('drops values that no longer exist', () => {
    // A stored setting outlives the catalog that produced it.
    const parsed = parse({
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'sopranino'],
      intervals: ['P5', 'Z9'],
      directions: ['ascending', 'sideways'],
    })
    expect(parsed?.clefs).toEqual(['treble'])
    expect(parsed?.intervals).toEqual(['P5'])
    expect(parsed?.directions).toEqual(['ascending'])
  })

  it('never yields an empty list, which would make a round with no questions', () => {
    const parsed = parse({
      clefs: [],
      keySignatures: [],
      intervals: [],
      directions: [],
      instrument: 'kazoo',
      staffOnly: 'yes',
      questionsPerRound: 7,
    })

    expect(parsed?.clefs).toEqual(DEFAULT_SETTINGS.clefs)
    expect(parsed?.keySignatures).toEqual(DEFAULT_SETTINGS.keySignatures)
    expect(parsed?.intervals).toEqual(DEFAULT_SETTINGS.intervals)
    expect(parsed?.directions).toEqual(DEFAULT_SETTINGS.directions)
    // An unknown instrument cannot be loaded, so it falls back too.
    expect(parsed?.instrument).toBe(DEFAULT_SETTINGS.instrument)
    expect(parsed?.questionsPerRound).toBe(DEFAULT_SETTINGS.questionsPerRound)
    expect(parsed?.staffOnly).toBe(DEFAULT_SETTINGS.staffOnly)
  })

  it('strips intervals that cannot be told apart by ear', () => {
    // A setting saved before this rule existed, or hand-edited, must not
    // reintroduce a question with two correct answers.
    const parsed = parse({
      ...DEFAULT_SETTINGS,
      intervals: ['m3', 'A2', 'P5', 'd5', 'A4', 'd2', 'P1'],
    })
    // A2 sounds like m3, d5 like A4, d2 like P1.
    expect(parsed?.intervals).toEqual(['m3', 'P5', 'A4', 'P1'])
  })

  it('defaults to a set where every interval sounds different', () => {
    const sizes = DEFAULT_SETTINGS.intervals.map(
      (key) => intervalSemitones(parseIntervalKey(key)!) as number,
    )
    expect(new Set(sizes).size).toBe(sizes.length)
    expect(DEFAULT_SETTINGS.intervals).toEqual(HEARABLE_INTERVAL_KEYS)
  })

  it('rejects values that are not settings at all', () => {
    expect(parse(null)).toBeUndefined()
    expect(parse('harp')).toBeUndefined()
    expect(parse(42)).toBeUndefined()
  })

  it('defaults to something immediately practisable', () => {
    expect(DEFAULT_SETTINGS.instrument).toBe('piano')
    expect(DEFAULT_SETTINGS.directions).toEqual(['ascending'])
    expect(DEFAULT_SETTINGS.clefs.length).toBeGreaterThan(0)
    expect(DEFAULT_SETTINGS.intervals.length).toBeGreaterThan(0)
  })
})
