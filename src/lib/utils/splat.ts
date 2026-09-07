import { randomBetween } from './seededRandom'

/**
 * Procedural ink splats.
 *
 * Hand-authoring a convincing splatter is hopeless, and a simple "wobbly
 * circle" reads as a cloud rather than thrown ink. What makes a splat is a
 * small dense core with *thin* tendrils shot off it at wildly uneven lengths,
 * and an outline that dips concave between them.
 *
 * So each tendril is built from three vertices — two bases close together in
 * angle and a tip far out — and the curve handles are near-zero along the
 * tendril so its sides stay straight and it tapers to a point. Between
 * tendrils a single core vertex sits *inside* the core radius, pulling the
 * outline concave. Seeded, so every splat is identical on every launch.
 *
 * Output is a closed path in a 0-100 box, centred on (50, 50).
 */

export interface SplatOptions {
  /** Number of tendrils thrown off the core. */
  tendrils: number
  /** Radius of the dense middle, as a fraction of the 50-unit half-box. */
  coreRadius: number
  /** Probability a tendril is a long throw rather than a short stub. */
  longChance: number
  /** Length range of long tendrils, as a fraction of the half-box. */
  longLength: readonly [number, number]
  /** Length range of short tendrils. */
  shortLength: readonly [number, number]
  /** Angular half-width of a long tendril's base, in radians. */
  longWidth: readonly [number, number]
  /** Angular half-width of a short tendril's base. Stubs are chunkier. */
  shortWidth: readonly [number, number]
  /** How irregular the core outline is. */
  jitter: number
}

export const DEFAULT_SPLAT: SplatOptions = {
  tendrils: 11,
  coreRadius: 0.5,
  longChance: 0.45,
  longLength: [0.8, 1],
  shortLength: [0.6, 0.76],
  longWidth: [0.08, 0.14],
  shortWidth: [0.15, 0.26],
  jitter: 0.18,
}

interface Vertex {
  x: number
  y: number
  /** Handle length as a fraction of the Catmull-Rom tangent at this point. */
  tension: number
}

const TAU = Math.PI * 2
const CENTER = 50
const HALF = 50

/**
 * Round where the ink pools, near-straight along the sides of a tendril, and
 * blunt at the tip — thrown paint pulls into rounded lobes under surface
 * tension, it does not end in needles.
 */
const CORE_TENSION = 0.5
const BASE_TENSION = 0.16
const TIP_TENSION = 0.24

export function splatPath(
  random: () => number,
  options: Partial<SplatOptions> = {},
): string {
  const {
    tendrils,
    coreRadius,
    longChance,
    longLength,
    shortLength,
    longWidth,
    shortWidth,
    jitter,
  } = { ...DEFAULT_SPLAT, ...options }

  const vertices: Vertex[] = []

  for (let i = 0; i < tendrils; i += 1) {
    // Uneven angular spacing, so the result never reads as a star.
    const angle = ((i + randomBetween(random, -0.28, 0.28)) / tendrils) * TAU
    const isLong = random() < longChance
    // Long throws are drawn thinner than stubs, the way real spatter behaves.
    const width = isLong ? longWidth : shortWidth
    const halfWidth = randomBetween(random, width[0], width[1])
    const length = isLong
      ? randomBetween(random, longLength[0], longLength[1])
      : randomBetween(random, shortLength[0], shortLength[1])

    const baseRadius = coreRadius * (1 + randomBetween(random, -jitter, jitter))

    vertices.push(polar(angle - halfWidth, baseRadius, BASE_TENSION))
    vertices.push(polar(angle, length, TIP_TENSION))
    vertices.push(polar(angle + halfWidth, baseRadius, BASE_TENSION))

    // A vertex pulled inside the core radius between this tendril and the
    // next, so the outline falls away concave instead of bulging.
    const nextAngle = ((i + 1) / tendrils) * TAU
    const gapAngle = (angle + halfWidth + nextAngle) / 2
    vertices.push(
      polar(gapAngle, coreRadius * randomBetween(random, 0.62, 0.86), CORE_TENSION),
    )
  }

  return toClosedPath(vertices)
}

function polar(angle: number, radius: number, tension: number): Vertex {
  return {
    x: CENTER + Math.cos(angle) * radius * HALF,
    y: CENTER + Math.sin(angle) * radius * HALF,
    tension,
  }
}

function toClosedPath(vertices: Vertex[]): string {
  const count = vertices.length
  const at = (index: number): Vertex => vertices[(index + count) % count] as Vertex

  const segments: string[] = []

  for (let i = 0; i < count; i += 1) {
    const current = at(i)
    const next = at(i + 1)

    const outgoing = tangent(at(i - 1), next, current.tension)
    const incoming = tangent(current, at(i + 2), next.tension)

    segments.push(
      `C ${round(current.x + outgoing.x)} ${round(current.y + outgoing.y)}` +
        ` ${round(next.x - incoming.x)} ${round(next.y - incoming.y)}` +
        ` ${round(next.x)} ${round(next.y)}`,
    )
  }

  const start = at(0)
  return `M ${round(start.x)} ${round(start.y)} ${segments.join(' ')} Z`
}

function tangent(
  before: Vertex,
  after: Vertex,
  tension: number,
): { x: number; y: number } {
  return {
    x: (after.x - before.x) * tension,
    y: (after.y - before.y) * tension,
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
