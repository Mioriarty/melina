import { stations, type Station } from '@/config/curriculum'
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
export const PATH_BOTTOM = 170

/**
 * Diameter of a station's medallion, in px.
 *
 * Shared with PathNode rather than duplicated in CSS: the connectors are
 * drawn from this, so if the two ever disagree the dashed route stops
 * touching the circles it is supposed to join.
 */
export const MEDALLION_SIZE = 72

export interface PathNodePosition {
  /** Station id — `intervals/reading` or `scales`. */
  stationId: string
  /** 0-100, a percentage of the column width. */
  x: number
  /** Pixels from the top of the path. */
  y: number
}

/**
 * Hand-placed, in the order they are walked.
 *
 * The path runs as **two braided tracks that merge once**: intervals down the
 * left, scales down the right, reading above hearing on both. Read across and
 * it is the two subjects; read down and it is the two ways of knowing one.
 * A single file would have had to claim that scale reading comes after
 * interval hearing, which is not true of either the music or the player.
 *
 * The braid then continues rather than closing: Rhythmic Dictation carries the
 * left track on and Scale Degrees the right, which is the *when* and the *what*
 * of a melody. They meet at the station below, because what comes after needs
 * both of them and neither has to be learned first.
 *
 * The braid is staggered rather than level, so the four stations still run
 * downhill and the two columns do not read as one wide row. The offset
 * between the columns (`BRAID_STAGGER`) is much smaller than the drop from
 * reading to hearing (`BRAID_DROP`), which is what makes the vertical pairs
 * the ones the eye joins.
 *
 * Below the merge it is single file again, and there the vertical gaps are
 * deliberately uneven — a constant rhythm reads as a list, and the point of
 * the path is that it reads as a journey.
 */

/** How far the scale column sits below the interval column beside it. */
const BRAID_STAGGER = 70
/** Reading to hearing: the drop that the braid's own connectors span. */
const BRAID_DROP = 225

/**
 * Left for intervals, right for scales, held for the whole braid.
 *
 * Pushed as far apart as the column allows rather than sat either side of
 * centre: two labels standing side by side each want `min(10.5rem, 42vw)`,
 * which is most of a 320px screen between them. `pathLayout.test.ts` checks
 * the pair never overlaps at any supported width.
 */
const INTERVAL_X = 26
const SCALE_X = 74

export const PATH_NODES: readonly PathNodePosition[] = [
  { stationId: 'intervals/reading', x: INTERVAL_X + 2, y: PATH_TOP + 10 },
  { stationId: 'scales/reading', x: SCALE_X - 2, y: PATH_TOP + 10 + BRAID_STAGGER },
  { stationId: 'intervals/hearing', x: INTERVAL_X - 2, y: PATH_TOP + 10 + BRAID_DROP },
  {
    stationId: 'scales/hearing',
    x: SCALE_X + 2,
    y: PATH_TOP + 10 + BRAID_DROP + BRAID_STAGGER,
  },
  // **The second braid.** Rhythmic Dictation and Scale Degrees stand side by
  // side: the *when* and the *what*, which melodic dictation needs both of and
  // which can be learned in either order. Staggered like the first braid, so
  // the pair still runs downhill and does not read as one wide row.
  { stationId: 'dictation/rhythm', x: INTERVAL_X + 1, y: 580 },
  { stationId: 'scales/degrees', x: SCALE_X - 1, y: 580 + BRAID_STAGGER },
  // **Where the second braid merges.** Melodic dictation needs both of the
  // stations above it — the *when* and the *what* — and both of them join it.
  // It is the first station since the top of the path with two edges arriving.
  //
  // Left of centre rather than on it, because the room to its right is spoken
  // for: the next exercise stands beside it. Placed now rather than when that
  // arrives, so shipping it is a coordinate and not a re-layout of everything
  // below.
  { stationId: 'dictation/short-melodies', x: 38, y: 860 },
  // **Thoroughbass takes the room Melodic Dictation was placed to leave**, and
  // stands off the path: the main route runs past it down the left of the
  // column while these three sit to the right, joined to each other and to
  // nothing else. See `PATH_EDGES`.
  //
  // The explainer comes first and is drawn as a guide rather than an exercise
  // — a figure has conventions you have to be told before you can be asked
  // about them, so it is a stop on the way in rather than a footnote behind a
  // question mark on a settings screen.
  //
  // They are a chain rather than a braid, and the geometry is why: a braided
  // pair stands level, and two stations that stand level cannot also be joined
  // — below about 150px of drop a connector has no room between the label it
  // leaves and the medallion it arrives at, and it draws as a stub or inverts.
  // So the pair either stands side by side with nothing between them, or runs
  // downhill with a connector. Figuring first, because you can only realise a
  // figure you can read, and figuring is where the rules of omission are
  // learnt.
  { stationId: 'guide/figured-bass', x: 68, y: 1015 },
  { stationId: 'thoroughbass/figuring', x: 74, y: 1220 },
  { stationId: 'thoroughbass/realizing', x: 62, y: 1445 },
  { stationId: 'harmonic-prediction', x: 30, y: 1680 },
  { stationId: 'harmonic-completion', x: 66, y: 1900 },
  { stationId: 'counterpoint', x: 35, y: 2140 },
  { stationId: 'daily', x: 62, y: 2350 },
]

