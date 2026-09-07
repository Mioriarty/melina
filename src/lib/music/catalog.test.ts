import { describe, expect, it } from 'vitest'

import {
  CATALOG,
  DEFAULT_INTERVAL_KEYS,
  HEARABLE_CATALOG,
  HEARABLE_INTERVAL_KEYS,
  isHearable,
} from './catalog'
import { intervalKey, intervalSemitones, parseIntervalKey } from './interval'

describe('hearable intervals', () => {
  it('offers no two intervals that sound the same', () => {
    // The load-bearing rule. If two entries share a semitone count, the
    // question has two correct answers and no amount of listening helps.
    const bySize = new Map<number, string[]>()
    for (const interval of HEARABLE_CATALOG) {
      const semitones = intervalSemitones(interval)
      expect(semitones, intervalKey(interval)).toBeDefined()
      const existing = bySize.get(semitones as number) ?? []
      existing.push(intervalKey(interval))
      bySize.set(semitones as number, existing)
    }

    for (const [semitones, keys] of bySize) {
      expect(keys, `${keys.join(' and ')} are both ${semitones} semitones`).toHaveLength(
        1,
      )
    }
  })

  it('covers every size from a unison to an octave', () => {
    const sizes = HEARABLE_CATALOG.map((interval) => intervalSemitones(interval))
    expect([...sizes].sort((a, b) => (a as number) - (b as number))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
  })

  it('keeps the tritone, as the augmented fourth only', () => {
    // Six semitones has no perfect, major or minor spelling, so one of the
    // two names has to stand for it.
    expect(HEARABLE_INTERVAL_KEYS).toContain('A4')
    expect(HEARABLE_INTERVAL_KEYS).not.toContain('d5')
  })

  it('drops every other augmented and diminished interval', () => {
    for (const key of HEARABLE_INTERVAL_KEYS) {
      const interval = parseIntervalKey(key)!
      if (key === 'A4') continue
      expect(['perfect', 'major', 'minor'], `${key} is not a plain spelling`).toContain(
        interval.quality,
      )
    }
  })

  it('is a subset of the full catalog', () => {
    const all = new Set(CATALOG.map(intervalKey))
    for (const key of HEARABLE_INTERVAL_KEYS) expect(all.has(key)).toBe(true)
  })

  it('recognises which intervals are hearable', () => {
    expect(isHearable(parseIntervalKey('m3')!)).toBe(true)
    expect(isHearable(parseIntervalKey('A4')!)).toBe(true)
    // Sounds identical to a minor third.
    expect(isHearable(parseIntervalKey('A2')!)).toBe(false)
    // Sounds identical to the augmented fourth.
    expect(isHearable(parseIntervalKey('d5')!)).toBe(false)
    // Sounds identical to a perfect unison.
    expect(isHearable(parseIntervalKey('d2')!)).toBe(false)
  })

  it('differs from the reading defaults only by the diminished fifth', () => {
    const removed = DEFAULT_INTERVAL_KEYS.filter(
      (key) => !HEARABLE_INTERVAL_KEYS.includes(key),
    )
    expect(removed).toEqual(['d5'])
  })
})
