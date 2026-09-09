import { describe, expect, it } from 'vitest'

import {
  DEGREE_ALTERATIONS,
  DEGREE_NUMBERS,
  degreeKey,
  degreeNotes,
  degreePitch,
  degreesKey,
  degreesSoundEqual,
  keySignatureFor,
  nameMelody,
  parseDegreeKey,
  parseDegreesKey,
  tonicTriad,
  type Degree,
} from './degree'
import { alterationInKey } from './keySignature'
import { parsePitch, pitchKey, type Pitch } from './pitch'
import { MODE_IDS, TONIC_CHOICES, isCleanScale, scalePitches } from './scale'

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(text)
  return value
}

const d = (number: number, alteration: -1 | 0 | 1 = 0): Degree => ({ number, alteration })
const spell = (
  tonic: string,
  mode: Parameters<typeof degreePitch>[1],
  degree: Degree,
) => {
  const pitch = degreePitch(p(tonic), mode, degree)
  return pitch === undefined ? undefined : pitchKey(pitch)
}

describe('degree keys', () => {
  it('writes an accidental only where there is one', () => {
    expect(degreeKey(d(3))).toBe('3')
    expect(degreeKey(d(3, 1))).toBe('#3')
    expect(degreeKey(d(6, -1))).toBe('b6')
  })

  it('round-trips a degree and a whole melody', () => {
    for (const number of DEGREE_NUMBERS) {
      for (const alteration of DEGREE_ALTERATIONS) {
        const degree = d(number, alteration)
        expect(parseDegreeKey(degreeKey(degree))).toEqual(degree)
      }
    }

    const melody = [d(1), d(3, 1), d(6, -1), d(5)]
    expect(parseDegreesKey(degreesKey(melody))).toEqual(melody)
    expect(parseDegreesKey('')).toEqual([])
  })

  it('refuses a key that is not a degree', () => {
    // Only from a hand-edited row, or one written by a version that stored
    // something else; it must cost that row, not the whole query.
    for (const key of ['0', '8', 'x3', '3#', '', 'bb3', '3,4']) {
      expect(parseDegreeKey(key), key).toBeUndefined()
    }
    expect(parseDegreesKey('1,,3')).toBeUndefined()
    expect(parseDegreesKey('1,9')).toBeUndefined()
  })

  it('compares melodies by what they say', () => {
    expect(degreesSoundEqual(p('C4'), 'ionian', [d(1), d(3)], [d(1), d(3)])).toBe(true)
    expect(degreesSoundEqual(p('C4'), 'ionian', [d(1), d(3)], [d(1), d(3, 1)])).toBe(
      false,
    )
    expect(degreesSoundEqual(p('C4'), 'ionian', [d(1)], [d(1), d(3)])).toBe(false)
    expect(degreesSoundEqual(p('C4'), 'ionian', [], [])).toBe(true)
  })
})

describe('the note a degree names', () => {
  it('spells the mode it is in, not the major scale', () => {
    // The decision this whole exercise rests on: in A aeolian the third *is*
    // C, and it is called 3 — not the flattened third of A major.
    expect(spell('A4', 'aeolian', d(3))).toBe('C5')
    expect(spell('A4', 'aeolian', d(3, 1))).toBe('C#5')
    expect(spell('A4', 'aeolian', d(3, -1))).toBe('Cb5')

    // And in A ionian the third is C sharp, still called 3.
    expect(spell('A4', 'ionian', d(3))).toBe('C#5')
    expect(spell('A4', 'ionian', d(3, -1))).toBe('C5')
  })

  it('walks up from the tonic through one octave', () => {
    const degrees = DEGREE_NUMBERS.map((number) => spell('E4', 'ionian', d(number)))
    expect(degrees).toEqual(['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5'])
  })

  it('refuses a triple accidental rather than inventing one', () => {
    // F sharp major's seventh is E sharp; sharpening it again is E double
    // sharp, which is legal — one more would not be.
    expect(spell('F#4', 'ionian', d(7))).toBe('E#5')
    expect(spell('F#4', 'ionian', d(7, 1))).toBe('E##5')

    const scale = scalePitches(p('C#4'), 'ionian')
    expect(scale).toBeDefined()
    // C sharp major's seventh is B sharp; sharpened twice it runs out.
    expect(spell('C#4', 'ionian', d(7, 1))).toBe('B##4')
    expect(degreePitch(p('C#4'), 'lydian', d(4, 1))).toBeUndefined()
  })

  it('is undefined for a degree that does not exist', () => {
    expect(degreePitch(p('C4'), 'ionian', d(0))).toBeUndefined()
    expect(degreePitch(p('C4'), 'ionian', d(8))).toBeUndefined()
  })
})

