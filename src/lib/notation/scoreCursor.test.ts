// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { pitch } from '@/lib/music/pitch'

import { centreFigures } from './figureAlignment'
import { thoroughbassMei, type ThoroughbassEvent } from './mei'
import { markSlot } from './scoreCursor'
import { renderMei, thoroughbassProfile } from './verovio'

/**
 * The cursor band, against the real engraver.
 *
 * In the node environment for the same reason as its neighbours: 7 MB of
 * WebAssembly jsdom cannot instantiate. It has to be here rather than beside
 * the component, because the whole of what `markSlot` does is read a finished
 * render back — a stubbed engraver would be a stubbed answer.
 *
 * What is pinned is the three things the band rests on and cannot check for
 * itself: that it lands on the chord it names, that it does not move while
 * that chord is being written, and that Verovio's own stylesheet is still
 * putting a stroke on every `<rect>` in the page — the one silent thing here,
 * and the reason the band is drawn with no width of outline rather than none.
 */

const fig = (key: string) => parseFigureKey(key) as Figure

const C3 = pitch('C', 0, 3)
const G3 = pitch('G', 0, 3)
const F3 = pitch('F', 0, 3)
const TRIAD = [pitch('E', 0, 4), pitch('G', 0, 4)]

/** A plain triad, a 4–3 suspension over a held bass, and another plain triad. */
const line = (chords: boolean): ThoroughbassEvent[] => [
  { bass: C3, figures: [fig('5/3')], chords: [chords ? TRIAD : []] },
  {
    bass: G3,
    figures: [fig('4'), fig('3')],
    chords: chords ? [[pitch('C', 0, 4)], [pitch('B', 0, 3)]] : [[], []],
  },
  { bass: F3, figures: [fig('6')], chords: [chords ? TRIAD : []] },
]

function render(events: readonly ThoroughbassEvent[], slots?: number) {
  const chords = events.reduce(
    (total, event) => total + Math.max(1, event.figures.length),
    0,
  )
  return renderMei(
    thoroughbassMei({ keySignature: '0', events }),
    undefined,
    thoroughbassProfile(slots ?? chords, 0),
  )
}

interface Band {
  left: number
  right: number
  top: number
  bottom: number
}

function bandOf(svg: string): Band | undefined {
  const found =
    /<rect class="score-cursor" x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(
      svg,
    )
  if (found === null) return undefined
  const [x, y, width, height] = [1, 2, 3, 4].map((at) => Number(found[at])) as [
    number,
    number,
    number,
    number,
  ]
  return { left: x, right: x + width, top: y, bottom: y + height }
}

/** Where the element with this authored id was drawn. */
function xOf(svg: string, id: string): number {
  const at = svg.indexOf(`id="${id}"`)
  expect(at, `${id} is not in the render`).toBeGreaterThan(-1)
  const rest = svg.slice(at)
  const placed = /transform="translate\((-?[\d.]+),/.exec(rest)
  const written = /<text x="(-?[\d.]+)"/.exec(rest)
  const first =
    placed === null
      ? written
      : written === null
        ? placed
        : placed.index < written.index
          ? placed
          : written
  return Number(first?.[1] ?? Number.NaN)
}

const inside = (band: Band, x: number) => x > band.left && x < band.right

