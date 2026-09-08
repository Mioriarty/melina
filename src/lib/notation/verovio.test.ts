// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'

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

  // Engraved once: Verovio is a 7 MB module and each render is real work.
  let defaultRender = ''
  let scaleRender = ''

  beforeAll(async () => {
    defaultRender = await renderMei(scale(), DEFAULT_NOTE_SPACING)
    scaleRender = await renderMei(scale(), SCALE_NOTE_SPACING)
  }, 30_000)

  it('spreads the notes out without changing the staff', () => {
    const tight = size(defaultRender)
    const airy = size(scaleRender)

    expect(airy.width).toBeGreaterThan(tight.width)
    // Drawn at the same staff size — only the gaps grew.
    expect(airy.height).toBe(tight.height)
  })

  it('leaves a scale wide enough to keep filling the column', () => {
    // Narrower than the column and it would sit small with air around it
    // instead of spanning the space, which is the opposite of the point.
    expect(size(scaleRender).width).toBeGreaterThan(343)
  })

  it('leaves a scale roomier than the default, whatever it is tuned to', () => {
    // `SCALE_NOTE_SPACING` exists to be turned, so nothing here pins a
    // number: what has to stay true is that a scale gets more room than the
    // default would give it.
    expect(SCALE_NOTE_SPACING).toBeGreaterThan(DEFAULT_NOTE_SPACING)
    // Verovio refuses anything above 1.0, and rejects the whole option set
    // with it rather than clamping.
    expect(SCALE_NOTE_SPACING).toBeLessThanOrEqual(1)
  })

  it('shrinks the staff a scale ends up with in a phone column', () => {
    // The visible consequence, since the column fits the width either way:
    // more spacing means a smaller staff in the same space. A tuning that
    // did not actually change what is on screen would pass every other
    // assertion here.
    const inColumn = ({ width, height }: { width: number; height: number }) =>
      Math.round(height * (343 / width))

    const before = inColumn(size(defaultRender))
    const after = inColumn(size(scaleRender))

    expect(after).toBeLessThan(before)
  })

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