describe('degreeNotes', () => {
  const notes = (
    tonic: string,
    mode: Parameters<typeof degreePitch>[1],
    numbers: number[],
  ) => degreeNotes(p(tonic), mode, numbers, [-1, 0, 1])

  it('collects one entry per sounding note, not per spelling', () => {
    const all = notes('C4', 'ionian', [...DEGREE_NUMBERS])
    // The octave above the tonic, every semitone of it, once each.
    expect(all.map((note) => note.semitones)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ])
  })

  it("gathers the names one note goes by, the scale's own first", () => {
    const all = notes('C4', 'ionian', [...DEGREE_NUMBERS])
    const namesAt = (semitones: number) =>
      all.find((note) => note.semitones === semitones)?.names.map(degreeKey)

    // A raised third is not a name for a note of its own: it is the fourth.
    expect(namesAt(5)).toEqual(['4', '#3'])
    // Between two degrees, both names stand, and neither is the plainer.
    expect(namesAt(1)).toEqual(['#1', 'b2'])
  })

  it('reaches no further than the degrees themselves', () => {
    // A flattened tonic is below everything the level teaches, and a raised
    // top degree above it. Neither belongs to a level bounded by 1 and 5.
    const five = notes('C4', 'ionian', [1, 2, 3, 4, 5])
    expect(five.map((note) => note.semitones)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(five.flatMap((note) => note.names.map(degreeKey))).not.toContain('b1')
    expect(five.flatMap((note) => note.names.map(degreeKey))).not.toContain('#5')
  })

  it('keeps a raised seventh out of a major key, where it is the octave', () => {
    const all = notes('C4', 'ionian', [...DEGREE_NUMBERS])
    expect(all.flatMap((note) => note.names.map(degreeKey))).not.toContain('#7')
  })

  it('drops the alterations that cannot be written', () => {
    // F double sharp is where a raised fourth of C sharp lydian would land.
    const fourth = notes('C#4', 'lydian', [4])
    expect(fourth.flatMap((note) => note.names.map(degreeKey))).toEqual(['4'])
  })
})

describe('nameMelody', () => {
  const line = (tonic: string, semitones: number[]) => {
    const all = degreeNotes(p(tonic), 'ionian', [...DEGREE_NUMBERS], [-1, 0, 1])
    const picked = semitones.map((value) => {
      const note = all.find((candidate) => candidate.semitones === value)
      if (note === undefined) throw new Error(`no note at ${value}`)
      return note
    })
    return nameMelody(picked).map(degreeKey)
  }

  it("takes the scale's own name wherever there is one", () => {
    expect(line('C4', [0, 4, 7])).toEqual(['1', '3', '5'])
  })

  it('raises a chromatic note that carries on up', () => {
    expect(line('C4', [5, 6, 7])).toEqual(['4', '#4', '5'])
  })

  it('lowers one that turns back down', () => {
    expect(line('C4', [7, 6, 5])).toEqual(['5', 'b5', '4'])
  })

  it('reads the last note from where it came', () => {
    expect(line('C4', [5, 6])).toEqual(['4', '#4'])
    expect(line('C4', [7, 6])).toEqual(['5', 'b5'])
  })
})

