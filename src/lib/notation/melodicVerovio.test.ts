// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLEFS, getClef, type ClefId } from '@/lib/music/clef'
import {
  METER_KEYS,
  TICKS_PER_BEAT,
  parseMeter,
  type TimeSignature,
} from '@/lib/music/meter'
import type { Pitch } from '@/lib/music/pitch'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { measureInk } from '@/test/svgInk'

import { melodicPhraseMei } from './mei'
import { notateRhythm, type RhythmNode } from './rhythmNotation'
import { melodicPhraseProfile, renderMei } from './verovio'

/**
 * The engraver against a real melody.
 *
 * In the node environment for the same reason as `verovio.test.ts`: the toolkit
 * is 7 MB of WebAssembly that jsdom cannot instantiate. What it is here to
 * catch is what nothing structural can — that the systems break where they were
 * told to, that an accidental is drawn again after a barline, that the page
 * reserved for the worst case really holds it, and that a note already written
 * does not move as the rest of the phrase arrives.
 *
 * **The reserve is checked two ways, and the second is the one that bites.**
 * Nothing running off the page is the obvious check, and it is not enough:
 * Verovio squeezes a system to the width it is given, so a page that is too
 * narrow produces notation with no room between the notes rather than notation
 * hanging off the edge — invisible to any measurement of where the ink stops.
 * So the reserve is also checked against what the same music wants when it is
 * left to size its own page.
 */

const FOUR_FOUR = parseMeter('4/4') as TimeSignature

/**
 * The densest beat the keyboard can produce.
 *
 * Five, not four: a quintuplet puts more notes in a beat than sixteenths do,
 * and it brings a bracket above the staff with it. Sizing to sixteenths left
 * the page a little short in both directions.
 */
function densestBar(beats: number): readonly number[] {
  return Array.from({ length: beats * 5 }, (_, slot) => slot * (TICKS_PER_BEAT / 5))
}

/** The two ends of a clef's own range — two ledger lines either way. */
function reach(clefId: ClefId): { low: Pitch; high: Pitch } {
  const clef = getClef(clefId)
  return { low: clef.lowest, high: clef.highest }
}

/**
 * The widest, tallest thing that could ever be written into the page: every
 * note at one extreme of the clef or the other, each carrying a double
 * accidental of its own, under the widest key signature there is.
 */
function extremePitches(count: number, clefId: ClefId): Pitch[] {
  const { low, high } = reach(clefId)
  return Array.from({ length: count }, (_, index) =>
    index % 2 === 0
      ? { ...low, alteration: -2 as const }
      : { ...high, alteration: 2 as const },
  )
}

function worstCase(
  meter: TimeSignature,
  bars: number,
  staves: 1 | 2,
  clef: ClefId = 'treble',
) {
  const onsets = densestBar(meter.beats)
  const nodes = notateRhythm({ meter, onsets })
  const staff = {
    bars: Array.from({ length: bars }, () => nodes),
    pitches: extremePitches(onsets.length * bars, clef),
    ...(staves === 2 ? { label: 'Correct' } : {}),
  }

  return melodicPhraseMei({
    meter,
    clef,
    keySignature: '7s',
    barsPerSystem: 1,
    staves: staves === 2 ? [staff, staff] : [staff],
  })
}

function pageSize(svg: string): { width: number; height: number } {
  const { page } = measureInk(svg)
  return { width: page.x1 - page.x0, height: page.y1 - page.y0 }
}

const countOf = (svg: string, name: string) =>
  (svg.match(new RegExp(`class="[^"]*\\b${name}\\b`, 'g')) ?? []).length

/**
 * Accidentals actually **drawn**, which is not the same as accidentals encoded.
 *
 * Verovio emits an empty `<g class="accid"/>` for a gestural accidental — one
 * that fixes the sounding pitch and prints nothing — so counting the groups
 * counts the silent ones too. Counting the glyph inside each is what says what
 * reached the page, and it is how `verovio.test.ts` checks the same rule.
 */
const drawnAccidentals = (svg: string) =>
  (svg.match(/<g[^>]*class="accid"[^>]*>\s*<use/g) ?? []).length

