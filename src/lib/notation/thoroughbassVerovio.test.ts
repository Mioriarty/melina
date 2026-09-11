// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { pitch, type Pitch } from '@/lib/music/pitch'

import { rhythmMei, thoroughbassMei, type ThoroughbassEvent } from './mei'
import { notateRhythm } from './rhythmNotation'
import { renderMei, rhythmProfile, thoroughbassProfile } from './verovio'

/**
 * The engraver against a real figured bass.
 *
 * In the node environment for the same reason as `verovio.test.ts`: 7 MB of
 * WebAssembly that jsdom cannot instantiate. What it is here to catch is
 * everything nothing structural can — that the brace is really drawn, that the
 * figures are really drawn, that an accidental inside a figure survives at all,
 * and that a question does not change size when it is answered.
 *
 * Two of these are pinned **because Verovio gets them wrong quietly**. An
 * `<accid>` inside an `<f>` is accepted and then dropped, and `@extender`
 * draws no line: in both cases the MEI validates, the render succeeds, and the
 * thing simply is not on the page.
 */

const fig = (key: string) => parseFigureKey(key) as Figure

function event(
  bass: Pitch,
  figures: readonly string[],
  chord: readonly Pitch[],
): ThoroughbassEvent {
  return { bass, figures: figures.map(fig), chord }
}

const TRIAD = [pitch('E', 0, 4), pitch('G', 0, 4)]

function render(
  events: readonly ThoroughbassEvent[],
  keySignature: '0' | '7s' | '3f' = '0',
  hideChords = false,
) {
  const accidentals =
    KEY_SIGNATURES.find((signature) => signature.id === keySignature)?.count ?? 0
  return renderMei(
    thoroughbassMei({ keySignature, events, hideChords }),
    undefined,
    thoroughbassProfile(events.length, accidentals),
  )
}

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

const size = (svg: string) => svg.match(/width="(\d+)px" height="(\d+)px"/)?.[0]

const pixels = (svg: string) => {
  const found = svg.match(/width="(\d+)px" height="(\d+)px"/)
  return { width: Number(found?.[1] ?? 0), height: Number(found?.[2] ?? 0) }
}