describe('degreesSoundEqual', () => {
  it('accepts either name for one note', () => {
    // Nothing in the sound separates them, so nothing in the marking may.
    expect(degreesSoundEqual(p('C4'), 'ionian', [d(1, 1)], [d(2, -1)])).toBe(true)
  })

  it('still refuses a different note', () => {
    expect(degreesSoundEqual(p('C4'), 'ionian', [d(1, 1)], [d(2)])).toBe(false)
  })
})

describe('tonicTriad', () => {
  it('is the first, third and fifth of the mode, and the octave', () => {
    expect(tonicTriad(p('C4'), 'ionian')?.map(pitchKey)).toEqual(['C4', 'E4', 'G4', 'C5'])
    // Minor, from the mode's own third — nothing here knows what "minor" is.
    expect(tonicTriad(p('A4'), 'aeolian')?.map(pitchKey)).toEqual([
      'A4',
      'C5',
      'E5',
      'A5',
    ])
    // And a diminished fifth where the mode has one.
    expect(tonicTriad(p('B4'), 'locrian')?.map(pitchKey)).toEqual([
      'B4',
      'D5',
      'F5',
      'B5',
    ])
  })
})

describe('the key signature a mode is written under', () => {
  it('gives a major key its own signature', () => {
    expect(keySignatureFor(p('C4'), 'ionian')).toBe('0')
    expect(keySignatureFor(p('E4'), 'ionian')).toBe('4s')
    expect(keySignatureFor(p('Bb4'), 'ionian')).toBe('2f')
  })

  it('gives a mode the signature of the scale it is a rotation of', () => {
    // D dorian is the white notes, so it is written under no signature at all
    // — and A aeolian, which is also the white notes, under the same.
    expect(keySignatureFor(p('D4'), 'dorian')).toBe('0')
    expect(keySignatureFor(p('A4'), 'aeolian')).toBe('0')
    expect(keySignatureFor(p('E4'), 'phrygian')).toBe('0')
    expect(keySignatureFor(p('F4'), 'lydian')).toBe('0')
    expect(keySignatureFor(p('G4'), 'mixolydian')).toBe('0')
    expect(keySignatureFor(p('B4'), 'locrian')).toBe('0')
  })

  it('agrees with the scale it claims to spell', () => {
    // The property, rather than a table: under the signature it returns, every
    // note of the scale needs no printed accidental.
    for (const tonic of TONIC_CHOICES) {
      for (const mode of MODE_IDS) {
        if (!isCleanScale(tonic, mode)) continue

        const root = { ...tonic, octave: 4 }
        const signature = keySignatureFor(root, mode)
        if (signature === undefined) continue

        const scale = scalePitches(root, mode)
        expect(scale, `${pitchKey(root)} ${mode}`).toBeDefined()
        for (const note of (scale ?? []).slice(0, 7)) {
          expect(
            alterationInKey(note.letter, signature),
            `${pitchKey(root)} ${mode}: ${pitchKey(note)} under ${signature}`,
          ).toBe(note.alteration)
        }
      }
    }
  })

  it('finds one for every scale a level could offer', () => {
    // A pairing with no signature is one the generator must not ask; this says
    // how rare that is, so a level is never quietly emptied by it.
    const homeless: string[] = []
    for (const tonic of TONIC_CHOICES) {
      for (const mode of MODE_IDS) {
        if (!isCleanScale(tonic, mode)) continue
        if (keySignatureFor({ ...tonic, octave: 4 }, mode) === undefined) {
          homeless.push(`${tonic.letter}${tonic.alteration} ${mode}`)
        }
      }
    }
    // Every clean diatonic mode is a rotation of some major scale, so within
    // seven sharps and seven flats they all have one.
    expect(homeless).toEqual([])
  })
})
