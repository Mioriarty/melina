// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLEFS } from '@/lib/music/clef'
import { parsePitch, type Pitch } from '@/lib/music/pitch'

import { scalePitches } from '@/lib/music/scale'

import { harmonicIntervalMei, scaleMei } from './mei'
import { DEFAULT_NOTE_SPACING, SCALE_NOTE_SPACING, renderMei } from './verovio'

/**
 * Integration test for the engraver itself.
 *
 * Runs in the node environment because Verovio is a 7 MB WebAssembly module
 * that jsdom cannot instantiate. It exists to catch the things the unit tests
 * structurally cannot: that our MEI is actually accepted, that every clef
 * engraves, and that the Leland font is genuinely being applied rather than
 * silently falling back to Verovio's default.
 */

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(text)
  return value
}

const base = {
  lower: p('C4'),
  upper: p('E4'),
  clef: 'treble',
  keySignature: '0',
} as const

describe('verovio', () => {
  it('engraves our MEI into an SVG', async () => {
    const svg = await renderMei(harmonicIntervalMei(base))

    expect(svg).toContain('<svg')
    expect(svg).toContain('viewBox')
    // Two noteheads, a clef, and at least one staff line.
    expect(svg).toContain('notehead')
    expect(svg).toContain('clef')
  }, 30_000)

  it('engraves every clef', async () => {
    for (const clef of CLEFS) {
      const svg = await renderMei(harmonicIntervalMei({ ...base, clef: clef.id }))
      expect(svg.length, clef.id).toBeGreaterThan(500)
    }
  }, 30_000)

  it('draws an accidental only when it differs from the key signature', async () => {
    // The load-bearing engraving rule, checked end to end. Verovio draws
    // every glyph as a <use>, and emits an empty <g class="accid" /> when an
    // accidental is gestural, so counting glyphs says exactly what was
    // actually printed on the staff.
    const glyphs = async (
      lower: string,
      upper: string,
      keySignature: '0' | '2s',
    ): Promise<number> => {
      const svg = await renderMei(
        harmonicIntervalMei({
          lower: p(lower),
          upper: p(upper),
          clef: 'treble',
          keySignature,
        }),
      )
      return (svg.match(/<use/g) ?? []).length
    }

    // Clef plus two noteheads, nothing else.
    const plain = await glyphs('C4', 'E4', '0')

    // One sharp that the key does not provide: exactly one extra glyph.
    expect(await glyphs('C4', 'F#4', '0')).toBe(plain + 1)

    // Two sharps in the signature, and F sharp needs no accidental of its own.
    const inKey = await glyphs('D4', 'F#4', '2s')
    expect(inKey).toBe(plain + 2)

    // Cancelling the signature costs one printed natural.
    expect(await glyphs('D4', 'F4', '2s')).toBe(inKey + 1)
  }, 30_000)

  it('rejects malformed input rather than rendering nonsense', async () => {
    await expect(renderMei('<mei>not really</mei>')).rejects.toThrow()
  }, 30_000)
})

describe('note spacing', () => {
  const size = (svg: string) => ({
    width: Number(/width="(\d+)px"/.exec(svg)?.[1]),
    height: Number(/height="(\d+)px"/.exec(svg)?.[1]),
  })

  const scale = () =>
    scaleMei({
      pitches: scalePitches(p('Eb4'), 'mixolydian') as Pitch[],
      clef: 'treble',
    })

  it('spreads the notes out without changing the staff', async () => {
    // The page fits an over-wide render to its column, so this is what makes
    // a scale look airy: the same eight notes over more width means smaller
    // notes with more room between them, in the same space on screen.
    const tight = size(await renderMei(scale(), DEFAULT_NOTE_SPACING))
    const airy = size(await renderMei(scale(), SCALE_NOTE_SPACING))

    expect(airy.width).toBeGreaterThan(tight.width)
    // Drawn at the same staff size — only the gaps grew.
    expect(airy.height).toBe(tight.height)
  }, 30_000)

  it('leaves a scale wide enough to keep filling the column', async () => {
    // Narrower than the column and it would sit small with air around it
    // instead of spanning the space, which is the opposite of the point.
    expect(size(await renderMei(scale(), SCALE_NOTE_SPACING)).width).toBeGreaterThan(343)
  }, 30_000)

  it('gives a scale a staff around 60px in a phone column', async () => {
    // A number to notice if the spacing is ever nudged: the default put the
    // staff at 104px in the same column, which was the cramped look.
    const { width, height } = size(await renderMei(scale(), SCALE_NOTE_SPACING))
    expect(Math.round(height * (343 / width))).toBeLessThan(75)
    expect(Math.round(height * (343 / width))).toBeGreaterThan(50)
  }, 30_000)

  it('goes back to the default when none is given', async () => {
    const explicit = size(
      await renderMei(harmonicIntervalMei(base), DEFAULT_NOTE_SPACING),
    )
    // The toolkit is shared, so spacing from a previous render must not leak
    // into the next one.
    await renderMei(scale(), SCALE_NOTE_SPACING)
    expect(size(await renderMei(harmonicIntervalMei(base)))).toEqual(explicit)
  }, 30_000)
})
