import { describe, expect, it } from 'vitest'

import { stations } from './curriculum'
import {
  CONNECTORS,
  CONNECTOR_ARRIVE,
  CONNECTOR_LEAVE,
  MEDALLION_SIZE,
  PATH_EDGES,
  columnWidth,
  connectorPath,
  labelWidthPx,
  standLevel,
  MUSIC,
  MUSIC_COUNT,
  PATH_HEIGHT,
  PATH_NODES,
  SPLATS,
  SPLAT_COUNT,
  orderedPathNodes,
} from './pathLayout'

/** The widths the layout has to survive, narrowest phone upwards. */
const VIEWPORTS = [320, 360, 375, 390, 414, 480, 600, 768, 1024, 1440]

describe('path layout', () => {
  it('places every station exactly once, and nothing else', () => {
    const ids = PATH_NODES.map((node) => node.stationId)
    expect(new Set(ids).size).toBe(ids.length)

    const expected = stations().map((station) => station.id)
    for (const id of expected) {
      expect(ids, `${id} has no hand-placed position`).toContain(id)
    }
    // A stale position for a station that no longer exists would silently
    // shift the layout it was hand-placed for.
    for (const id of ids) {
      expect(expected, `${id} is placed but is not a station`).toContain(id)
    }
  })

  it('gives every station a real position, never the fallback', () => {
    // orderedPathNodes falls back to the end of the path for an unplaced
    // station so shipping an exercise cannot drop it off the homescreen —
    // but the fallback should never actually be reached.
    for (const { position, station } of orderedPathNodes()) {
      expect(position.stationId, `${station.id} fell back`).toBe(station.id)
    }
  })

  it('gives interval reading and hearing separate stations', () => {
    const ids = stations().map((station) => station.id)
    expect(ids).toContain('intervals/hearing')
    expect(ids).toContain('intervals/reading')
    // The category itself is no longer a station once its exercises are.
    expect(ids).not.toContain('intervals')
  })

  it('runs strictly downhill, so the path never doubles back', () => {
    for (let i = 1; i < PATH_NODES.length; i += 1) {
      const previous = PATH_NODES[i - 1]!
      const current = PATH_NODES[i]!
      expect(
        current.y,
        `${current.stationId} sits above the node before it`,
      ).toBeGreaterThan(previous.y)
    }
  })

  it('spaces the single-file stations unevenly', () => {
    // The braids are regular by design — two columns keeping step. Everything
    // from the merge down is a single file, and there a constant rhythm would
    // read as a list rather than as a journey.
    //
    // Found by where the merge is rather than by a fixed index: a braid gains
    // and loses stations as exercises are built, and an index would quietly
    // start measuring a pair of braided nodes as though they were a run.
    const merge = PATH_NODES.findIndex(
      (node) => node.stationId === 'dictation/short-melodies',
    )
    expect(merge, 'the merge station is not on the path').toBeGreaterThan(0)
    const single = PATH_NODES.slice(merge)
    const gaps = single.slice(1).map((node, i) => node.y - single[i]!.y)

    expect(gaps.length).toBeGreaterThan(2)
    expect(new Set(gaps).size).toBe(gaps.length)
  })

  it('braids intervals down the left and scales down the right', () => {
    // Read across and it is the two subjects; read down and it is the two
    // ways of knowing one. A station on the wrong side breaks both readings.
    //
    // The two tracks may lean — they are hand-placed, and a column drawn
    // dead straight reads as a table rather than as a route. What has to
    // hold is the side, and that the tracks never cross.
    const at = (id: string) => PATH_NODES.find((node) => node.stationId === id)!
    const intervals = [at('intervals/reading'), at('intervals/hearing')]
    const scales = [at('scales/reading'), at('scales/hearing')]

    for (const node of intervals) expect(node.x, node.stationId).toBeLessThan(50)
    for (const node of scales) expect(node.x, node.stationId).toBeGreaterThan(50)

    expect(Math.max(...intervals.map((node) => node.x))).toBeLessThan(
      Math.min(...scales.map((node) => node.x)),
    )
  })

  it('puts reading above hearing, and the columns level with each other', () => {
    const at = (id: string) => PATH_NODES.find((node) => node.stationId === id)!

    expect(at('intervals/reading').y).toBeLessThan(at('intervals/hearing').y)
    expect(at('scales/reading').y).toBeLessThan(at('scales/hearing').y)

    // The two columns drop by the same amount, so the braid keeps step
    // rather than one track sliding away from the other.
    expect(at('intervals/hearing').y - at('intervals/reading').y).toBe(
      at('scales/hearing').y - at('scales/reading').y,
    )

    // And the stagger between the columns is much smaller than that drop —
    // it is what makes the eye join the vertical pairs rather than the rows.
    const stagger = at('scales/reading').y - at('intervals/reading').y
    const drop = at('intervals/hearing').y - at('intervals/reading').y
    expect(stagger).toBeGreaterThan(0)
    expect(stagger).toBeLessThan(drop / 2)
  })

  it('runs two braided tracks down, and merges them once at the end', () => {
    // Joining consecutive nodes instead would zig-zag across the column, which
    // claims scale reading comes after interval hearing. It does not: the two
    // tracks are independent all the way down, and meet only where the path
    // genuinely needs both of them.
    const joins = (from: string, to: string) =>
      PATH_EDGES.some((edge) => edge.from === from && edge.to === to)

    // The left track, and the right one.
    expect(joins('intervals/reading', 'intervals/hearing')).toBe(true)
    expect(joins('intervals/hearing', 'dictation/rhythm')).toBe(true)
    expect(joins('scales/reading', 'scales/hearing')).toBe(true)
    expect(joins('scales/hearing', 'scales/degrees')).toBe(true)

    // The merge: rhythm is the *when* and degrees the *what*, and melodic
    // dictation needs both, so both arrive at the same station.
    expect(joins('dictation/rhythm', 'dictation/short-melodies')).toBe(true)
    expect(joins('scales/degrees', 'dictation/short-melodies')).toBe(true)
    expect(joins('dictation/short-melodies', 'harmonic-prediction')).toBe(true)

    // Thoroughbass stands off the path: joined to itself and to nothing else.
    expect(joins('thoroughbass/figuring', 'thoroughbass/realizing')).toBe(true)
    expect(joins('dictation/short-melodies', 'thoroughbass/figuring')).toBe(false)
    expect(joins('thoroughbass/realizing', 'harmonic-prediction')).toBe(false)

    // Nothing crosses between the columns before that.
    expect(joins('intervals/reading', 'scales/reading')).toBe(false)
    expect(joins('scales/reading', 'intervals/hearing')).toBe(false)
    expect(joins('intervals/hearing', 'scales/hearing')).toBe(false)
    expect(joins('dictation/rhythm', 'scales/degrees')).toBe(false)
    expect(joins('intervals/hearing', 'scales/degrees')).toBe(false)
    expect(joins('scales/hearing', 'dictation/rhythm')).toBe(false)
  })

  it('joins nothing that is missing, and strands nothing by accident', () => {
    const ids = new Set(PATH_NODES.map((node) => node.stationId))
    for (const edge of PATH_EDGES) {
      expect(ids, `${edge.from} is joined but not placed`).toContain(edge.from)
      expect(ids, `${edge.to} is joined but not placed`).toContain(edge.to)
    }

    // The path is deliberately in **two pieces**: the journey itself, and
    // thoroughbass standing beside it. So reaching every station from the top
    // is no longer the property — what is, is that there are exactly those two
    // pieces and nothing else, which still catches the thing the walk was for:
    // a station left joined to nothing at all.
    const joined = new Map<string, Set<string>>(
      [...ids].map((id) => [id, new Set<string>()]),
    )
    for (const edge of PATH_EDGES) {
      joined.get(edge.from)?.add(edge.to)
      joined.get(edge.to)?.add(edge.from)
    }

    const components: string[][] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) continue
      const group: string[] = []
      const queue = [id]
      seen.add(id)
      while (queue.length > 0) {
        const next = queue.pop() as string
        group.push(next)
        for (const other of joined.get(next) ?? []) {
          if (seen.has(other)) continue
          seen.add(other)
          queue.push(other)
        }
      }
      components.push(group.sort())
    }

    const island = ['thoroughbass/figuring', 'thoroughbass/realizing']
    expect(components).toHaveLength(2)
    expect(components.map((group) => group.join(' '))).toContain(island.join(' '))

    const journey = components.find((group) => !group.includes(island[0] as string))
    expect(journey).toHaveLength(ids.size - island.length)
  })

  it('keeps every station inside the column', () => {
    for (const node of PATH_NODES) {
      // A loose sanity bound only — whether a label actually fits is checked
      // against the real geometry further down, and that is the guard that
      // matters. This one catches a coordinate typed as 7 or 107.
      expect(node.x, node.stationId).toBeGreaterThanOrEqual(20)
      expect(node.x, node.stationId).toBeLessThanOrEqual(80)
      expect(node.y).toBeLessThan(PATH_HEIGHT)
    }
  })

  it('draws one connector per join, and every join it is given', () => {
    expect(CONNECTORS).toHaveLength(PATH_EDGES.length)
    for (const connector of CONNECTORS) {
      expect(connector.d).toMatch(/^M [\d.-]+ [\d.-]+ C/)
      expect(connector.d).not.toContain('NaN')
    }
  })

  it('clears the medallion at both ends', () => {
    // Anything less and the dashes would run underneath the circle.
    expect(CONNECTOR_LEAVE).toBeGreaterThan(MEDALLION_SIZE / 2)
    expect(CONNECTOR_ARRIVE).toBeGreaterThan(MEDALLION_SIZE / 2)
  })

  it('starts and ends on the stations it joins', () => {
    // Regression guard: the node used to be centred on `position.y` as a
    // whole box rather than by its medallion, which left every connector
    // offset by half a label and touching nothing.
    const at = (id: string) => PATH_NODES.find((node) => node.stationId === id)!

    for (const [i, edge] of PATH_EDGES.entries()) {
      const from = at(edge.from)
      const to = at(edge.to)
      const d = connectorPath(from, to)

      const [, startX, startY, endX, endY] =
        /^M ([\d.-]+) ([\d.-]+) C [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+)$/.exec(
          d,
        ) ?? []

      expect(startX, `connector ${i} start x`).toBe(String(from.x))
      expect(endX, `connector ${i} end x`).toBe(String(to.x))
      expect(Number(startY)).toBe(from.y + CONNECTOR_LEAVE)
      expect(Number(endY)).toBe(to.y - CONNECTOR_ARRIVE)

      // And the gap between two stations is always wide enough for a
      // connector to exist in at all.
      expect(Number(endY)).toBeGreaterThan(Number(startY))
    }
  })

  it('alternates sides rather than drifting one way', () => {
    let crossings = 0
    for (let i = 1; i < PATH_NODES.length; i += 1) {
      const previous = PATH_NODES[i - 1]!
      const current = PATH_NODES[i]!
      if (Math.sign(previous.x - 50) !== Math.sign(current.x - 50)) crossings += 1
    }
    expect(crossings).toBeGreaterThanOrEqual(PATH_NODES.length - 3)
  })

  it('keeps every station label on screen at any supported width', () => {
    // Regression guard for titles being clipped by the side of a narrow
    // screen. The column is `max-w-[34rem] px-4`, so its drawable width is
    // `min(100vw, 544) - 32` — not `min(100vw - 32, 544)`, which overstates
    // it by the padding on every screen wide enough to hit the cap.
    for (const viewport of VIEWPORTS) {
      const column = columnWidth(viewport)

      for (const node of PATH_NODES) {
        const centre = (node.x / 100) * column
        const half = labelWidthPx(node, viewport) / 2
        expect(
          centre - half,
          `${node.stationId} overflows the left edge at ${viewport}px`,
        ).toBeGreaterThanOrEqual(0)
        expect(
          centre + half,
          `${node.stationId} overflows the right edge at ${viewport}px`,
        ).toBeLessThanOrEqual(column)
      }
    }
  })

  it('never lets two side-by-side stations overlap, at any supported width', () => {
    // New with the braid: before it, no two stations were ever level enough
    // for their labels to meet. Widths come from `labelWidthPx`, which is
    // what `PathNode` draws with — asserting against a copy of the rule here
    // would only prove the copy agreed with itself.
    for (const viewport of VIEWPORTS) {
      const column = columnWidth(viewport)

      for (const a of PATH_NODES) {
        for (const b of PATH_NODES) {
          if (a.stationId >= b.stationId || !standLevel(a, b)) continue

          const gap = Math.abs((a.x - b.x) / 100) * column
          const needed = labelWidthPx(a, viewport) / 2 + labelWidthPx(b, viewport) / 2
          expect(
            gap,
            `${a.stationId} and ${b.stationId} collide at ${viewport}px`,
          ).toBeGreaterThanOrEqual(needed)
        }
      }
    }
  })

  it('narrows a label only where a station has to share the column', () => {
    // The braid is what pays for standing two abreast; the single file below
    // it keeps the full width. Without this, shrinking the braid to fit
    // could quietly shrink every title on the page.
    const at = (id: string) => PATH_NODES.find((node) => node.stationId === id)!

    for (const viewport of VIEWPORTS) {
      const full = Math.min(168, (viewport * 42) / 100)
      expect(labelWidthPx(at('counterpoint'), viewport)).toBeCloseTo(full, 6)
      expect(labelWidthPx(at('intervals/reading'), viewport)).toBeLessThanOrEqual(
        full + 1e-9,
      )
    }

    // And it really does bind on the narrowest screen, where the pair is
    // closest together — otherwise this is testing nothing.
    expect(labelWidthPx(at('intervals/reading'), 320)).toBeLessThan(320 * 0.42)
  })

  it('scatters every requested decoration', () => {
    // If the rejection sampler cannot converge it silently returns fewer,
    // and the page quietly thins out.
    expect(SPLATS).toHaveLength(SPLAT_COUNT)
    expect(MUSIC).toHaveLength(MUSIC_COUNT)
  })

  it('builds splat outlines without degenerate geometry', () => {
    for (const splat of SPLATS) {
      expect(splat.d).toMatch(/^M [\d.-]+ [\d.-]+ C/)
      expect(splat.d).not.toContain('NaN')
      expect(splat.d.endsWith('Z')).toBe(true)
    }
  })

  it('keeps decorations subtle enough to stay a background', () => {
    for (const splat of SPLATS) expect(splat.opacity).toBeLessThan(0.12)
    for (const mark of MUSIC) expect(mark.opacity).toBeLessThan(0.22)
  })

  it('keeps notation upright enough to read as notation', () => {
    for (const mark of MUSIC) expect(Math.abs(mark.rotation)).toBeLessThanOrEqual(11)
  })

  it('joins every position to a real station', () => {
    expect(orderedPathNodes()).toHaveLength(stations().length)
  })
})
