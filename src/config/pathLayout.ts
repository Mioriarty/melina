import { CATEGORIES } from '@/config/curriculum'
import { MUSIC_MARKS, type MusicMarkName } from '@/config/musicMarks'
import { splatPath } from '@/lib/utils/splat'
import { createRandom, randomBetween } from '@/lib/utils/seededRandom'

/**
 * Composition of the homescreen path.
 *
 * The path scrolls vertically only, so positions are stored as a percentage
 * of the column width (x) and an absolute pixel offset down the column (y).
 * That mix is deliberate: it keeps the serpentine's proportions identical on
 * a phone and a desktop while letting labels stay at their natural size.
 *
 * Kept separate from `curriculum.ts`, which owns *what* melina teaches.
 */

/** Nominal column width used for collision maths only, in px. */
const REFERENCE_WIDTH = 480

/** Vertical space above the first node and below the last. */
export const PATH_TOP = 120
export const PATH_BOTTOM = 200

/**
 * Diameter of a station's medallion, in px.
 *
 * Shared with PathNode rather than duplicated in CSS: the connectors are
 * drawn from this, so if the two ever disagree the dashed route stops
 * touching the circles it is supposed to join.
 */
export const MEDALLION_SIZE = 72

export interface PathNodePosition {
  categoryId: string
  /** 0-100, a percentage of the column width. */
  x: number
  /** Pixels from the top of the path. */
  y: number
}

/**
 * Hand-placed, alternating side to side. The vertical gaps are deliberately
 * uneven — a constant rhythm reads as a list, and the point of the path is
 * that it reads as a journey.
 */
export const PATH_NODES: readonly PathNodePosition[] = [
  { categoryId: 'intervals', x: 50, y: 130 },
  { categoryId: 'scales', x: 27, y: 395 },
  { categoryId: 'dictation', x: 71, y: 630 },
  { categoryId: 'harmonic-prediction', x: 38, y: 920 },
  { categoryId: 'harmonic-completion', x: 70, y: 1160 },
  { categoryId: 'counterpoint', x: 29, y: 1450 },
  { categoryId: 'daily', x: 62, y: 1690 },
  { categoryId: 'progress', x: 44, y: 1975 },
]

const lastNode = PATH_NODES[PATH_NODES.length - 1]
export const PATH_HEIGHT = (lastNode?.y ?? 0) + PATH_BOTTOM

/**
 * Clearance below a station's centre: the medallion, then the gap and label
 * hanging beneath it. `position.y` is the centre of the *medallion*, not of
 * the whole node box — see PathNode.
 */
export const CONNECTOR_LEAVE = MEDALLION_SIZE / 2 + 62
/** Clearance above a station's centre: just the medallion and a little air. */
export const CONNECTOR_ARRIVE = MEDALLION_SIZE / 2 + 14

/**
 * Connector between two consecutive nodes.
 *
 * Rendered in a single SVG spanning the column with `preserveAspectRatio
 * ="none"` and a `0 0 100 PATH_HEIGHT` viewBox, so x units are percentages
 * and y units are pixels — the same space these coordinates are authored in.
 * Strokes use `vector-effect="non-scaling-stroke"` so the dashes stay round
 * and evenly spaced instead of being stretched by the horizontal scale.
 */
export function connectorPath(from: PathNodePosition, to: PathNodePosition): string {
  const startY = from.y + CONNECTOR_LEAVE
  const endY = to.y - CONNECTOR_ARRIVE
  // Leave and arrive vertically, bending sideways in between: the S-curve
  // that makes a serpentine read as one continuous route.
  const bend = (endY - startY) * 0.45

  return (
    `M ${from.x} ${startY}` +
    ` C ${from.x} ${startY + bend} ${to.x} ${endY - bend} ${to.x} ${endY}`
  )
}

export const CONNECTORS: readonly { id: string; d: string }[] = PATH_NODES.slice(
  0,
  -1,
).map((node, index) => {
  // `index + 1` is in range because we sliced off the final node.
  const next = PATH_NODES[index + 1] as PathNodePosition
  return { id: `${node.categoryId}-${next.categoryId}`, d: connectorPath(node, next) }
})

export interface Decoration {
  id: string
  /** 0-100, a percentage of the column width. */
  x: number
  /** Pixels from the top of the path. */
  y: number
  /** Rendered width in px. */
  size: number
  rotation: number
  opacity: number
  /**
   * Parallax factor. 0 scrolls with the path, 1 would stand still. Kept
   * small: the decoration layer is deliberately unclipped, so drift that got
   * large would push splats past the end of the path and add dead scroll.
   */
  depth: number
}

export interface SplatDecoration extends Decoration {
  d: string
}

export interface MusicDecoration extends Decoration {
  mark: MusicMarkName
}

function toPx(x: number): number {
  return (x / 100) * REFERENCE_WIDTH
}

/** The station nearest a given depth down the path. */
function nearestNode(y: number): PathNodePosition {
  return PATH_NODES.reduce((closest, node) =>
    Math.abs(node.y - y) < Math.abs(closest.y - y) ? node : closest,
  )
}

/** Distance from a point to the nearest node centre, in reference pixels. */
function distanceToNearestNode(x: number, y: number): number {
  return Math.min(
    ...PATH_NODES.map((node) => Math.hypot(toPx(node.x) - toPx(x), node.y - y)),
  )
}

