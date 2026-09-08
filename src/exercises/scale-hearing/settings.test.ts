import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, SCALE_HEARING_SETTINGS } from './settings'

const parse = SCALE_HEARING_SETTINGS.parse

describe('scale hearing settings', () => {
  it('accepts a well-formed stored value', () => {
    const stored = {
      clefs: ['bass'],
      modes: ['lydian'],
      tonics: ['Eb'],
      directions: ['descending'],
      instrument: 'harp',
      questionsPerRound: 30,
    }
    expect(parse(stored)).toEqual(stored)
  })

  it('drops a direction that does not exist', () => {
    // `harmonic` is an interval's third option and means nothing for a scale:
    // eight notes at once is a cluster.
    const parsed = parse({
      ...DEFAULT_SETTINGS,
      directions: ['harmonic', 'ascending'],
    })
    expect(parsed?.directions).toEqual(['ascending'])
  })

  it('falls back when every stored direction is gone', () => {
    expect(parse({ ...DEFAULT_SETTINGS, directions: ['harmonic'] })?.directions).toEqual(
      DEFAULT_SETTINGS.directions,
    )
  })

  it('refuses an instrument that cannot be loaded', () => {
    expect(parse({ ...DEFAULT_SETTINGS, instrument: 'theremin' })?.instrument).toBe(
      DEFAULT_SETTINGS.instrument,
    )
  })

  it('offers every mode, since they all sound different from one another', () => {
    // Unlike interval hearing, which has to leave out the spellings that
    // sound identical to something else in the set.
    expect(DEFAULT_SETTINGS.modes).toHaveLength(7)
  })

  it('survives anything at all', () => {
    expect(parse(undefined)).toBeUndefined()
    expect(parse(42)).toBeUndefined()
    expect(parse({})).toEqual(DEFAULT_SETTINGS)
  })
})
