/**
 * mulberry32 — a small, fast PRNG.
 *
 * The map's paint spots are scattered with this rather than `Math.random`
 * so the layout is byte-identical on every launch and every device: the
 * map you learn the shape of today is the same one tomorrow, and there is
 * no first-paint flicker from values changing between renders.
 */
export type Random = () => number

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform float in [min, max). */
export function randomBetween(random: Random, min: number, max: number): number {
  return min + random() * (max - min)
}

/** Uniform pick from a non-empty array. */
export function randomPick<T>(random: Random, items: readonly [T, ...T[]]): T {
  const index = Math.floor(random() * items.length)
  // Index is bounded by the array length and the array is non-empty by type.
  return items[Math.min(index, items.length - 1)] as T
}

/**
 * Deal `count` items from a shuffled deck of everything allowed, so each one
 * comes up about equally often.
 *
 * Sampling uniformly at random over twenty questions reliably leaves some
 * subjects unasked and asks others four times, which makes a round feel
 * arbitrary rather than thorough. The deck is refilled until it is long
 * enough, then shuffled once.
 */
export function dealEvenly<T>(random: Random, allowed: readonly T[], count: number): T[] {
  if (allowed.length === 0) return []

  const deck: T[] = []
  while (deck.length < count) deck.push(...allowed)

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = deck[i] as T
    const b = deck[j] as T
    deck[i] = b
    deck[j] = a
  }

  return deck.slice(0, count)
}
