import { describe, expect, it } from 'vitest'

import { createRandom, randomBetween, randomPick, weightedPick } from './seededRandom'

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

describe('weightedPick', () => {
  const random = createRandom(4242)

  it('never picks something weighted zero', () => {
    const items = ['a', 'b', 'c']
    const weights: Record<string, number> = { a: 0, b: 3, c: 0 }

    for (let i = 0; i < 500; i += 1) {
      expect(weightedPick(random, items, (item) => weights[item] ?? 0)).toBe('b')
    }
  })

  it('is undefined when nothing has any weight', () => {
    expect(weightedPick(random, ['a', 'b'], () => 0)).toBeUndefined()
    expect(weightedPick(random, [], () => 1)).toBeUndefined()
  })

  it('follows the weights it is given', () => {
    const counts = { heavy: 0, light: 0 }
    const weight = (item: keyof typeof counts) => (item === 'heavy' ? 9 : 1)

    for (let i = 0; i < 4000; i += 1) {
      const picked = weightedPick(random, ['heavy', 'light'] as const, weight)
      if (picked !== undefined) counts[picked] += 1
    }

    // Nine to one, give or take: loose enough not to be flaky, tight enough
    // that ignoring the weights entirely would fail it.
    expect(counts.heavy / (counts.heavy + counts.light)).toBeGreaterThan(0.85)
    expect(counts.heavy / (counts.heavy + counts.light)).toBeLessThan(0.95)
  })

  it('treats a negative weight as zero', () => {
    expect(weightedPick(random, ['a', 'b'], (i) => (i === 'a' ? -5 : 1))).toBe('b')
  })
})