const BAR_COUNTS = [1, 2, 4] as const
const STAFF_COUNTS = [1, 2] as const

describe('the page reserved for a melody', () => {
  it.each(
    METER_KEYS.flatMap((key) =>
      BAR_COUNTS.flatMap((bars) =>
        STAFF_COUNTS.map((staves) => [key, bars, staves] as const),
      ),
    ),
  )(
    'holds the worst case in %s, %i bars, %i staves',
    async (key, bars, staves) => {
      const meter = parseMeter(key) as TimeSignature
      const svg = await renderMei(
        worstCase(meter, bars, staves),
        undefined,
        melodicPhraseProfile(meter.beats, bars, 1, staves),
      )

      expect(measureInk(svg).clearance).toBeGreaterThan(0)
    },
    30000,
  )

  it.each(
    METER_KEYS.flatMap((key) => STAFF_COUNTS.map((staves) => [key, staves] as const)),
  )(
    'is no narrower than the same music sizing its own page: %s, %i staves',
    async (key, staves) => {
      // The check that catches cramping, which no measurement of the ink can:
      // Verovio fits a system to the page it is given, so a page that is too
      // narrow silently packs the notes together instead of overflowing.
      const meter = parseMeter(key) as TimeSignature
      const mei = worstCase(meter, 1, staves)

      const natural = pageSize(
        await renderMei(mei, undefined, {
          breaks: 'none',
          adjustPageWidth: true,
          adjustPageHeight: true,
        }),
      )
      const reserved = pageSize(
        await renderMei(mei, undefined, melodicPhraseProfile(meter.beats, 1, 1, staves)),
      )

      expect(reserved.width).toBeGreaterThanOrEqual(natural.width)
    },
    30000,
  )

  it.each(CLEFS.map((clef) => clef.id))(
    'holds the whole range of the %s clef',
    async (clef) => {
      const svg = await renderMei(
        worstCase(FOUR_FOUR, 1, 1, clef),
        undefined,
        melodicPhraseProfile(4, 1, 1, 1),
      )

      expect(measureInk(svg).clearance).toBeGreaterThan(0)
    },
    30000,
  )
})

describe('where the systems break', () => {
  /** How many staves Verovio drew, which is one per system per voice. */
  const systems = (svg: string) => countOf(svg, 'system')

  it('breaks where it was told to, not where the music happens to fit', async () => {
    for (const [bars, barsPerSystem, expected] of [
      [1, 1, 1],
      [2, 1, 2],
      [4, 1, 4],
      [4, 2, 2],
    ] as const) {
      const nodes = notateRhythm({ meter: FOUR_FOUR, onsets: [0, 60, 120, 180] })
      const staff = {
        bars: Array.from({ length: bars }, () => nodes),
        pitches: Array.from({ length: 4 * bars }, () => ({
          letter: 'G' as const,
          alteration: 0 as const,
          octave: 4,
        })),
      }

      const svg = await renderMei(
        melodicPhraseMei({
          meter: FOUR_FOUR,
          clef: 'treble',
          keySignature: '0',
          barsPerSystem,
          staves: [staff],
        }),
        undefined,
        melodicPhraseProfile(4, bars, barsPerSystem, 1),
      )

      expect(systems(svg), `${bars} bars, ${barsPerSystem} per system`).toBe(expected)
    }
  }, 30000)

  it('breaks the same way however full the bars are', async () => {
    // The reason the breaks are encoded at all. Left to the engraver, a phrase
    // sits on one system while it is short and jumps to two the moment a bar
    // fills — the staff halving under the player's hands, which is the failure
    // the fixed page exists to prevent, arriving by another door.
    const note = { letter: 'G' as const, alteration: 0 as const, octave: 4 }
    const stages: (readonly number[])[][] = [
      [[0], []],
      [[0, 60, 120, 180], []],
      [
        [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225],
        [0, 60],
      ],
    ]

    const seen = new Set<number>()
    for (const bars of stages) {
      const staff = {
        bars: bars.map((onsets) => notateRhythm({ meter: FOUR_FOUR, onsets })),
        pitches: Array.from({ length: bars.flat().length }, () => note),
      }
      const svg = await renderMei(
        melodicPhraseMei({
          meter: FOUR_FOUR,
          clef: 'treble',
          keySignature: '0',
          barsPerSystem: 1,
          staves: [staff],
        }),
        undefined,
        melodicPhraseProfile(4, 2, 1, 1),
      )
      seen.add(systems(svg))
    }

    expect(seen.size).toBe(1)
  }, 30000)
})