/** The text of every figure line, in the order they were drawn. */
const figureText = (svg: string) =>
  [...svg.matchAll(/class="f"[^>]*>([\s\S]*?)<\/tspan>\s*<\/tspan>/g)].map((match) =>
    (match[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ''),
  )

describe('the grand staff', () => {
  it('braces two staves, treble over bass', async () => {
    const svg = await render([event(pitch('C', 0, 3), [], TRIAD)])

    expect(countOf(svg, 'staff')).toBe(2)
    // The brace is a `<grpSym>` child, not a `@symbol` on the `<staffGrp>` —
    // the attribute form is accepted and draws nothing.
    expect(countOf(svg, 'grpSym')).toBe(1)
    expect(countOf(svg, 'clef')).toBe(2)
  })

  it('leaves room for the brace, which is drawn outside the system', async () => {
    // A `<grpSym>` brace reaches to x = -432 within the page margin's own
    // group, so with the app's usual margin of 12 it lands at -312 and the
    // inner `<svg>` — which has no `overflow` — clips it. What is left is three
    // short strokes at the left edge, and every other check in this file still
    // passes: the size is right, nothing overflows to the right, asked and
    // revealed still match. Only measuring where the brace actually lands says
    // anything about it.
    const svg = await render([event(pitch('C', 0, 3), [], TRIAD)])

    const margin = Number(
      svg.match(/class="page-margin" transform="translate\((-?\d+)/)?.[1] ?? 0,
    )
    const brace = svg.match(/class="grpSym"[\s\S]{0,400}/)?.[0] ?? ''
    const leftmost = Math.min(
      ...[...brace.matchAll(/[MLC,](-?\d+),/g)].map((match) => Number(match[1])),
    )

    expect(Number.isFinite(leftmost)).toBe(true)
    expect(
      margin + leftmost,
      'the brace is drawn off the left of the page',
    ).toBeGreaterThanOrEqual(0)
  })

  it('gives each bass note a measure of its own, with no time signature', async () => {
    // A figured bass here is a succession of sonorities rather than a piece of
    // music. Declaring a metre would draw one.
    const svg = await render([
      event(pitch('C', 0, 3), ['6'], TRIAD),
      event(pitch('D', 0, 3), ['6'], TRIAD),
    ])
    expect(countOf(svg, 'measure')).toBe(2)
    expect(countOf(svg, 'meterSig')).toBe(0)
  })
})

describe('the figures', () => {
  it('draws them under the bass, stacked highest first', async () => {
    const svg = await render([event(pitch('C', 0, 3), ['6/4'], TRIAD)])

    expect(countOf(svg, 'harm')).toBe(1)
    expect(countOf(svg, 'fb')).toBe(1)
    expect(figureText(svg)).toEqual(['6', '4'])
  })

  it('draws nothing at all for a plain triad', async () => {
    // Which is the whole of how a plain triad is figured: "all Bass-notes
    // unaccompanied by a Figure are intended to bear Common Chords."
    const svg = await render([event(pitch('C', 0, 3), [''], TRIAD)])
    expect(countOf(svg, 'harm')).toBe(0)
  })

  it('draws an accidental inside a figure, as the figured-bass glyph', async () => {
    // **The trap.** `<accid accid="s"/>` inside an `<f>` is dropped in silence,
    // so the accidental must be the character. Verovio then maps it to U+EA66,
    // SMuFL's *figured-bass* sharp rather than the one drawn before a notehead
    // — narrower, and on the figure's own baseline.
    const svg = await render([event(pitch('E', 0, 3), ['#3'], TRIAD)])
    expect(figureText(svg)).toEqual([''])

    const flat = await render([event(pitch('E', 0, 3), ['b5/3'], TRIAD)])
    expect(figureText(flat)[0]).toContain('')
  })

  it('embeds the font that accidental needs, and only when one is used', async () => {
    // The character is in "Leipzig", which no browser has. `embedded` inlines
    // it; without that the sign renders as a blank. It costs the whole font, so
    // it is worth knowing that a figure with no accidental never pays.
    const plain = await render([event(pitch('C', 0, 3), ['6'], TRIAD)])
    const altered = await render([event(pitch('E', 0, 3), ['#3'], TRIAD)])

    expect(plain).not.toContain('@font-face')
    expect(altered).toContain('@font-face')
    expect(altered.length).toBeGreaterThan(plain.length * 5)
  })

  it('puts two figures under one bass note', async () => {
    // A suspension is two figures under one bass, and it has to be expressible
    // before it is worth building the rest of one. Anchored by timestamp rather
    // than to the note, because both cannot be on the same note.
    const svg = await render([event(pitch('C', 0, 3), ['4', '3'], TRIAD)])
    expect(countOf(svg, 'harm')).toBe(2)
    expect(figureText(svg)).toEqual(['4', '3'])
  })

  it('leaves the digits as text the app can restyle', async () => {
    // `Score` gives engraved text the app's serif with one class, which is what
    // puts the figures in EB Garamond. It reaches them only because they are
    // real `<text>` — and it leaves the accidental alone, which carries its own
    // font-family and must keep it.
    const svg = await render([event(pitch('C', 0, 3), ['6/4'], TRIAD)])
    expect(svg).toMatch(/<svg[^>]*\sfont-family="Times, serif"/)
    expect(svg).toContain('<text')
  })

  it('does not draw a continuation line, which is why there is no stage for it yet', async () => {
    // `@extender` is in the schema, is accepted, and draws nothing. The
    // Verlängerungszeichen therefore cannot come from the engraver today. This
    // test exists to say so out loud, and to start failing on the day Verovio
    // grows it.
    const withExtender = thoroughbassMei({
      keySignature: '0',
      events: [event(pitch('C', 0, 3), ['7'], TRIAD)],
    }).replace('<f>', '<f extender="true">')

    const svg = await renderMei(withExtender, undefined, thoroughbassProfile(1, 0))
    expect(countOf(svg, 'extender')).toBe(0)
  })
})

describe('the page it is drawn on', () => {
  it('renders a question and its answer at exactly the same size', async () => {
    // The reason the chord is engraved in place and hidden rather than left
    // out: leaving it out re-engraves a different piece of music, and the staff
    // moves the moment the answer arrives.
    const events = [event(pitch('C', 0, 3), ['6'], TRIAD)]
    expect(size(await render(events, '0', true))).toBe(
      size(await render(events, '0', false)),
    )
  })

  it('does not move while a figure is being written into it', async () => {
    // Every stage of typing `♯6/♭5/♮3`, which is the widest and tallest figure
    // the reserve is sized for.
    const stages = ['', '#6', '#6/b5', '#6/b5/n3']
    const sizes = []
    for (const written of stages) {
      sizes.push(size(await render([event(pitch('C', 0, 3), [written], TRIAD)])))
    }
    for (const stage of sizes) expect(stage).toBe(sizes[0])
  })

  it('holds the worst case on one system, in every key signature', async () => {
    for (const signature of KEY_SIGNATURES) {
      const svg = await renderMei(
        thoroughbassMei({
          keySignature: signature.id,
          events: [event(pitch('C', 0, 3), ['#6/b5/n3'], TRIAD)],
        }),
        undefined,
        thoroughbassProfile(1, signature.count),
      )

      expect((svg.match(/class="system"/g) ?? []).length, signature.id).toBe(1)

      const page = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0)
      const rightmost = Math.max(
        ...[...svg.matchAll(/translate\((-?\d+),/g)].map((match) => Number(match[1])),
      )
      expect(rightmost, `${signature.id} overflows its page`).toBeLessThan(page)
    }
  })

  it("comes out the size the rest of the app's notation does", async () => {
    // **The one that catches a page in the wrong units.** `pageWidth` and
    // `pageHeight` are a tenth of the viewBox units a render reports, so
    // calibrating by reading a natural size off the viewBox and feeding it
    // straight back in produces a page ten times too big — the music drawn in
    // one corner, the column scaling the sheet down to fit, and a staff a tenth
    // of the size it should be.
    //
    // Nothing that compares one render against another can see that: asked and
    // revealed are the same size as each other, nothing overflows, every stage
    // of typing matches. It is only visible against notation known to be right,
    // which is why this measures a grand staff against a bar of rhythm.
    const meter = { beats: 4, unit: 4 } as const
    const rhythm = await renderMei(
      rhythmMei({
        meter,
        staves: [{ nodes: notateRhythm({ meter, onsets: [0, 60, 120, 180] }) }],
      }),
      undefined,
      rhythmProfile(4, 1),
    )
    const staff = await render([event(pitch('G', 0, 3), ['7'], TRIAD)])

    const bar = pixels(rhythm)
    const grand = pixels(staff)

    // A grand staff is two staves and a row of figures, so it is taller than a
    // one-line rhythm and narrower than a whole bar — but within reach of it,
    // not an order of magnitude away.
    expect(grand.width).toBeLessThan(bar.width)
    expect(grand.height).toBeGreaterThan(bar.height)
    expect(grand.height).toBeLessThan(bar.height * 4)
    expect(grand.width).toBeGreaterThan(bar.width / 4)
  })

  it('hands back the same profile object every time', async () => {
    // `Score` compares it by identity; a fresh object re-renders on every paint.
    expect(thoroughbassProfile(1, 0)).toBe(thoroughbassProfile(1, 0))
    expect(thoroughbassProfile(1, 7)).not.toBe(thoroughbassProfile(1, 0))
  })
})
