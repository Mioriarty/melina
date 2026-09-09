// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  METER_KEYS,
  TICKS_PER_BEAT,
  parseMeter,
  ticksPerMeasure,
  type TimeSignature,
} from '@/lib/music/meter'
import type { Rhythm } from '@/lib/music/rhythm'

import { rhythmMei } from './mei'
import { notateRhythm, padding } from './rhythmNotation'
import { renderMei, rhythmProfile } from './verovio'

/**
 * The engraver against a real rhythm.
 *
 * In the node environment for the same reason as `verovio.test.ts`: the
 * toolkit is 7 MB of WebAssembly that jsdom cannot instantiate. What it is here
 * to catch is everything the unit tests structurally cannot — that a one-line
 * percussion staff is really what comes out, that the bar being typed into
 * genuinely does not move, and that a bracket is drawn where one is meant.
 */

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }

function bar(onsets: readonly number[], meter = FOUR_FOUR): Rhythm {
  return { meter, onsets }
}

function mei(rhythm: Rhythm) {
  return rhythmMei({ meter: rhythm.meter, staves: [{ nodes: notateRhythm(rhythm) }] })
}

function render(rhythm: Rhythm) {
  return renderMei(mei(rhythm), undefined, rhythmProfile(rhythm.meter.beats, 1))
}

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

/** Every horizontal rule Verovio drew for the staff itself. */
function staffLines(svg: string): number {
  const staff = svg.match(/<g[^>]*class="staff"[^>]*>([\s\S]*?)<g[^>]*class="clef"/)
  return (staff?.[1]?.match(/<path/g) ?? []).length
}

function size(svg: string): { width: string; height: string } {
  const match = svg.match(/<svg[^>]*?width="(\d+)px"[^>]*?height="(\d+)px"/)
  return { width: match?.[1] ?? '', height: match?.[2] ?? '' }
}

