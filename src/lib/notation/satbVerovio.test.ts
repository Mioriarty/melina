// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { KEY_SIGNATURES, type KeySignatureId } from '@/lib/music/keySignature'
import { pitch, type Letter } from '@/lib/music/pitch'
import { VOICES, type Voicing } from '@/lib/music/satbVoicing'

import { rhythmMei } from './mei'
import { notateRhythm } from './rhythmNotation'
import { satbMei, type SatbAnalysis, type SatbEvent } from './satbMei'
import { renderMei, rhythmProfile, satbProfile } from './verovio'

/**
 * The engraver against a four-part setting.
 *
 * In the node environment for the same reason as every other Verovio test
 * here: 7 MB of WebAssembly that jsdom cannot instantiate.
 *
 * **Two `<layer>`s on one staff is new territory in this app.** Every other
 * engraving melina emits has exactly one layer per staff, so nothing was
 * pinned about what happens when two voices share one — whether both are
 * drawn, whether the stems go where they are told, whether the three rows of
 * analysis stack or sit on top of one another. None of that is knowable from
 * the markup, and all four of them fail *quietly*: the MEI validates, the
 * render succeeds, and the thing is simply not on the page.
 */

const note = (text: string) => pitch(text[0] as Letter, 0, Number(text[text.length - 1]))

const voicing = (
  soprano: string,
  alto: string,
  tenor: string,
  bass: string,
): Voicing => ({
  soprano: note(soprano),
  alto: note(alto),
  tenor: note(tenor),
  bass: note(bass),
})

/** C major, root position, then its dominant. */
const TONIC = voicing('E5', 'G4', 'C4', 'C3')
const DOMINANT = voicing('D5', 'G4', 'B3', 'G2')

const chords = (count: number): SatbEvent[] =>
  Array.from({ length: count }, (_, index) => ({
    voicing: index % 2 === 0 ? TONIC : DOMINANT,
    ticks: 120,
  }))

function render(
  events: readonly SatbEvent[],
  keySignature: KeySignatureId = '0',
  analysis?: SatbAnalysis,
  hidden = false,
) {
  const accidentals =
    KEY_SIGNATURES.find((entry) => entry.id === keySignature)?.count ?? 0
  return renderMei(
    satbMei({
      keySignature,
      events,
      ...(analysis === undefined ? {} : { analysis }),
      ...(hidden ? { hidden } : {}),
    }),
    undefined,
    satbProfile(events.length, accidentals),
  )
}

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

const boxOf = (svg: string) => {
  const match = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
  return match === null
    ? undefined
    : { width: Number(match[1]), height: Number(match[2]) }
}

/** Every `y` a `<text>` is drawn at, deduplicated and in order. */
function textRows(svg: string): readonly number[] {
  const rows = new Set<number>()
  for (const match of svg.matchAll(/<text[^>]*\by="([\d.]+)"/g)) {
    rows.add(Math.round(Number(match[1])))
  }
  return [...rows].sort((a, b) => a - b)
}

