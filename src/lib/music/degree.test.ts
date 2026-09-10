import { describe, expect, it } from 'vitest'

import {
  DEGREE_ALTERATIONS,
  DEGREE_NUMBERS,
  degreeKey,
  degreeNotes,
  degreeOctave,
  degreePitch,
  degreesKey,
  degreesSoundEqual,
  keySignatureFor,
  nameMelody,
  parseDegreeKey,
  parseDegreesKey,
  stepAt,
  stepIndex,
  stepNotes,
  stepRange,
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
    return nameMelody(p(tonic), 'ionian', picked).map(degreeKey)
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

  it('will not write a double accidental where a plain note says the same thing', () => {
    // The direction rule assumes the two names cost the same on the page, and
    // that stops being true once a melody leaves the tonic's own octave. In
    // B flat mixolydian the note under the octave is both #7 and b1 of the
    // octave above: A natural, or B double flat. Descending, the direction
    // rule alone would reach for the lowered name and print the double flat.
    const notes = stepNotes(
      p('Bb4'),
      'mixolydian',
      stepRange(step(1, 0), step(1, 1)),
      DEGREE_ALTERATIONS,
    )
    const under = notes.find((note) => note.semitones === 11)
    const octave = notes.find((note) => note.semitones === 12)
    expect(under, 'no note a semitone under the octave').toBeDefined()

    const descending = nameMelody(p('Bb4'), 'mixolydian', [
      octave as (typeof notes)[number],
      under as (typeof notes)[number],
    ])
    expect(descending.map(degreeKey)).toEqual(["1'", '#7'])
    expect(spell('Bb4', 'mixolydian', descending[1] as Degree)).toBe('A5')
  })

  it('still lets the line decide between two single accidentals', () => {
    // F sharp and G flat are one accidental each, so nothing overrides the
    // direction the melody is going.
    expect(line('C4', [5, 6, 7])).toEqual(['4', '#4', '5'])
    expect(line('C4', [7, 6, 5])).toEqual(['5', 'b5', '4'])
  })

  it('does not prefer the smaller accidental over the direction of the line', () => {
    // The rule above rules out *double* accidentals and nothing else, and the
    // difference matters. An earlier version kept whichever name printed the
    // least ink, which in F sharp major turned a rising ♯4 — B♯, the
    // conventional spelling of an ascending chromatic note — into C♮, purely
    // because a natural is less ink than a sharp. Choosing between two single
    // accidentals is exactly what the direction is for.
    const notes = degreeNotes(p('F#4'), 'ionian', [...DEGREE_NUMBERS], DEGREE_ALTERATIONS)
    const at = (semitones: number) =>
      notes.find((note) => note.semitones === semitones) as (typeof notes)[number]

    const rising = nameMelody(p('F#4'), 'ionian', [at(5), at(6), at(7)])
    expect(rising.map(degreeKey)).toEqual(['4', '#4', '5'])
    expect(spell('F#4', 'ionian', rising[1] as Degree)).toBe('B#4')

    const falling = nameMelody(p('F#4'), 'ionian', [at(7), at(6), at(5)])
    expect(falling.map(degreeKey)).toEqual(['5', 'b5', '4'])
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

/* ------------------------------------------------------------------ steps

   A degree carrying an octave, and the contiguous run of them a melody draws
   on. Melodic dictation is the only exercise that leaves the tonic's own
   octave, so everything here is new ground for the model rather than a second
   reading of what scale degrees already asserts. */

const step = (number: number, octave: number): Degree =>
  octave === 0 ? { number, alteration: 0 } : { number, alteration: 0, octave }

describe('a degree in another octave', () => {
  it('is the same letter and accidental, an octave away', () => {
    expect(spell('C4', 'ionian', { number: 3, alteration: 0 })).toBe('E4')
    expect(spell('C4', 'ionian', { number: 3, alteration: 0, octave: 1 })).toBe('E5')
    expect(spell('C4', 'ionian', { number: 3, alteration: 0, octave: -1 })).toBe('E3')
  })

  it('keeps its alteration across the octave', () => {
    expect(spell('C4', 'ionian', { number: 6, alteration: -1, octave: -1 })).toBe('Ab3')
  })

  it('reads a bare degree as the tonic octave', () => {
    expect(degreeOctave({ number: 5, alteration: 0 })).toBe(0)
    expect(degreeOctave({ number: 5, alteration: 0, octave: -1 })).toBe(-1)
  })

  it('names the octave above the tonic as the tonic, an octave up', () => {
    const scale = scalePitches(p('C4'), 'ionian')
    expect(spell('C4', 'ionian', { number: 1, alteration: 0, octave: 1 })).toBe(
      pitchKey(scale?.[7] as Pitch),
    )
  })
})

describe('step keys', () => {
  it('marks the octave, and leaves the tonic octave bare', () => {
    expect(degreeKey(step(5, 0))).toBe('5')
    expect(degreeKey(step(5, 1))).toBe("5'")
    expect(degreeKey(step(5, -1))).toBe('5_')
    expect(degreeKey({ number: 3, alteration: -1, octave: 1 })).toBe("b3'")
  })

  it('never uses a comma, which is what separates a melody', () => {
    const every = DEGREE_NUMBERS.flatMap((number) =>
      [-2, -1, 0, 1, 2].flatMap((octave) =>
        DEGREE_ALTERATIONS.map((alteration) => degreeKey({ number, alteration, octave })),
      ),
    )
    expect(every.some((key) => key.includes(','))).toBe(false)
  })

  it('round-trips every step it can spell', () => {
    for (const number of DEGREE_NUMBERS) {
      for (const octave of [-2, -1, 0, 1, 2]) {
        for (const alteration of DEGREE_ALTERATIONS) {
          const degree: Degree = { number, alteration, octave }
          expect(parseDegreeKey(degreeKey(degree))).toEqual(
            octave === 0 ? { number, alteration } : degree,
          )
        }
      }
    }
  })

  it('round-trips a whole melody that crosses octaves', () => {
    const melody: Degree[] = [
      step(1, 0),
      { number: 3, alteration: 1 },
      step(5, -1),
      step(1, 1),
    ]
    expect(parseDegreesKey(degreesKey(melody))).toEqual(melody)
  })

  it('still reads a key written before degrees carried an octave', () => {
    expect(parseDegreeKey('b3')).toEqual({ number: 3, alteration: -1 })
    expect(parseDegreesKey('1,3,b6,5')).toHaveLength(4)
  })

  it('refuses a key that marks the octave both ways', () => {
    expect(parseDegreeKey("5'_")).toBeUndefined()
  })
})

describe('the ladder of steps', () => {
  it("numbers the tonic's own octave from zero", () => {
    expect(stepIndex(step(1, 0))).toBe(0)
    expect(stepIndex(step(7, 0))).toBe(6)
    expect(stepIndex(step(1, 1))).toBe(7)
    expect(stepIndex(step(7, -1))).toBe(-1)
  })

  it('round-trips a rung back to the step it names', () => {
    for (let rung = -20; rung <= 20; rung += 1) {
      expect(stepIndex(stepAt(rung))).toBe(rung)
    }
  })

  it('runs from one end to the other, inclusive', () => {
    expect(stepRange(step(1, 0), step(5, 0)).map(degreeKey)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
  })

  it('crosses the octave, so the range is a ladder and not a wheel', () => {
    expect(stepRange(step(6, -1), step(2, 0)).map(degreeKey)).toEqual([
      '6_',
      '7_',
      '1',
      '2',
    ])
  })

  it('holds the octave above the tonic as its own rung', () => {
    const range = stepRange(step(1, 0), step(1, 1))
    expect(range).toHaveLength(8)
    expect(degreeKey(range[7] as Degree)).toBe("1'")
  })

  it('is empty when the ends are the wrong way round', () => {
    expect(stepRange(step(5, 0), step(1, 0))).toEqual([])
  })
})

describe('stepNotes across octaves', () => {
  it('offers one note per sounding pitch over the whole range', () => {
    const notes = stepNotes(p('C4'), 'ionian', stepRange(step(1, 0), step(1, 1)), [0])
    expect(notes.map((note) => note.semitones)).toEqual([0, 2, 4, 5, 7, 9, 11, 12])
  })

  it('collapses a raised seventh into the octave it already has', () => {
    const notes = stepNotes(
      p('C4'),
      'ionian',
      stepRange(step(1, 0), step(1, 1)),
      DEGREE_ALTERATIONS,
    )
    const octave = notes.find((note) => note.semitones === 12)
    expect(octave?.names.map(degreeKey)).toContain("1'")
    // One note, whatever it can be called: `#7` and `1'` are one sound.
    expect(notes.filter((note) => note.semitones === 12)).toHaveLength(1)
  })

  it('keeps an alteration past either end of the range out of it', () => {
    const notes = stepNotes(
      p('C4'),
      'ionian',
      stepRange(step(1, 0), step(5, 0)),
      DEGREE_ALTERATIONS,
    )
    const reach = notes.map((note) => note.semitones)
    expect(Math.min(...reach)).toBe(0)
    expect(Math.max(...reach)).toBe(7)
  })

  it('reaches below the tonic when the range does', () => {
    const notes = stepNotes(p('C4'), 'ionian', stepRange(step(5, -1), step(1, 0)), [0])
    expect(notes.map((note) => note.semitones)).toEqual([-5, -3, -1, 0])
  })

  it('agrees with degreeNotes over one octave', () => {
    const range = stepNotes(
      p('Eb4'),
      'aeolian',
      stepRange(step(1, 0), step(5, 0)),
      DEGREE_ALTERATIONS,
    )
    const set = degreeNotes(p('Eb4'), 'aeolian', [1, 2, 3, 4, 5], DEGREE_ALTERATIONS)
    expect(range).toEqual(set)
  })
})

describe('grading a melody that crosses octaves', () => {
  it('marks two spellings of one sound equal', () => {
    const heard: Degree[] = [step(1, 0), { number: 4, alteration: 1 }]
    const written: Degree[] = [step(1, 0), { number: 5, alteration: -1 }]
    expect(degreesSoundEqual(p('C4'), 'ionian', heard, written)).toBe(true)
  })

  it('does not confuse a degree with the same degree an octave away', () => {
    expect(degreesSoundEqual(p('C4'), 'ionian', [step(3, 0)], [step(3, 1)])).toBe(false)
  })
})
