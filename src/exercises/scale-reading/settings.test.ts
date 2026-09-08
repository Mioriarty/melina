import { describe, expect, it } from 'vitest'

import { MODE_IDS, TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, SCALE_READING_SETTINGS } from './settings'

const parse = SCALE_READING_SETTINGS.parse

/**
 * A stored setting outlives the registry that produced it, so the parser is
 * the last thing standing between a stale row in IndexedDB and a round that
 * cannot generate a single question.
 */
describe('scale reading settings', () => {
  it('accepts a well-formed stored value', () => {
    const stored = {
      clefs: ['alto'],
      modes: ['dorian', 'locrian'],
      tonics: ['Bb', 'F#'],
      questionsPerRound: 10,
    }
    expect(parse(stored)).toEqual(stored)
  })

  it('drops modes and tonics that no longer exist', () => {
    const parsed = parse({
      clefs: ['treble', 'harp-clef'],
      modes: ['dorian', 'hypolydian'],
      tonics: ['C', 'H', 'Gx'],
      questionsPerRound: 20,
    })

    expect(parsed?.clefs).toEqual(['treble'])
    expect(parsed?.modes).toEqual(['dorian'])
    expect(parsed?.tonics).toEqual(['C'])
  })

  it('falls back rather than leaving a list empty', () => {
    // An empty list is a round with no questions in it, which would drop the
    // player straight back out of the exercise with no explanation.
    const parsed = parse({ clefs: [], modes: [], tonics: [], questionsPerRound: 20 })

    expect(parsed?.clefs).toEqual(DEFAULT_SETTINGS.clefs)
    expect(parsed?.modes).toEqual(DEFAULT_SETTINGS.modes)
    expect(parsed?.tonics).toEqual(DEFAULT_SETTINGS.tonics)
  })

  it('refuses a round length it does not offer', () => {
    expect(parse({ ...DEFAULT_SETTINGS, questionsPerRound: 7 })?.questionsPerRound).toBe(
      DEFAULT_SETTINGS.questionsPerRound,
    )
    expect(
      parse({ ...DEFAULT_SETTINGS, questionsPerRound: '10' })?.questionsPerRound,
    ).toBe(DEFAULT_SETTINGS.questionsPerRound)
  })

  it('survives anything at all', () => {
    // Hand-edited, half-written, or from a version that never existed.
    expect(parse(null)).toBeUndefined()
    expect(parse('scales')).toBeUndefined()
    expect(parse({})).toEqual(DEFAULT_SETTINGS)
    expect(parse({ modes: 'dorian' })).toEqual(DEFAULT_SETTINGS)
  })

  it('defaults to something every mode can actually be asked in', () => {
    expect(DEFAULT_SETTINGS.modes).toEqual(MODE_IDS)
    for (const tonic of DEFAULT_SETTINGS.tonics) expect(TONIC_KEYS).toContain(tonic)
  })

  it('has no key signature to store, because a scale is written keyless', () => {
    expect(parse({ ...DEFAULT_SETTINGS, keySignatures: ['3f'] })).not.toHaveProperty(
      'keySignatures',
    )
  })
})
