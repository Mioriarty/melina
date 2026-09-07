import { describe, expect, it } from 'vitest'

import { stations } from './curriculum'
import {
  CONNECTORS,
  CONNECTOR_ARRIVE,
  CONNECTOR_LEAVE,
  MEDALLION_SIZE,
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

  it('spaces the stations unevenly', () => {
    const gaps = PATH_NODES.slice(1).map((node, i) => node.y - PATH_NODES[i]!.y)
    // A constant rhythm would read as a list rather than a journey.
    expect(new Set(gaps).size).toBeGreaterThan(1)
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

  it('links consecutive stations, one connector fewer than stations', () => {
    expect(CONNECTORS).toHaveLength(PATH_NODES.length - 1)
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
    for (let i = 1; i < PATH_NODES.length; i += 1) {
      const from = PATH_NODES[i - 1]!
      const to = PATH_NODES[i]!
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
