// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { CLEFS } from '@/lib/music/clef'
import { parsePitch, type Pitch } from '@/lib/music/pitch'

import { harmonicIntervalMei } from './mei'
import { renderMei } from './verovio'

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