/**
 * Pick an x on the opposite side of the column from whichever station sits at
 * this depth. Purely random placement clumps, and clumps land on the path;
 * pushing decorations into the outside of each bend balances the page and
 * keeps the route clear.
 */
function oppositeSide(
  random: () => number,
  y: number,
  near: readonly [number, number],
  far: readonly [number, number],
): number {
  return nearestNode(y).x >= 50
    ? randomBetween(random, near[0], near[1])
    : randomBetween(random, far[0], far[1])
}

/**
 * Deal glyph names out evenly.
 *
 * Sampling uniformly at random gave four fermatas out of nine marks, which
 * reads as a bug rather than as decoration. Instead every glyph is used once
 * before any is used twice, then the deck is shuffled.
 */
function dealMarks(random: () => number, count: number): MusicMarkName[] {
  const names = Object.keys(MUSIC_MARKS) as MusicMarkName[]
  const deck: MusicMarkName[] = []
  while (deck.length < count) deck.push(...names)

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = deck[i] as MusicMarkName
    const b = deck[j] as MusicMarkName
    deck[i] = b
    deck[j] = a
  }

  return deck.slice(0, count)
}

/**
 * Scatter decorations down the column, seeded so the arrangement is identical
 * on every launch and every device.
 *
 * The path is divided into as many horizontal bands as there are decorations
 * and each band gets exactly one, which guarantees an even spread down a
 * 2000px page. Rejection sampling alone left the top third bare and piled
 * everything into the bottom half.
 */
const DECOR_TOP = 30
const DECOR_BOTTOM = 190

function scatterSplats(seed: number, count: number): SplatDecoration[] {
  const random = createRandom(seed)
  const splats: SplatDecoration[] = []
  const band = (PATH_HEIGHT - DECOR_TOP - DECOR_BOTTOM) / count

  for (let i = 0; i < count; i += 1) {
    const size = randomBetween(random, 110, 250)

    let x = 0
    let y = 0
    // A handful of tries inside this band, then take the last one: a band is
    // never so crowded that no placement works, and the fallback keeps the
    // count exact rather than silently thinning the page.
    for (let attempt = 0; attempt < 24; attempt += 1) {
      y = DECOR_TOP + band * (i + randomBetween(random, 0.15, 0.85))
      // Splats may bleed off either edge; that is what stops the column
      // reading as a boxed-in card.
      x = oppositeSide(random, y, [-12, 34], [66, 112])
      if (distanceToNearestNode(x, y) > size * 0.42 + 74) break
    }

    splats.push({
      id: `splat-${i}`,
      x,
      y,
      size,
      rotation: randomBetween(random, 0, 360),
      opacity: randomBetween(random, 0.05, 0.09),
      depth: randomBetween(random, 0.03, 0.08),
      d: splatPath(random),
    })
  }

  return splats
}

function scatterMusic(
  seed: number,
  count: number,
  splats: readonly SplatDecoration[],
): MusicDecoration[] {
  const random = createRandom(seed)
  const marks: MusicDecoration[] = []
  const deck = dealMarks(random, count)
  const band = (PATH_HEIGHT - DECOR_TOP - DECOR_BOTTOM - 60) / count

  for (let i = 0; i < count; i += 1) {
    const name = deck[i] as MusicMarkName
    const [minSize, maxSize] = MUSIC_MARKS[name].size
    const size = randomBetween(random, minSize, maxSize)

    let x = 0
    let y = 0
    for (let attempt = 0; attempt < 24; attempt += 1) {
      y = DECOR_TOP + 60 + band * (i + randomBetween(random, 0.2, 0.8))
      // Notation stays inside the column — a clef half off the screen reads
      // as a mistake, where a splat bleeding off the edge reads as intent.
      x = oppositeSide(random, y, [10, 34], [66, 90])

      if (distanceToNearestNode(x, y) < 110) continue
      // Notation sitting on a splat turns into mud.
      const onSplat = splats.some(
        (splat) =>
          Math.hypot(toPx(splat.x) - toPx(x), splat.y - y) <
          splat.size * 0.45 + size * 0.5,
      )
      if (!onSplat) break
    }

    marks.push({
      id: `mark-${i}`,
      x,
      y,
      size,
      // Kept near-upright: tilted notation looks like a mistake, not a motif.
      rotation: randomBetween(random, -9, 9),
      opacity: randomBetween(random, 0.13, 0.2),
      depth: randomBetween(random, 0.03, 0.07),
      mark: name,
    })
  }

  return marks
}

export const SPLAT_COUNT = 12
export const MUSIC_COUNT = 8

export const SPLATS: readonly SplatDecoration[] = scatterSplats(0x6d656c69, SPLAT_COUNT)
export const MUSIC: readonly MusicDecoration[] = scatterMusic(
  0x6d656c6f,
  MUSIC_COUNT,
  SPLATS,
)

/** Nodes in path order, joined to their curriculum entry. */
export function orderedPathNodes() {
  return PATH_NODES.map((position) => {
    const category = CATEGORIES.find((entry) => entry.id === position.categoryId)
    return category === undefined ? undefined : { position, category }
  }).filter((entry) => entry !== undefined)
}
