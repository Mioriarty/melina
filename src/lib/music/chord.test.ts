import { describe, expect, it } from 'vitest'

import {
  CHORD_QUALITIES,
  SEVENTH_QUALITIES,
  TRIAD_QUALITIES,
  chordKey,
  chordNotes,
  chordPitches,
  chordSignature,
  chordSize,
  chordVoicing,
  cleanRoots,
  closeChord,
  closePosition,
  hearableInversions,
  inversionsFor,
  isCleanChord,
  needsDoubleAccidental,
  isSymmetric,
  parseChordKey,
  readChord,
  sameChord,
  topsFor,
  type Chord,
} from './chord'
import { TONIC_CHOICES, tonicKey } from './scale'

/** Every chord the model can spell, at every inversion and every Lage. */
function everyChord(): Chord[] {
  const chords: Chord[] = []
  for (const quality of CHORD_QUALITIES) {
    for (const root of cleanRoots(quality)) {
      for (const inversion of inversionsFor(quality)) {
        for (const top of topsFor(quality, inversion)) {
          chords.push({ root, quality, inversion, top })
        }
      }
    }
  }
  return chords
}

const spelling = (root: string, quality: (typeof CHORD_QUALITIES)[number]) =>
  chordNotes(
    {
      letter: root[0] as 'C',
      alteration: root.length > 1 ? (root[1] === 'b' ? -1 : 1) : 0,
    },
    quality,
  )?.map(tonicKey)