/**
 * Which stations the dashed route joins.
 *
 * Explicit rather than "each node to the next", because the path is a graph
 * once it braids: reading joins hearing down each column, and both hearings
 * join the station below. Joining consecutive nodes instead would draw a
 * zig-zag through all four, which says they are done in that order — the one
 * thing the braid exists to deny.
 */
export interface PathEdge {
  from: string
  to: string
}

export const PATH_EDGES: readonly PathEdge[] = [
  { from: 'intervals/reading', to: 'intervals/hearing' },
  { from: 'scales/reading', to: 'scales/hearing' },
  { from: 'intervals/hearing', to: 'dictation/rhythm' },
  { from: 'scales/hearing', to: 'scales/degrees' },
  { from: 'dictation/rhythm', to: 'dictation/short-melodies' },
  { from: 'scales/degrees', to: 'dictation/short-melodies' },
  { from: 'dictation/short-melodies', to: 'harmonic-prediction' },
  // **Thoroughbass is off the path, joined only to itself.** Nothing leads
  // into it and nothing leads out, so `PATH_EDGES` has exactly two components
  // and the walk from the top of the column does not reach this one. That is
  // the point: it is a subject you can take up beside the journey rather than
  // a stage of it, and drawing it in the line would claim it has to be done
  // before harmony and after melodic dictation, which is true of neither.
  { from: 'guide/figured-bass', to: 'thoroughbass/figuring' },
  { from: 'thoroughbass/figuring', to: 'thoroughbass/realizing' },
  { from: 'harmonic-prediction', to: 'harmonic-completion' },
  { from: 'harmonic-completion', to: 'counterpoint' },
  { from: 'counterpoint', to: 'daily' },
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
 * Connector between two joined nodes.
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

/* --------------------------------------------------------------- labels */

/**
 * The column the path is drawn in, mirrored from `PathView`:
 * `max-w-[34rem] px-4`, so the content is `min(100vw, 34rem) - 32px`.
 */
const COLUMN_MAX = 544
const COLUMN_PADDING = 32
/** Widest a station label is ever drawn, and its share of a narrow screen. */
const LABEL_CAP = 168
const LABEL_VW = 42
/** Clear air demanded between two labels standing side by side. */
const LABEL_GUTTER = 8

/** How far a station reaches above and below its anchor point. */
const NODE_ABOVE = MEDALLION_SIZE / 2
const NODE_BELOW = CONNECTOR_LEAVE

/** Whether two stations sit level enough for their labels to meet. */
export function standLevel(a: PathNodePosition, b: PathNodePosition): boolean {
  return !(a.y + NODE_BELOW < b.y - NODE_ABOVE || b.y + NODE_BELOW < a.y - NODE_ABOVE)
}

/**
 * The nearest station standing level with this one, if any.
 *
 * Only the braid has one. It is what decides how wide a label may be: two
 * labels each wanting `min(10.5rem, 42vw)` is most of a 320px column between
 * them, so the closer the pair is placed the narrower each has to be drawn.
 * Deriving it from the positions rather than pinning a second number means
 * the braid can be nudged sideways without anything having to be kept in
 * step by hand.
 */
function neighbourOf(node: PathNodePosition): PathNodePosition | undefined {
  return PATH_NODES.filter(
    (other) => other.stationId !== node.stationId && standLevel(node, other),
  ).reduce<PathNodePosition | undefined>(
    (closest, other) =>
      closest === undefined || Math.abs(other.x - node.x) < Math.abs(closest.x - node.x)
        ? other
        : closest,
    undefined,
  )
}

/** A station's share of the column, 0-1, before its neighbour is reached. */
function labelShare(node: PathNodePosition): number | undefined {
  const neighbour = neighbourOf(node)
  return neighbour === undefined ? undefined : Math.abs(node.x - neighbour.x) / 100
}

/**
 * How wide a station's label may be drawn, as CSS.
 *
 * Consumed by `PathNode` rather than written there, so the width and the
 * positions it has to fit between come from one place.
 */
export function labelWidthCss(node: PathNodePosition): string {
  const share = labelShare(node)
  const cap = `min(${LABEL_CAP / 16}rem, ${LABEL_VW}vw)`
  if (share === undefined) return cap

  const column = `(min(100vw, ${COLUMN_MAX / 16}rem) - ${COLUMN_PADDING}px)`
  return `min(${LABEL_CAP / 16}rem, ${LABEL_VW}vw, calc(${share} * ${column} - ${LABEL_GUTTER}px))`
}

/** The same width in pixels, for the geometry tests. */
export function labelWidthPx(node: PathNodePosition, viewport: number): number {
  const column = Math.min(viewport, COLUMN_MAX) - COLUMN_PADDING
  const share = labelShare(node)

  return Math.min(
    LABEL_CAP,
    (viewport * LABEL_VW) / 100,
    ...(share === undefined ? [] : [share * column - LABEL_GUTTER]),
  )
}

/** The drawable width of the column at a given viewport width, in px. */
export function columnWidth(viewport: number): number {
  return Math.min(viewport, COLUMN_MAX) - COLUMN_PADDING
}

const POSITIONS = new Map(PATH_NODES.map((node) => [node.stationId, node]))

export const CONNECTORS: readonly { id: string; d: string }[] = PATH_EDGES.flatMap(
  (edge) => {
    const from = POSITIONS.get(edge.from)
    const to = POSITIONS.get(edge.to)
    // An edge naming a station with no position draws nothing rather than a
    // path full of NaN. `pathLayout.test.ts` asserts it never happens.
    if (from === undefined || to === undefined) return []
    return [{ id: `${edge.from}-${edge.to}`, d: connectorPath(from, to) }]
  },
)

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

/** How close in y two stations must be to count as standing side by side. */
const BESIDE = 150

/**
 * Whether both sides of the column are occupied at this depth — which is the
 * braid, where the route runs down both edges at once.
 */
function braidedAt(y: number): boolean {
  const level = PATH_NODES.filter((node) => Math.abs(node.y - y) < BESIDE)
  return level.some((node) => node.x < 50) && level.some((node) => node.x > 50)
}

/**
 * Pick an x on the opposite side of the column from whichever station sits at
 * this depth. Purely random placement clumps, and clumps land on the path;
 * pushing decorations into the outside of each bend balances the page and
 * keeps the route clear.
 *
 * Where the path braids there is no opposite side — both edges are taken —
 * so the free space is the channel between the two tracks, and decorations
 * go down the middle instead.
 */
function oppositeSide(
  random: () => number,
  y: number,
  near: readonly [number, number],
  far: readonly [number, number],
  middle?: readonly [number, number],
): number {
  if (middle !== undefined && braidedAt(y)) {
    return randomBetween(random, middle[0], middle[1])
  }

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
      // Beside the braid the only room left is between its two tracks.
      x = oppositeSide(random, y, [10, 34], [66, 90], [42, 58])

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

/**
 * Stations in path order, joined to their placement.
 *
 * Positions are hand-placed by station id so the route stays art-directed;
 * a station without one falls back to the end of the path rather than
 * vanishing, which is what keeps shipping a new exercise from silently
 * dropping it off the homescreen. `pathLayout.test.ts` asserts every station
 * has a real position, so the fallback should never actually be used.
 *
 * **Sorted down the page, not by the curriculum.** The registry lists hearing
 * before reading; the path puts reading first and braids the two subjects, so
 * following the registry would tab a keyboard from the third station to the
 * first and back down again. Layout decides the order things are walked in,
 * which is exactly what this file is for.
 */
export function orderedPathNodes(): readonly {
  position: PathNodePosition
  station: Station
}[] {
  const placed = new Map(PATH_NODES.map((node) => [node.stationId, node]))

  return stations()
    .map((station, index) => ({
      position: placed.get(station.id) ?? {
        stationId: station.id,
        x: index % 2 === 0 ? 42 : 60,
        y: PATH_HEIGHT + index * 250,
      },
      station,
    }))
    .sort((a, b) => a.position.y - b.position.y)
}
