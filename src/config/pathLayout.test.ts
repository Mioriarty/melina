import { describe, expect, it } from 'vitest'

import { stations } from './curriculum'
import {
  CONNECTORS,
  CONNECTOR_ARRIVE,
  CONNECTOR_LEAVE,
  MEDALLION_SIZE,
  PATH_EDGES,
  connectorPath,
  MUSIC,
  MUSIC_COUNT,
  PATH_HEIGHT,
  PATH_NODES,
  SPLATS,
  SPLAT_COUNT,
  orderedPathNodes,
} from './pathLayout'

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
    // The braid at the top is regular by design — two columns keeping step.
    // Everything below the merge is a single file, and there a constant
    // rhythm would read as a list rather than as a journey.
    const single = PATH_NODES.slice(4)
    const gaps = single.slice(1).map((node, i) => node.y - single[i]!.y)

    expect(gaps.length).toBeGreaterThan(2)
    expect(new Set(gaps).size).toBe(gaps.length)
  })

  it('braids intervals down the left and scales down the right', () => {
    // Read across and it is the two subjects; read down and it is the two
    // ways of knowing one. A station on the wrong side breaks both readings.
    const at = (id: string) => PATH_NODES.find((node) => node.stationId === id)!

    expect(at('intervals/reading').x).toBe(at('intervals/hearing').x)
    expect(at('scales/reading').x).toBe(at('scales/hearing').x)
    expect(at('intervals/reading').x).toBeLessThan(50)
    expect(at('scales/reading').x).toBeGreaterThan(50)
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

  it('joins the braid vertically and merges it into one station', () => {
    // Joining consecutive nodes instead would zig-zag through all four,
    // which claims scale reading comes after interval hearing.
    const joins = (from: string, to: string) =>
      PATH_EDGES.some((edge) => edge.from === from && edge.to === to)

    expect(joins('intervals/reading', 'intervals/hearing')).toBe(true)
    expect(joins('scales/reading', 'scales/hearing')).toBe(true)
    expect(joins('intervals/hearing', 'dictation')).toBe(true)
    expect(joins('scales/hearing', 'dictation')).toBe(true)

    // Nothing crosses between the columns before the merge.
    expect(joins('intervals/reading', 'scales/reading')).toBe(false)
    expect(joins('scales/reading', 'intervals/hearing')).toBe(false)
    expect(joins('intervals/hearing', 'scales/hearing')).toBe(false)
  })

  it('reaches every station from the first, and joins nothing that is missing', () => {
    const ids = new Set(PATH_NODES.map((node) => node.stationId))
    for (const edge of PATH_EDGES) {
      expect(ids, `${edge.from} is joined but not placed`).toContain(edge.from)
      expect(ids, `${edge.to} is joined but not placed`).toContain(edge.to)
    }

    // Walk the graph from the top of each column: a station nothing leads to
    // is a station that looks stranded on the page.
    const reached = new Set(['intervals/reading', 'scales/reading'])
    let grew = true
    while (grew) {
      grew = false
      for (const edge of PATH_EDGES) {
        if (reached.has(edge.from) && !reached.has(edge.to)) {
          reached.add(edge.to)
          grew = true
        }
      }
    }
    expect(reached.size).toBe(ids.size)
  })

  it('keeps every station within the column', () => {
    for (const node of PATH_NODES) {
      // Nodes are 168px wide and centred, so they need room on both sides
      // even on a narrow phone.
      expect(node.x, node.stationId).toBeGreaterThanOrEqual(25)
      expect(node.x, node.stationId).toBeLessThanOrEqual(75)
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
    // Mirrors PathNode: the column is `min(100%, 34rem)` inside 16px of
    // padding, and the label is `min(10.5rem, 42vw)` wide, centred on the
    // station. Regression guard for titles being clipped by the side of a
    // narrow screen.
    const viewports = [320, 360, 375, 390, 414, 480, 600, 768, 1024, 1440]

    for (const viewport of viewports) {
      const column = Math.min(viewport - 32, 544)
      const labelWidth = Math.min(168, viewport * 0.42)
      const half = labelWidth / 2

      for (const node of PATH_NODES) {
        const centre = (node.x / 100) * column
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
    // for their labels to meet. Mirrors PathNode — the column is
    // `min(100%, 34rem)` inside 16px of padding, the label box is
    // `min(10.5rem, 42vw)`, and a station occupies its medallion plus the
    // label hanging beneath it.
    const viewports = [320, 360, 375, 390, 414, 480, 600, 768, 1024, 1440]

    for (const viewport of viewports) {
      const column = Math.min(viewport - 32, 544)
      const half = Math.min(168, viewport * 0.42) / 2

      for (const a of PATH_NODES) {
        for (const b of PATH_NODES) {
          if (a.stationId >= b.stationId) continue

          const apart =
            a.y + CONNECTOR_LEAVE < b.y - MEDALLION_SIZE / 2 ||
            b.y + CONNECTOR_LEAVE < a.y - MEDALLION_SIZE / 2
          if (apart) continue

          const gap = Math.abs((a.x - b.x) / 100) * column
          expect(
            gap,
            `${a.stationId} and ${b.stationId} collide at ${viewport}px`,
          ).toBeGreaterThanOrEqual(half * 2)
        }
      }
    }
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
