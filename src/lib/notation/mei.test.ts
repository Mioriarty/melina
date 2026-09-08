import { describe, expect, it } from 'vitest'

import { CLEFS } from '@/lib/music/clef'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { parsePitch, type Pitch } from '@/lib/music/pitch'

import { scalePitches } from '@/lib/music/scale'

import {
  accidentalAttributes,
  harmonicIntervalMei,
  melodicIntervalMei,
  scaleMei,
} from './mei'

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

  it('writes a double sharp as the double-sharp glyph, not as two sharps', () => {
    // MEI has both, and they draw differently: `x` is 𝄪, while `ss` is two
    // separate sharp signs — which is what Verovio dutifully drew until this
    // was fixed. A double flat really is two flats, so `ff` is correct.
    expect(accidentalAttributes(p('F##4'), '2s')).toBe(' accid="x"')
    expect(accidentalAttributes(p('C##4'), '0')).toBe(' accid="x"')
    expect(accidentalAttributes(p('Dbb4'), '0')).toBe(' accid="ff"')
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

describe('harmonic unisons', () => {
  const base = { clef: 'treble', keySignature: '0' } as const

  it('writes the two notes one after the other, not as a chord', () => {
    // There is only one spot on the staff for both noteheads, so there is
    // nowhere to put the second one.
    const mei = harmonicIntervalMei({ ...base, lower: p('C4'), upper: p('C#4') })
    expect(mei).not.toContain('<chord')
    expect(mei.match(/<note /g)).toHaveLength(2)
  })

  it('tells an augmented unison apart from a perfect one', () => {
    // The regression: stacked, C to C sharp and C sharp to C sharp engraved
    // as the same picture — one sharp against two touching noteheads — which
    // makes the question unanswerable however well you read.
    const augmented = harmonicIntervalMei({ ...base, lower: p('C4'), upper: p('C#4') })
    const perfect = harmonicIntervalMei({ ...base, lower: p('C#4'), upper: p('C#4') })

    expect(augmented).not.toBe(perfect)
    // The augmented one sharpens only its upper note; the perfect one prints
    // a sharp on both, because both notes have one.
    expect(augmented.match(/ accid="s"/g)).toHaveLength(1)
    expect(perfect.match(/ accid="s"/g)).toHaveLength(2)
  })

  it('still stacks anything that occupies two staff positions', () => {
    // Including the diminished second, which spans no semitones at all and
    // must go on looking like a second.
    const second = harmonicIntervalMei({ ...base, lower: p('C4'), upper: p('Dbb4') })
    expect(second).toContain('<chord')
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

describe('scaleMei', () => {
  const dMixolydian = scalePitches(p('D4'), 'mixolydian') as Pitch[]

  it('writes the scale as eight quarter notes', () => {
    const mei = scaleMei({ pitches: dMixolydian, clef: 'treble' })
    expect(mei.match(/<note /g)).toHaveLength(8)
    expect(mei.match(/dur="4"/g)).toHaveLength(8)
    expect(mei).not.toContain('<chord')
  })

  it('is always keyless, whatever the scale is', () => {
    // The mode has to be read from the accidentals in front of the notes. A
    // signature would answer half the question before it is asked: F sharp
    // mixolydian under one sharp looks exactly like G major.
    const fSharp = scalePitches(p('F#4'), 'mixolydian') as Pitch[]
    expect(scaleMei({ pitches: fSharp, clef: 'treble' })).toContain('keysig="0"')
    expect(scaleMei({ pitches: dMixolydian, clef: 'treble' })).toContain('keysig="0"')
  })

  it('prints every accidental the scale needs, and no others', () => {
    // D mixolydian is D E F# G A B C: one written sharp, and the C natural
    // that distinguishes it from D major stays silent because nothing in a
    // keyless staff says otherwise.
    const mei = scaleMei({ pitches: dMixolydian, clef: 'treble' })
    expect(mei.match(/ accid="/g)).toHaveLength(1)
    expect(mei).toContain('pname="f" oct="4" dur="4" accid="s"')
    expect(mei).toContain('pname="c" oct="5" dur="4" accid.ges="n"')
  })

  it('draws the notes in the order they are given', () => {
    // A descending scale is passed in reversed, and must read downwards
    // across the staff exactly as it was heard.
    const falling = [...dMixolydian].reverse()
    const mei = scaleMei({ pitches: falling, clef: 'bass' })
    const names = [...mei.matchAll(/pname="([a-g])" oct="(\d)"/g)].map(
      (match) => `${match[1]}${match[2]}`,
    )
    expect(names).toEqual(['d5', 'c5', 'b4', 'a4', 'g4', 'f4', 'e4', 'd4'])
  })
})

describe('notes that have not been revealed yet', () => {
  const hidden = (mei: string) => (mei.match(/visible="false"/g) ?? []).length
  const notes = (mei: string) => (mei.match(/<note /g) ?? []).length

  it('engraves the whole scale and draws only what has been revealed', () => {
    // Leaving the rest out would re-engrave a different piece of music: the
    // staff narrows and the note already on screen slides somewhere else.
    const pitches = scalePitches(p('D4'), 'dorian') as Pitch[]
    const asked = scaleMei({ pitches, clef: 'treble', hideFrom: 1 })

    expect(notes(asked)).toBe(8)
    expect(hidden(asked)).toBe(7)
    // The note that is shown is the first one, and it is not hidden.
    expect(asked.indexOf('visible="false"')).toBeGreaterThan(asked.indexOf('pname="d"'))
  })

  it('draws the whole scale once it is revealed', () => {
    const pitches = scalePitches(p('D4'), 'dorian') as Pitch[]
    const revealed = scaleMei({ pitches, clef: 'treble' })

    expect(notes(revealed)).toBe(8)
    expect(hidden(revealed)).toBe(0)
  })

  it('hides one note of a chord without dropping it', () => {
    const asked = harmonicIntervalMei({
      lower: p('C4'),
      upper: p('A4'),
      clef: 'treble',
      keySignature: '2s',
      hide: 'upper',
    })

    expect(notes(asked)).toBe(2)
    expect(hidden(asked)).toBe(1)
    // The lower note is the one on screen, so it keeps its accidental drawn.
    expect(asked).toContain('pname="c" oct="4" accid="n"/>')
  })

  it('hides the second note of a melodic interval', () => {
    const asked = melodicIntervalMei({
      first: p('A4'),
      second: p('C4'),
      clef: 'treble',
      keySignature: '0',
      hide: 'second',
    })

    expect(notes(asked)).toBe(2)
    expect(hidden(asked)).toBe(1)
    expect(asked).toContain('pname="c" oct="4" dur="2" accid.ges="n" visible="false"')
  })

  it('carries the hidden note through the unison special case', () => {
    // A harmonic unison is written as two successive notes rather than a
    // chord, so "hide the upper one" has to become "hide the second one".
    const asked = harmonicIntervalMei({
      lower: p('C4'),
      upper: p('C#4'),
      clef: 'treble',
      keySignature: '0',
      hide: 'upper',
    })

    expect(asked).not.toContain('<chord')
    expect(hidden(asked)).toBe(1)
    expect(asked).toContain('accid="s" visible="false"')
  })
})
