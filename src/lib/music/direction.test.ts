import { describe, expect, it } from 'vitest'

import {
  PLAY_DIRECTIONS,
  getPlayDirection,
  isMelodic,
  isPlayDirection,
  leadingNote,
} from './direction'

describe('play direction', () => {
  it('offers exactly the three ways of sounding an interval', () => {
    expect(PLAY_DIRECTIONS.map((d) => d.id)).toEqual([
      'harmonic',
      'ascending',
      'descending',
    ])
  })

  it('leads with the upper note only when descending', () => {
    // The note heard first is the note shown first.
    expect(leadingNote('harmonic')).toBe('lower')
    expect(leadingNote('ascending')).toBe('lower')
    expect(leadingNote('descending')).toBe('upper')
  })

  it('knows which directions unfold over time', () => {
    expect(isMelodic('harmonic')).toBe(false)
    expect(isMelodic('ascending')).toBe(true)
    expect(isMelodic('descending')).toBe(true)
  })

  it('validates and resolves ids', () => {
    expect(isPlayDirection('ascending')).toBe(true)
    expect(isPlayDirection('sideways')).toBe(false)
    expect(getPlayDirection('descending').label).toBe('Descending')
  })
})
