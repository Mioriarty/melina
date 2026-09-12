import { describe, expect, it } from 'vitest'

import { MODE_IDS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, SCALE_HEARING_SETTINGS } from './settings'

const parse = SCALE_HEARING_SETTINGS.parse

describe('scale hearing settings', () => {
  it('accepts a well-formed stored value', () => {
    const stored = {
      clefs: ['bass'],
      modes: ['lydian'],
      tonics: ['Eb'],
      directions: ['descending'],
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

  it('offers every scale, since they all sound different from one another', () => {
    // Unlike interval hearing, which has to leave out the spellings that
    // sound identical to something else in the set. Melodic minor is the one
    // that comes close — descending it is the natural minor — and what holds
    // that apart is the direction it is asked in rather than leaving it out;
    // see `modeDirections`.
    expect(DEFAULT_SETTINGS.modes).toEqual(MODE_IDS)
  })

  it('survives anything at all', () => {
    expect(parse(undefined)).toBeUndefined()
    expect(parse(42)).toBeUndefined()
    expect(parse({})).toEqual(DEFAULT_SETTINGS)
  })
})