describe('the band', () => {
  it('lands on the chord it names, and on no other', async () => {
    const svg = await render(line(true))

    // Three bass notes, four chords: the middle one carries a suspension.
    const slots = [
      { cursor: { event: 0, position: 0 }, id: 'chord1-1' },
      { cursor: { event: 1, position: 0 }, id: 'chord2-1' },
      { cursor: { event: 1, position: 1 }, id: 'chord2-2' },
      { cursor: { event: 2, position: 0 }, id: 'chord3-1' },
    ]

    for (const { cursor, id } of slots) {
      const band = bandOf(markSlot(svg, cursor))
      expect(band, `no band for ${id}`).toBeDefined()
      expect(inside(band as Band, xOf(svg, id)), `${id} is outside its own band`).toBe(
        true,
      )

      for (const other of slots) {
        if (other.id === id) continue
        expect(
          inside(band as Band, xOf(svg, other.id)),
          `${other.id} is inside ${id}'s band`,
        ).toBe(false)
      }
    }
  })

  it('does not move while the chord under it is being written', async () => {
    // The whole point of the fixed page, read back: a slot keeps its x from
    // the first keypress to the last, so the band can be computed from
    // whatever happens to be engraved at the moment it is asked for.
    const cursor = { event: 1, position: 1 }
    const empty = bandOf(markSlot(await render(line(false)), cursor))
    const written = bandOf(markSlot(await render(line(true)), cursor))

    expect(empty).toBeDefined()
    expect(written).toEqual(empty)
  })

  it('finds a slot by its figure when the chord is not written yet', async () => {
    // The realising direction: the chords are the answer and are empty at
    // first, so there is nothing but the figure to go on.
    const svg = await render(line(false))
    const band = bandOf(markSlot(svg, { event: 1, position: 1 }))

    expect(band).toBeDefined()
    expect(inside(band as Band, xOf(svg, 'figure2-2'))).toBe(true)
    expect(inside(band as Band, xOf(svg, 'figure2-1'))).toBe(false)
  })

  it('finds a slot by its chord when there is no figure at all', async () => {
    // The figuring direction before a key is pressed, and the case a figure
    // alone cannot cover: a plain triad is figured by writing nothing.
    const unfigured = line(true).map((event) => ({ ...event, figures: [] }))
    const svg = await render(unfigured, 4)
    const band = bandOf(markSlot(svg, { event: 2, position: 0 }))

    expect(band).toBeDefined()
    expect(inside(band as Band, xOf(svg, 'chord3-1'))).toBe(true)
    expect(inside(band as Band, xOf(svg, 'chord1-1'))).toBe(false)
  })

  it('says nothing when there is only one chord to be in', async () => {
    // A cursor marking the only place there is tells the player nothing they
    // did not already know, and one more thing on the page costs something.
    const svg = await render([line(true)[0] as ThoroughbassEvent])

    expect(markSlot(svg, { event: 0, position: 0 })).toBe(svg)
  })

  it('leaves a render it cannot find the slot in alone', async () => {
    const svg = await render(line(true))

    expect(markSlot(svg, { event: 9, position: 0 })).toBe(svg)
  })

  it('clears the clef and the key signature', async () => {
    // The first measure is the clef and the signature *plus* the ordinary
    // padding, so a band centred on its chord reaches back over the clef and
    // reads as though the clef were what was being written into.
    const svg = await render(line(true))
    const band = bandOf(markSlot(svg, { event: 0, position: 0 })) as Band
    const clef = /<g id="[^"]*" class="clef">\s*<use [^>]*translate\((-?[\d.]+),/.exec(
      svg,
    )
    const gap = 180

    expect(band.left).toBeGreaterThan(Number(clef?.[1] ?? 0) + 2 * gap)
    expect(band.left).toBeLessThan(xOf(svg, 'chord1-1'))
  })

  it('is drawn behind the music', async () => {
    const svg = markSlot(await render(line(true)), { event: 1, position: 0 })

    expect(svg.indexOf('class="score-cursor"')).toBeLessThan(
      svg.indexOf('class="system"'),
    )
  })

  it('draws no outline, because the render insists every rect has one', async () => {
    // Verovio ships a stylesheet inside every render containing an *ID*
    // selector — `#<id> rect { stroke: currentcolor }` — which beats both a
    // class of ours and a presentation attribute. The width of the stroke is
    // the one thing it does not claim. The day this assertion fails is the
    // day the band can simply say `stroke="none"`.
    const svg = markSlot(await render(line(true)), { event: 0, position: 0 })

    expect(svg).toMatch(/rect\s*\{stroke:currentColor\}/)
    expect(svg).toContain('stroke-width="0"')
  })

  it('lands in the same place whether or not the figures have been centred', async () => {
    // The app draws both — `centreFigures` moves every figure's `<text x>`,
    // and the band reads those same figures to find a chord that has not been
    // written yet. If the two disagreed about what a slot's x is, placing the
    // first note of a chord would make the band jump: the anchor would switch
    // from the figure to the chord halfway through.
    const svg = await render(line(false))

    for (const cursor of [
      { event: 0, position: 0 },
      { event: 1, position: 0 },
      { event: 1, position: 1 },
    ]) {
      const plain = bandOf(markSlot(svg, cursor))
      const centred = bandOf(markSlot(centreFigures(svg), cursor))
      expect(centred, `${cursor.event}/${cursor.position}`).toEqual(plain)
    }
  })

  it('gives every chord the same width of band', async () => {
    // One thing moving, rather than a highlight that changes shape as it goes.
    const svg = await render(line(true))
    const widths = [
      { event: 1, position: 0 },
      { event: 1, position: 1 },
      { event: 2, position: 0 },
    ].map((cursor) => {
      const band = bandOf(markSlot(svg, cursor)) as Band
      return band.right - band.left
    })

    expect(new Set(widths).size).toBe(1)
  })
})