describe('chord spelling', () => {
  it('spells by interval, so the letters come out right', () => {
    expect(spelling('C', 'major')).toEqual(['C', 'E', 'G'])
    expect(spelling('C', 'minor')).toEqual(['C', 'Eb', 'G'])
    expect(spelling('C', 'diminished')).toEqual(['C', 'Eb', 'Gb'])
    expect(spelling('C', 'augmented')).toEqual(['C', 'E', 'G#'])
    expect(spelling('C', 'dominant-seventh')).toEqual(['C', 'E', 'G', 'Bb'])
    expect(spelling('C', 'major-seventh')).toEqual(['C', 'E', 'G', 'B'])
    expect(spelling('C', 'minor-seventh')).toEqual(['C', 'Eb', 'G', 'Bb'])
  })

  it('spells the half-diminished seventh with a flattened fifth, not a sharpened fourth', () => {
    // The case that proves intervals rather than semitones: B♭ D♭ F♭ A♭ is
    // four letters running in thirds; B♭ C♯ E G♯ is the same sound and not a
    // chord anybody could read.
    expect(spelling('Bb', 'half-diminished-seventh')).toEqual(['Bb', 'Db', 'Fb', 'Ab'])
  })

  it('spells the diminished seventh with a diminished seventh', () => {
    expect(spelling('B', 'diminished-seventh')).toEqual(['B', 'D', 'F', 'Ab'])
    // Not A natural: a major sixth is the same key on a piano and the wrong
    // letter on the page.
    expect(spelling('C', 'diminished-seventh')).toEqual(['C', 'Eb', 'Gb', 'Bbb'])
  })

  it('allows one double accidental and refuses two, and works out which', () => {
    // Computed rather than tabulated, the way `isCleanScale` is. A diminished
    // seventh above C is B double flat and there is no other way to write it,
    // so one double is allowed; on E♭ the same chord would want B𝄫 *and* D𝄫,
    // which is a spelling nobody writes because such a chord is respelled.
    const c = { letter: 'C' as const, alteration: 0 as const }
    expect(isCleanChord(c, 'diminished-seventh')).toBe(true)
    expect(needsDoubleAccidental(c, 'diminished-seventh')).toBe(true)
    expect(isCleanChord({ letter: 'E', alteration: -1 }, 'diminished-seventh')).toBe(
      false,
    )
    expect(isCleanChord({ letter: 'D', alteration: -1 }, 'diminished-seventh')).toBe(
      false,
    )
    expect(needsDoubleAccidental(c, 'major')).toBe(false)

    for (const quality of CHORD_QUALITIES) {
      expect(cleanRoots(quality).length).toBeGreaterThan(6)
      for (const root of cleanRoots(quality)) {
        const doubles = (chordNotes(root, quality) ?? []).filter(
          (note) => Math.abs(note.alteration) > 1,
        )
        expect(doubles.length, `${root.letter} ${quality}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('spells all nine on C, which is what lets the guide draw them on one root', () => {
    // The guide draws its examples on one root so that the only difference
    // between one staff and the next is the accidentals — the same reason the
    // modes guide draws all seven modes on C. All nine allow it, the
    // diminished seventh included, because its double flat is a spelling the
    // model keeps rather than one it works around.
    const c = { letter: 'C' as const, alteration: 0 as const }
    for (const quality of CHORD_QUALITIES) {
      expect(isCleanChord(c, quality), quality).toBe(true)
    }
    expect(chordNotes(c, 'diminished-seventh')?.map(tonicKey)).toEqual([
      'C',
      'Eb',
      'Gb',
      'Bbb',
    ])
  })
})

describe('inversion and Lage', () => {
  it('counts four triads and five sevenths', () => {
    expect(TRIAD_QUALITIES).toHaveLength(4)
    expect(SEVENTH_QUALITIES).toHaveLength(5)
    expect(CHORD_QUALITIES).toHaveLength(9)
    for (const quality of TRIAD_QUALITIES) expect(chordSize(quality)).toBe(3)
    for (const quality of SEVENTH_QUALITIES) expect(chordSize(quality)).toBe(4)
  })

  it('makes the Lage independent of the inversion', () => {
    // Both are root position; only what stands on top differs. That is the
    // whole reason Lage can be asked at all without a fourth voice.
    const c = { letter: 'C' as const, alteration: 0 as const }
    const quintlage = chordVoicing({ root: c, quality: 'major', inversion: 0, top: 2 })
    const terzlage = chordVoicing({ root: c, quality: 'major', inversion: 0, top: 1 })

    expect(quintlage?.map(tonicKey)).toEqual(['C', 'E', 'G'])
    expect(terzlage?.map(tonicKey)).toEqual(['C', 'G', 'E'])
  })

  it('stacks straight up when the Lage is the one stacking would give', () => {
    for (const quality of CHORD_QUALITIES) {
      for (const inversion of inversionsFor(quality)) {
        const chord = closeChord({ letter: 'C', alteration: 0 }, quality, inversion)
        expect(chord.top).toBe(closePosition(quality, inversion))

        const notes = chordNotes(chord.root, quality) ?? []
        const size = chordSize(quality)
        const expected = Array.from(
          { length: size },
          (_, i) => notes[(inversion + i) % size],
        )
        expect(chordVoicing(chord)).toEqual(expected)
      }
    }
  })

  it('never puts one member in the bass and the same one on top', () => {
    for (const quality of CHORD_QUALITIES) {
      for (const inversion of inversionsFor(quality)) {
        expect(topsFor(quality, inversion)).not.toContain(inversion)
        expect(topsFor(quality, inversion)).toHaveLength(chordSize(quality) - 1)
      }
    }
  })
})

describe('reading a chord back', () => {
  it('reads every chord it can spell back to the chord that spelled it', () => {
    // The round trip, as `modeOf` is for scales and `onsetsOf` for rhythms:
    // the generator is checked against the model rather than trusted.
    const chords = everyChord()
    expect(chords.length).toBeGreaterThan(300)

    for (const chord of chords) {
      const pitches = chordPitches(chord)
      expect(pitches, chordKey(chord)).toBeDefined()
      const read = readChord(pitches ?? [])
      expect(read, chordKey(chord)).toBeDefined()
      expect(sameChord(read as Chord, chord), chordKey(chord)).toBe(true)
    }
  })

  it('refuses a stack that is not one of the nine qualities', () => {
    const notes = chordPitches(closeChord({ letter: 'C', alteration: 0 }, 'major')) ?? []
    // A doubled note is not a chord here: the answer is the distinct members.
    expect(readChord([...notes, { ...notes[0]!, octave: 6 }])).toBeUndefined()
    // A stack of fourths is not in the vocabulary at all.
    expect(
      readChord([
        { letter: 'C', alteration: 0, octave: 4 },
        { letter: 'F', alteration: 0, octave: 4 },
        { letter: 'B', alteration: -1, octave: 4 },
      ]),
    ).toBeUndefined()
    expect(readChord([])).toBeUndefined()
  })

  it('round-trips the stored form', () => {
    for (const chord of everyChord()) {
      const parsed = parseChordKey(chordKey(chord))
      expect(parsed, chordKey(chord)).toBeDefined()
      expect(sameChord(parsed as Chord, chord)).toBe(true)
    }
    expect(parseChordKey('C:major:0:0')).toBeUndefined()
    expect(parseChordKey('C:major:3:1')).toBeUndefined()
    expect(parseChordKey('H:major:0:2')).toBeUndefined()
    expect(parseChordKey('C:added-sixth:0:2')).toBeUndefined()
  })
})

describe('what an ear can be asked', () => {
  it('finds the symmetric chords rather than being told them', () => {
    // The augmented triad divides the octave into three and the fully
    // diminished seventh into four, so each maps onto itself under rotation.
    for (const quality of CHORD_QUALITIES) {
      expect(isSymmetric(quality), quality).toBe(
        quality === 'augmented' || quality === 'diminished-seventh',
      )
    }
  })

  it('asks a symmetric chord in root position only', () => {
    expect(hearableInversions('augmented')).toEqual([0])
    expect(hearableInversions('diminished-seventh')).toEqual([0])
    expect(hearableInversions('major')).toEqual([0, 1, 2])
    expect(hearableInversions('dominant-seventh')).toEqual([0, 1, 2, 3])
  })

  it('gives every hearable answer a sound of its own', () => {
    // The property `catalog.test.ts` holds intervals to, in the form a chord
    // needs it: no two answers a hearing round can ask for may produce the
    // same sound. Asserting the property rather than a list is what makes a
    // well-meant addition fail loudly instead of quietly making a question
    // unanswerable.
    const seen = new Map<string, string>()

    for (const quality of CHORD_QUALITIES) {
      for (const inversion of hearableInversions(quality)) {
        for (const top of topsFor(quality, inversion)) {
          const chord: Chord = {
            root: { letter: 'C', alteration: 0 },
            quality,
            inversion,
            top,
          }
          const signature = chordSignature(chord).join(',')
          const already = seen.get(signature)
          expect(
            already,
            `${chordKey(chord)} sounds exactly like ${already}`,
          ).toBeUndefined()
          seen.set(signature, chordKey(chord))
        }
      }
    }
  })

  it('measures the sound from the bass, so the register cannot change it', () => {
    const chord = closeChord({ letter: 'C', alteration: 0 }, 'dominant-seventh')
    const other = closeChord({ letter: 'F', alteration: 1 }, 'dominant-seventh')
    expect(chordSignature(chord)).toEqual([0, 4, 7, 10])
    expect(chordSignature(other)).toEqual(chordSignature(chord))
  })
})

describe('placing a chord', () => {
  it('places every clean chord somewhere on the staff', () => {
    for (const root of TONIC_CHOICES) {
      for (const quality of CHORD_QUALITIES) {
        if (!isCleanChord(root, quality)) continue
        const pitches = chordPitches(closeChord(root, quality))
        expect(pitches, tonicKey(root) + ' ' + quality).toHaveLength(chordSize(quality))
      }
    }
  })

  it('stacks each note above the one before it', () => {
    for (const chord of everyChord()) {
      const pitches = chordPitches(chord) ?? []
      for (let i = 1; i < pitches.length; i += 1) {
        expect(pitches[i]!.octave * 7).toBeGreaterThan(-Infinity)
        const lower = pitches[i - 1]!
        const upper = pitches[i]!
        const rises =
          upper.octave > lower.octave ||
          (upper.octave === lower.octave &&
            'CDEFGAB'.indexOf(upper.letter) > 'CDEFGAB'.indexOf(lower.letter))
        expect(rises, chordKey(chord)).toBe(true)
      }
    }
  })
})