describe('a rhythm on the page', () => {
  it('engraves onto a single line, with a percussion clef and no key signature', async () => {
    const svg = await render(bar([0, 60, 120, 180]))

    expect(svg).toContain('<svg')
    // Five lines would be four lines of nothing: there is no pitch to read.
    expect(staffLines(svg)).toBe(1)
    expect(countOf(svg, 'clef')).toBe(1)
    expect(countOf(svg, 'meterSig')).toBe(1)
    // `keySig` is emitted as an empty group; what matters is that no accidental
    // was drawn into it.
    expect(svg).not.toMatch(/class="keySig"[^>]*>\s*<use/)
  })

  it('draws the time signature it was given', async () => {
    // Verovio draws the digits as glyph references, E080..E089 for 0..9, so
    // the signature can be read back out of the SVG rather than assumed. The
    // page is a fixed size, so its dimensions could never show this.
    const digits = (svg: string) =>
      [...svg.matchAll(/class="meterSig"[\s\S]*?<\/g>/g)].flatMap((group) =>
        [...group[0].matchAll(/#E08(\d)/g)].map((m) => m[1]),
      )

    expect(digits(await render(bar([0, 60, 120], THREE_FOUR)))).toEqual(['3', '4'])
    expect(digits(await render(bar([0, 60, 120, 180])))).toEqual(['4', '4'])
  })

  it('draws one notehead per impact', async () => {
    for (const onsets of [
      [0],
      [0, 60],
      [0, 30, 60, 90, 120, 180],
      [0, 15, 30, 45, 60, 120, 180],
    ]) {
      const svg = await render(bar(onsets))
      expect(countOf(svg, 'notehead'), `${onsets}`).toBe(onsets.length)
    }
  })

  it('brackets a triplet and a quintuplet', async () => {
    expect(countOf(await render(bar([0, 20, 40, 60, 120, 180])), 'tuplet')).toBe(1)
    expect(countOf(await render(bar([0, 12, 24, 36, 48, 60, 120, 180])), 'tuplet')).toBe(
      1,
    )
    // And does not bracket a bar that has no tuplet in it.
    expect(countOf(await render(bar([0, 60, 120, 180])), 'tuplet')).toBe(0)
  })

  it('beams within the beat', async () => {
    const svg = await render(bar([0, 30, 60, 90, 120, 150, 180, 210]))
    expect(countOf(svg, 'beam')).toBe(4)
  })
})

describe('the bar being typed into', () => {
  /**
   * The measure as it looks part-typed: the notes entered so far, and `<space>`
   * for everything after them.
   */
  function draft(rhythm: Rhythm, upTo: number): string {
    const typed = { ...rhythm, onsets: rhythm.onsets.filter((tick) => tick < upTo) }
    return rhythmMei({
      meter: rhythm.meter,
      staves: [{ nodes: notateRhythm(typed) }],
    })
  }

  it('pads an unfinished bar out to its full length', () => {
    const meter = FOUR_FOUR
    const total = ticksPerMeasure(meter)
    for (let written = 0; written < total; written += TICKS_PER_BEAT / 4) {
      const filled = padding(meter, written, total).reduce((sum, s) => sum + s.ticks, 0)
      expect(written + filled, `from ${written}`).toBe(total)
    }
  })

  it('renders every stage of a bar at exactly the same size', async () => {
    // The regression guard for the staff moving under the player's hands. With
    // the page shrunk to its content — the way every other example is drawn —
    // each keystroke made the render wider and the column scaled it down
    // harder, so the notation shrank as it was typed.
    const rhythm = bar([0, 15, 30, 45, 60, 90, 120, 150, 180, 210])
    const stages = [0, 15, 46, 61, 121, 240]

    const sizes = []
    for (const upTo of stages) {
      sizes.push(
        size(
          await renderMei(
            draft(rhythm, upTo),
            undefined,
            rhythmProfile(rhythm.meter.beats, 1),
          ),
        ),
      )
    }

    for (const stage of sizes) expect(stage).toEqual(sizes[0])
    expect(Number(sizes[0]?.width)).toBeGreaterThan(0)
  })

  it('keeps the staff line itself at the same height', async () => {
    // The box being constant is only half of it. Verovio lays a page out from
    // the top, so anything drawn *above* the staff pushes the staff down — with
    // stems up, a bar filling with beams moved its own line by some 40px while
    // it was typed. The stems hang below instead, into space already reserved.
    const line = (svg: string) =>
      svg.match(/class="staff"[^>]*>\s*<path d="M\d+ (\d+)/)?.[1]

    const stages = [
      bar([]),
      bar([0]),
      bar([0, 60, 120, 180]),
      bar([0, 30, 60, 90, 120, 150, 180, 210]),
      bar([0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225]),
      bar([0, 20, 40, 60, 120, 180]),
    ]

    const heights = new Set<string | undefined>()
    for (const stage of stages) heights.add(line(await render(stage)))
    expect(heights.size).toBe(1)
  })

  it('leaves the notes already on the staff exactly where they were', async () => {
    // The other half of standing still: `<space>` padding keeps the measure's
    // duration constant, so Verovio spaces the notes already placed the same
    // way and they do not crawl sideways as more arrive.
    const rhythm = bar([0, 60, 120, 180])
    const positions = (svg: string) =>
      [...svg.matchAll(/class="notehead"[^>]*>\s*<use[^>]*translate\((\d+),/g)].map(
        (m) => m[1],
      )

    let previous: string[] = []
    for (const upTo of [1, 61, 121, 181]) {
      const current = positions(
        await renderMei(
          draft(rhythm, upTo),
          undefined,
          rhythmProfile(rhythm.meter.beats, 1),
        ),
      ) as string[]
      expect(current.slice(0, previous.length)).toEqual(previous)
      previous = current
    }
    expect(previous).toHaveLength(4)
  })
})

describe('two staves', () => {
  it('stacks a wrong answer over the right one, aligned', async () => {
    const yours = notateRhythm(bar([0, 60, 90, 180]))
    const correct = notateRhythm(bar([0, 60, 120, 180]))

    const svg = await renderMei(
      rhythmMei({
        meter: FOUR_FOUR,
        staves: [
          { nodes: yours, label: 'Yours' },
          { nodes: correct, label: 'Correct' },
        ],
      }),
      undefined,
      rhythmProfile(4, 2),
    )

    expect(countOf(svg, 'staff')).toBe(2)
    // One measure rather than two renders, so the barlines line up and the
    // same impact sits at the same x on both staves.
    expect(countOf(svg, 'measure')).toBe(1)
    expect(svg).toContain('Yours')
    expect(svg).toContain('Correct')
  })

  it('leaves its labels as text the app can restyle, and its notation as outlines', async () => {
    // `Score` gives engraved text the app's serif with one CSS class. That
    // works only because of two properties of this output, neither obvious
    // and neither ours to control, so they are pinned here rather than
    // discovered when the labels quietly go back to Times.
    const svg = await renderMei(
      rhythmMei({
        meter: FOUR_FOUR,
        staves: [
          { nodes: notateRhythm(bar([0, 60, 120, 180])), label: 'Yours' },
          { nodes: notateRhythm(bar([0, 60, 120, 180])), label: 'Correct' },
        ],
      }),
      undefined,
      rhythmProfile(4, 2),
    )

    // One: the font is a *presentation attribute*, which the cascade ranks
    // below every author rule. As `style="..."` it would take `!important`
    // to shift.
    expect(svg).toMatch(/<svg[^>]*\sfont-family="Times, serif"/)
    expect(svg).not.toMatch(/style="[^"]*font-family/)

    // Two: the only real text is the labels. Noteheads, rests, clefs and the
    // time signature are glyph outlines, so restyling text cannot reach them
    // and turn the notation into type.
    const texts = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([whole]) =>
      whole.replace(/<[^>]+>/g, '').trim(),
    )
    expect(texts).toEqual(['Yours', 'Correct'])
  })

  it('escapes a label rather than injecting it', async () => {
    const svg = await renderMei(
      rhythmMei({
        meter: FOUR_FOUR,
        staves: [{ nodes: notateRhythm(bar([0])), label: 'A & B' }],
      }),
      undefined,
      rhythmProfile(4, 2),
    )
    expect(svg).toContain('A &amp; B')
  })
})

describe('the page a rhythm is drawn on', () => {
  /** Every sixteenth of every beat: the densest bar the keyboard can produce. */
  function densest(meter: TimeSignature): Rhythm {
    const count = meter.beats * 4
    return {
      meter,
      onsets: Array.from({ length: count }, (_, i) => i * (TICKS_PER_BEAT / 4)),
    }
  }

  it('holds the densest bar that could be typed, in every metre', async () => {
    // Sized for what a *player* might write rather than for what the question
    // asked: the sixteenth key is on the keyboard whatever the level offers, so
    // a bar of them has to fit or it wraps onto a second system mid-answer.
    for (const key of METER_KEYS) {
      const meter = parseMeter(key) as TimeSignature
      const svg = await renderMei(
        rhythmMei({ meter, staves: [{ nodes: notateRhythm(densest(meter)) }] }),
        undefined,
        rhythmProfile(meter.beats, 1),
      )

      expect((svg.match(/class="system"/g) ?? []).length, key).toBe(1)

      const page = Number(svg.match(/viewBox="0 0 (\d+)/)?.[1] ?? 0)
      const rightmost = Math.max(
        ...[...svg.matchAll(/translate\((-?\d+),/g)].map((match) => Number(match[1])),
      )
      expect(rightmost, `${key} overflows its page`).toBeLessThan(page)
    }
  })

  it('gives a narrower metre a narrower page, so its staff is not drawn small', async () => {
    // One width for every metre would draw a 2/4 bar in the left third of a box
    // sized for 5/4, and the column would then scale the staff to half what it
    // should be.
    const width = async (beats: number) => {
      const meter: TimeSignature = { beats, unit: 4 }
      const svg = await renderMei(
        rhythmMei({ meter, staves: [{ nodes: notateRhythm(densest(meter)) }] }),
        undefined,
        rhythmProfile(beats, 1),
      )
      return Number(svg.match(/width="(\d+)px"/)?.[1] ?? 0)
    }

    expect(await width(2)).toBeLessThan(await width(4))
    expect(await width(4)).toBeLessThan(await width(5))
  })

  it('hands back the same profile object every time', () => {
    // `Score` compares it by identity to decide whether a finished render still
    // belongs to the render it asked for; a fresh object would re-render on
    // every paint, which on a keystroke-by-keystroke staff is every keystroke.
    expect(rhythmProfile(4, 1)).toBe(rhythmProfile(4, 1))
    expect(rhythmProfile(4, 2)).not.toBe(rhythmProfile(4, 1))
  })
})