describe('satbMei', () => {
  it('draws all four voices, two to a staff', async () => {
    const svg = await render(chords(4))
    expect(countOf(svg, 'layer')).toBe(4 * VOICES.length)
    expect(countOf(svg, 'note')).toBe(4 * VOICES.length)
  })

  it('stems the upper voice of each staff up and the lower one down', async () => {
    // Without this the alto and the soprano share a stem direction and the two
    // lines cannot be told apart — which is the whole reason a chorale is
    // written in two layers rather than as a chord.
    const svg = await satbMei({ keySignature: '0', events: chords(1) })
    expect(svg).toContain('<layer n="1"><note xml:id="soprano1-1"')
    expect(svg).toContain('stem.dir="up"')
    expect(svg).toContain('<layer n="2"><note xml:id="alto1-1"')

    const rendered = await render(chords(1))
    // Four stems drawn, one per voice, and none of them merged away.
    expect(countOf(rendered, 'stem')).toBe(4)
  })

  it('draws the brace that joins the two staves', async () => {
    // A `<grpSym>` child rather than a `@symbol` attribute on the staffGrp:
    // the attribute form is accepted and draws nothing at all.
    const svg = await render(chords(2))
    expect(countOf(svg, 'grpSym')).toBeGreaterThan(0)
  })

  it('draws the brace inside the page rather than clipped off its left edge', async () => {
    // **The brace is drawn outside the system it joins**, at a negative x in
    // the system's own coordinates — and the path is written in that space,
    // not in the page's, so the margin is what decides whether it survives.
    // The inner `<svg>` has no overflow, so under the app's ordinary margin of
    // 12 the brace is cut away and what is left reads as three short strokes
    // at the left edge, like a rendering fault. This is the only profile that
    // moves `pageMarginLeft`, and this is why.
    const svg = await render(chords(2))

    const brace = /<g[^>]*class="[^"]*\bgrpSym\b[^"]*"[\s\S]*?<\/g>/.exec(svg)?.[0] ?? ''
    const xs = [...brace.matchAll(/[MLC]\s*(-?[\d.]+)/g)].map((match) => Number(match[1]))
    expect(xs.length, 'no brace was drawn at all').toBeGreaterThan(0)

    const shift = Number(
      /<g[^>]*class="[^"]*\bpage-margin\b[^"]*"[^>]*translate\((-?[\d.]+)/.exec(
        svg,
      )?.[1] ?? '0',
    )
    expect(shift, 'the page margin is what carries the brace').toBeGreaterThan(0)
    expect(shift + Math.min(...xs)).toBeGreaterThanOrEqual(0)
  })

  it('stacks the three analysis rows rather than printing them on top of each other', async () => {
    // Verovio has no notion of "the third analysis row" and nothing in the
    // markup says they must not collide. They come out at distinct heights,
    // and that is the fact being pinned.
    const bare = await render(chords(2))
    const full = await render(chords(2), '0', {
      figures: [parseFigureKey('6/5') as Figure, parseFigureKey('') as Figure],
      stufen: ['V7', 'I'],
      functions: ['D7', 'T'],
    })

    expect(textRows(bare)).toHaveLength(0)
    const rows = textRows(full)
    // Two lines of the figure, plus a Stufen row and a function row.
    expect(rows.length).toBeGreaterThanOrEqual(4)

    const gaps = rows.slice(1).map((y, index) => y - (rows[index] as number))
    for (const gap of gaps) expect(gap).toBeGreaterThan(0)
  })

  it('writes a suspension as one held bass under two upper sonorities', async () => {
    // The bass is struck once and rings under both halves. Drawing it twice
    // would say it had moved — which is the one thing a suspension is defined
    // by not doing — so the measure carries two notes in the upper voices and
    // one in the bass.
    const sixFour = voicing('C5', 'E4', 'G3', 'G2')
    const resolved = voicing('B4', 'D4', 'G3', 'G2')

    const svg = await render([
      { voicing: sixFour, ticks: 120 },
      { voicing: resolved, ticks: 120, held: true },
      { voicing: TONIC, ticks: 240 },
    ])

    // Two measures, not three: the suspension and its resolution share one.
    expect(countOf(svg, 'measure')).toBe(2)
    // Soprano, alto and tenor move twice under the first bass; the bass and
    // the final chord account for the rest.
    expect(countOf(svg, 'note')).toBe(3 * 2 + 1 + 4)
  })

  it('never wraps to a second system, whatever it is asked to draw', async () => {
    // **The failure this guards is silent and total.** Under `breaks: 'auto'`
    // a page narrower than the music wraps to a second system, and with the
    // page height fixed that system falls onto a page that is never rendered —
    // so chords simply vanish, with no error and no overflow to notice. A
    // suspension is where it bites first, because two sonorities over one bass
    // make a measure wider than the reserve was calibrated on.
    const sixFour = voicing('C5', 'E4', 'G3', 'G2')
    const resolved = voicing('B4', 'D4', 'G3', 'G2')

    for (const count of [2, 3, 4, 5, 6, 7, 8]) {
      for (const suspensions of [0, 1, 2]) {
        for (const signature of ['0', '7s'] as const) {
          const events: SatbEvent[] = []
          let made = 0
          for (let index = 0; index < count; index += 1) {
            if (index > 0 && made < suspensions && events[index - 1]?.held !== true) {
              events.push({ voicing: resolved, ticks: 120, held: true })
              made += 1
            } else {
              events.push({ voicing: index % 2 === 0 ? sixFour : TONIC, ticks: 120 })
            }
          }

          const accidentals =
            KEY_SIGNATURES.find((entry) => entry.id === signature)?.count ?? 0
          const svg = await renderMei(
            satbMei({
              keySignature: signature,
              events,
              analysis: {
                figures: events.map(() => parseFigureKey('6/5') as Figure),
                stufen: events.map(() => 'vii°6'),
                functions: events.map(() => 'D\u03387'),
              },
            }),
            undefined,
            satbProfile(events.length, accidentals),
          )

          const wanted = events.filter((event) => event.held !== true).length
          expect(
            countOf(svg, 'measure'),
            `${count} chords, ${suspensions} suspensions, ${signature}`,
          ).toBe(wanted)
          expect(countOf(svg, 'system')).toBe(1)
        }
      }
    }
  })

  it('draws the stroke through a rootless dominant', async () => {
    // `D̸7` is a combining overlay, and whether a font draws one is not
    // something the markup can promise. If this ever starts failing, the
    // symbol needs a different spelling rather than a different font.
    const svg = await render(chords(1), '0', { functions: ['D\u03387'] })
    expect(svg).toContain('\u0338')
  })

  it('engraves a question and its answer at exactly the same size', async () => {
    // The reserve exists for this: the analysis rows arrive with the answer,
    // and without a fixed page the staff would shrink by a third at the moment
    // the player looked at it.
    const events = chords(6)
    const asked = await render(events, '0', undefined, true)
    const revealed = await render(events, '0', {
      figures: events.map(() => parseFigureKey('6/5') as Figure),
      stufen: events.map(() => 'vii°6'),
      functions: events.map(() => 'D7'),
    })
    expect(boxOf(asked)).toEqual(boxOf(revealed))
  })

  it('hides a voice in place rather than leaving it out', async () => {
    const events = chords(3)
    const shown = await render(events)
    const partly = await render(
      events.map((event) => ({ ...event, hide: ['soprano', 'alto', 'tenor'] as const })),
    )
    expect(boxOf(shown)).toEqual(boxOf(partly))
    expect(partly).toContain('visibility="hidden"')
  })

  it('keeps the music inside the page it reserves', async () => {
    // A page **narrower** than the content does not overflow — Verovio fits the
    // system to whatever width it is given — so nothing running off the edge is
    // not the test. What is checked instead is the reserve against what the
    // same music asks for when it sizes its own page.
    for (const count of [2, 4, 6, 8]) {
      for (const signature of ['0', '3f', '7s'] as const) {
        const accidentals =
          KEY_SIGNATURES.find((entry) => entry.id === signature)?.count ?? 0
        const events = chords(count)
        const analysis: SatbAnalysis = {
          figures: events.map(() => parseFigureKey('6/5/3') as Figure),
          stufen: events.map(() => 'vii°6/5'),
          functions: events.map(() => 'D\u03387'),
        }

        const natural = await renderMei(
          satbMei({ keySignature: signature, events, analysis }),
          undefined,
          { pageMarginLeft: 50, smuflTextFont: 'embedded' },
        )
        const wanted = boxOf(natural)
        const profile = satbProfile(count, accidentals)

        expect(wanted).toBeDefined()
        expect(
          (profile.pageWidth as number) * 10,
          `${count} chords under ${signature}`,
        ).toBeGreaterThanOrEqual(wanted?.width ?? 0)
        expect(
          (profile.pageHeight as number) * 10,
          `${count} chords under ${signature}`,
        ).toBeGreaterThanOrEqual(wanted?.height ?? 0)
      }
    }
  })

  it('is the same size as a bar of rhythm, not ten times it', async () => {
    // The tenth-size trap, and the reason this is checked against something
    // known to be right rather than only against itself: every render being
    // equally wrong is invisible to any comparison among them.
    const meter = { beats: 4, unit: 4 } as const
    const rhythm = await renderMei(
      rhythmMei({
        meter,
        staves: [{ nodes: notateRhythm({ meter, onsets: [0, 60, 120, 180] }) }],
      }),
      undefined,
      rhythmProfile(4, 1),
    )
    const bar = boxOf(rhythm)
    const satz = boxOf(await render(chords(4)))

    // A grand staff is taller than one percussion line and not a different
    // order of magnitude wider.
    expect((satz?.height ?? 0) / (bar?.height ?? 1)).toBeGreaterThan(1)
    expect((satz?.width ?? 0) / (bar?.width ?? 1)).toBeLessThan(3)
  })
})