describe('a phrase on the page', () => {
  const note = (
    letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    alteration: -2 | -1 | 0 | 1 | 2,
    octave: number,
  ): Pitch => ({ letter, alteration, octave })

  async function render(
    bars: (readonly number[])[],
    pitches: Pitch[],
    keySignature: KeySignatureId = '0',
  ) {
    const staff = {
      bars: bars.map((onsets) => notateRhythm({ meter: FOUR_FOUR, onsets })),
      pitches,
    }
    return renderMei(
      melodicPhraseMei({
        meter: FOUR_FOUR,
        clef: 'treble',
        keySignature,
        barsPerSystem: 1,
        staves: [staff],
      }),
      undefined,
      melodicPhraseProfile(4, bars.length, 1, 1),
    )
  }

  it('draws five lines, a clef, a time signature and a key signature', async () => {
    const svg = await render([[0]], [note('F', 1, 4)], '1s')

    expect(countOf(svg, 'clef')).toBe(1)
    expect(countOf(svg, 'meterSig')).toBe(1)
    // Unlike a scale, which must stay keyless so its mode can be read off the
    // page, a melody's key is told to the player and printed here.
    expect(svg).toMatch(/class="keySig"[^>]*>[\s\S]{0,200}?<use/)
  })

  it('draws one notehead per impact, across bars', async () => {
    const svg = await render(
      [
        [0, 60, 120, 180],
        [0, 120],
      ],
      Array.from({ length: 6 }, () => note('G', 0, 4)),
    )

    expect(countOf(svg, 'notehead')).toBe(6)
  })

  it('prints an accidental again after a barline', async () => {
    // The whole reason this cannot reuse `melodyMei`, which writes one measure
    // and so runs its accidental state over the entire melody. An accidental
    // holds until the barline and no further; a note that inherited one across
    // a barline would read as a different pitch, and nothing about the page
    // would look wrong.
    const withinOneBar = await render([[0, 60]], [note('F', 1, 4), note('F', 1, 4)])
    const acrossTheBarline = await render([[0], [0]], [note('F', 1, 4), note('F', 1, 4)])

    // Inside one bar the second F sharp is already covered by the first.
    expect(drawnAccidentals(withinOneBar)).toBe(1)
    // Across the barline it is not, and has to be printed again.
    expect(drawnAccidentals(acrossTheBarline)).toBe(2)
  })

  it('still says nothing where the key signature already has', async () => {
    const svg = await render([[0]], [note('F', 1, 4)], '1s')
    // One sharp in the signature; the F sharp itself prints nothing.
    expect(drawnAccidentals(svg)).toBe(0)
  })

  it('renders every stage of a phrase at exactly the same size', async () => {
    // The regression guard for the staff moving under the player's hands, the
    // same one rhythmic dictation carries. Here it has to hold across bars as
    // well as within one.
    const note4 = note('G', 0, 4)
    const stages: (readonly number[])[][] = [
      [[], []],
      [[0], []],
      [[0, 60, 120, 180], []],
      [
        [0, 60, 120, 180],
        [0, 120],
      ],
    ]

    const sizes = []
    for (const bars of stages) {
      const svg = await render(
        bars,
        Array.from({ length: bars.flat().length }, () => note4),
      )
      sizes.push(pageSize(svg))
    }

    for (const stage of sizes) expect(stage).toEqual(sizes[0])
    expect(sizes[0]?.width).toBeGreaterThan(0)
  }, 30000)
})

