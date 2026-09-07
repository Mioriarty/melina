import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INSTRUMENT,
  INSTRUMENTS,
  getInstrument,
  isInstrumentId,
} from './instruments'

describe('instruments', () => {
  it('offers piano and harp', () => {
    expect(INSTRUMENTS.map((instrument) => instrument.id)).toEqual(['piano', 'harp'])
  })

  it('has a unique id and a sounding duration for each', () => {
    const ids = INSTRUMENTS.map((instrument) => instrument.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const instrument of INSTRUMENTS) {
      expect(instrument.duration, instrument.id).toBeGreaterThan(0)
      expect(instrument.gain, instrument.id).toBeGreaterThan(0)
    }
  })

  it('defaults to one that exists', () => {
    expect(isInstrumentId(DEFAULT_INSTRUMENT)).toBe(true)
    expect(getInstrument(DEFAULT_INSTRUMENT).id).toBe('piano')
  })

  it('validates ids', () => {
    expect(isInstrumentId('harp')).toBe(true)
    expect(isInstrumentId('kazoo')).toBe(false)
    expect(() => getInstrument('kazoo' as 'harp')).toThrow()
  })
})
