import { describe, expect, it } from 'vitest'

import { CLEFS } from '@/lib/music/clef'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { parsePitch, type Pitch } from '@/lib/music/pitch'

import { accidentalAttributes, harmonicIntervalMei } from './mei'

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(`bad test pitch: ${text}`)
  return value
}

describe('accidentalAttributes', () => {
  it('prints nothing when the key signature already says it', () => {
    // D major has F sharp, so an F sharp needs no accidental on the note.
    expect(accidentalAttributes(p('F#4'), '2s')).toBe(' accid.ges="s"')
    expect(accidentalAttributes(p('Bb4'), '1f')).toBe(' accid.ges="f"')
  })

  it('prints an accidental when the note disagrees with the signature', () => {
    // F natural in D major must be cancelled explicitly.
    expect(accidentalAttributes(p('F4'), '2s')).toBe(' accid="n"')
    expect(accidentalAttributes(p('B4'), '1f')).toBe(' accid="n"')
    expect(accidentalAttributes(p('F#4'), '0')).toBe(' accid="s"')
  })

  it('prints naturals as gestural in C major, where nothing is altered', () => {
    expect(accidentalAttributes(p('C4'), '0')).toBe(' accid.ges="n"')
    expect(accidentalAttributes(p('F4'), '0')).toBe(' accid.ges="n"')
  })

  it('handles double accidentals', () => {
    expect(accidentalAttributes(p('Dbb4'), '0')).toBe(' accid="ff"')
    expect(accidentalAttributes(p('F##4'), '2s')).toBe(' accid="ss"')
  })

  it('is consistent for every letter in every signature', () => {
    for (const signature of KEY_SIGNATURES) {
      for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
        for (const symbol of ['bb', 'b', '', '#', '##']) {
          const attributes = accidentalAttributes(p(`${letter}${symbol}4`), signature.id)
          // Exactly one of the two encodings, never both and never neither.
          const written = attributes.includes(' accid=')
          const gestural = attributes.includes(' accid.ges=')
          expect(written !== gestural, `${letter}${symbol} in ${signature.id}`).toBe(true)
        }
      }
    }
  })
})

describe('harmonicIntervalMei', () => {
  const base = {
    lower: p('C4'),
    upper: p('E4'),
    clef: 'treble',
    keySignature: '0',
  } as const

  it('produces a single chord of two notes', () => {
    const mei = harmonicIntervalMei(base)
    expect(mei.match(/<note /g)).toHaveLength(2)
    expect(mei).toContain('<chord')
  })

  it('writes pitch names in lower case, as MEI requires', () => {
    const mei = harmonicIntervalMei(base)
    expect(mei).toContain('pname="c" oct="4"')
    expect(mei).toContain('pname="e" oct="4"')
  })

  it('maps each clef to the right sign and line', () => {
    const expected: Record<string, [string, number]> = {
      treble: ['G', 2],
      bass: ['F', 4],
      alto: ['C', 3],
      tenor: ['C', 4],
    }

    for (const clef of CLEFS) {
      const [sign, line] = expected[clef.id] as [string, number]
      const mei = harmonicIntervalMei({ ...base, clef: clef.id })
      expect(mei, clef.id).toContain(`clef.shape="${sign}"`)
      expect(mei, clef.id).toContain(`clef.line="${line}"`)
    }
  })

  it('carries the key signature through', () => {
    expect(harmonicIntervalMei({ ...base, keySignature: '3f' })).toContain('keysig="3f"')
    expect(harmonicIntervalMei({ ...base, keySignature: '0' })).toContain('keysig="0"')
  })

  it('includes a header, which Verovio warns about otherwise', () => {
    expect(harmonicIntervalMei(base)).toContain('<meiHead>')
  })

  it('is well-formed XML with balanced tags', () => {
    const mei = harmonicIntervalMei(base)
    const opened = mei.match(/<([a-zA-Z]+)(?=[\s>/])/g) ?? []
    const closed = mei.match(/<\/([a-zA-Z]+)>/g) ?? []
    const selfClosing = mei.match(/\/>/g) ?? []
    // Every opened tag is either closed or self-closing.
    expect(opened.length).toBe(closed.length + selfClosing.length)
  })
})
