import { describe, expect, it } from 'vitest'

import { createRandom, randomBetween, randomPick } from './seededRandom'

describe('createRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRandom(1234)
    const b = createRandom(1234)
    const seqA = Array.from({ length: 8 }, () => a())
    const seqB = Array.from({ length: 8 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces a different sequence for a different seed', () => {
    const a = createRandom(1)
    const b = createRandom(2)
    expect(a()).not.toBe(b())
  })

  it('stays within [0, 1)', () => {
    const random = createRandom(99)
    for (let i = 0; i < 500; i += 1) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('randomBetween', () => {
  it('stays within the requested range', () => {
    const random = createRandom(7)
    for (let i = 0; i < 200; i += 1) {
      const value = randomBetween(random, 10, 20)
      expect(value).toBeGreaterThanOrEqual(10)
      expect(value).toBeLessThan(20)
    }
  })
})

describe('randomPick', () => {
  it('always returns a member of the array', () => {
    const random = createRandom(42)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(randomPick(random, items))
    }
  })
})