describe('the placeholder first note', () => {
  const note = (
    letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    alteration: -2 | -1 | 0 | 1 | 2,
    octave: number,
  ): Pitch => ({ letter, alteration, octave })

  /**
   * A bar the player has not reached is an **empty** list of nodes, not a bar
   * of rests: that is what `draftNodes` hands over, and it is what leaves room
   * for the placeholder to stand in.
   */
  const untouched: readonly RhythmNode[] = []
  const typed = (onsets: readonly number[]) => notateRhythm({ meter: FOUR_FOUR, onsets })

  async function render(
    bars: (readonly RhythmNode[])[],
    pitches: Pitch[],
    placeholder?: Pitch,
    keySignature: KeySignatureId = '0',
  ) {
    const staff = {
      bars,
      pitches,
      ...(placeholder === undefined ? {} : { placeholder }),
    }
    return renderMei(
      melodicPhraseMei({
        meter: FOUR_FOUR,
        clef: 'treble',
        keySignature,
        barsPerSystem: 1,
        staves: [staff],
      }),
      undefined,
      melodicPhraseProfile(4, bars.length, 1, 1),
    )
  }

  /** The class Verovio copies out of `@type`, which is how it is greyed. */
  const marked = (svg: string) => (svg.match(/class="note placeholder"/g) ?? []).length

  it('draws one greyed note when nothing has been written', async () => {
    const svg = await render([untouched, untouched], [], note('G', 0, 4))

    expect(countOf(svg, 'notehead')).toBe(1)
    // Marked rather than coloured, so the stylesheet decides what grey is.
    expect(marked(svg)).toBe(1)
  })

  it('gives away the pitch and not the length', async () => {
    // A quarter note whatever the answer turns out to be: the length is the
    // thing there is to hear, so it is not in the hint.
    const svg = await render([untouched], [], note('G', 0, 4))
    // One notehead, no beam and no flag — a plain quarter.
    expect(countOf(svg, 'notehead')).toBe(1)
    expect(countOf(svg, 'beam')).toBe(0)
    expect(countOf(svg, 'flag')).toBe(0)
  })

  it('carries its own accidental, so the pitch is unambiguous', async () => {
    const bare = await render([untouched], [], note('G', 0, 4))
    const sharp = await render([untouched], [], note('F', 1, 4))

    expect(drawnAccidentals(bare)).toBe(0)
    expect(drawnAccidentals(sharp)).toBe(1)
  })

  it('says nothing where the key signature already has', async () => {
    const svg = await render([untouched], [], note('F', 1, 4), '1s')
    expect(drawnAccidentals(svg)).toBe(0)
  })

  it('disappears the moment something is written', async () => {
    const svg = await render([typed([0]), untouched], [note('B', 0, 4)], note('G', 0, 4))

    expect(marked(svg)).toBe(0)
    // And what is drawn is what was written, not the placeholder.
    expect(countOf(svg, 'notehead')).toBe(1)
  })

  it('stands only in the first bar', async () => {
    // Writing in bar one clears it even though bar two is still untouched.
    const svg = await render([typed([0]), untouched], [note('B', 0, 4)], note('G', 0, 4))
    expect(marked(svg)).toBe(0)
  })

  it('keeps the page the same size whether it is there or not', async () => {
    // It stands in a measure padded to full length like everything else, so
    // the box cannot move when it goes.
    const withGhost = await render([untouched, untouched], [], note('G', 0, 4))
    const without = await render([untouched, untouched], [])
    const written = await render(
      [typed([0]), untouched],
      [note('G', 0, 4)],
      note('G', 0, 4),
    )

    expect(pageSize(withGhost)).toEqual(pageSize(without))
    expect(pageSize(written)).toEqual(pageSize(without))
  })

  it('is not drawn on the staff showing the correct answer', async () => {
    // Only the staff being written into has a placeholder; the answer beside
    // it is an answer.
    const svg = await renderMei(
      melodicPhraseMei({
        meter: FOUR_FOUR,
        clef: 'treble',
        keySignature: '0',
        barsPerSystem: 1,
        staves: [
          { bars: [untouched], pitches: [], placeholder: note('G', 0, 4), label: 'You' },
          { bars: [typed([0])], pitches: [note('G', 0, 4)], label: 'Correct' },
        ],
      }),
      undefined,
      melodicPhraseProfile(4, 1, 1, 2),
    )

    expect(marked(svg)).toBe(1)
  })
})
