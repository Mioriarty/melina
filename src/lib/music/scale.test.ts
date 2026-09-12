import { describe, expect, it } from 'vitest'

import { intervalBetween, intervalKey } from './interval'
import { chromaticValue, diatonicValue, parsePitch, pitchKey, type Pitch } from './pitch'
import {
  ASCENDING_ONLY_MODE_IDS,
  DIATONIC_MODE_IDS,
  MELODY_MODE_IDS,
  MINOR_SCALE_IDS,
  MODES,
  MODE_IDS,
  TONIC_CHOICES,
  cleanTonics,
  fittingOctaves,
  isAscendingOnly,
  isCleanScale,
  isMelodyModeId,
  modeOf,
  printedAccidentals,
  scalePitches,
  signatureMode,
  tonicKey,
  parseTonicKey,
  type ModeId,
} from './scale'

function p(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(`bad test pitch: ${text}`)
  return value
}

function spell(tonic: string, mode: ModeId): string {
  const pitches = scalePitches(p(tonic), mode)
  if (pitches === undefined) return 'unspellable'
  return pitches.map(pitchKey).join(' ')
}

describe('the modes', () => {
  it('spells the white-key modes with no accidentals at all', () => {
    // The definition of a diatonic mode: the same seven letters, started in a
    // different place. If any of these grows an accidental, the interval
    // pattern behind it is wrong.
    expect(spell('C4', 'ionian')).toBe('C4 D4 E4 F4 G4 A4 B4 C5')
    expect(spell('D4', 'dorian')).toBe('D4 E4 F4 G4 A4 B4 C5 D5')
    expect(spell('E4', 'phrygian')).toBe('E4 F4 G4 A4 B4 C5 D5 E5')
    expect(spell('F4', 'lydian')).toBe('F4 G4 A4 B4 C5 D5 E5 F5')
    expect(spell('G4', 'mixolydian')).toBe('G4 A4 B4 C5 D5 E5 F5 G5')
    expect(spell('A4', 'aeolian')).toBe('A4 B4 C5 D5 E5 F5 G5 A5')
    expect(spell('B4', 'locrian')).toBe('B4 C5 D5 E5 F5 G5 A5 B5')
  })

  it('spells a transposed mode with the accidentals a musician would write', () => {
    // Not C♯ where a D♭ belongs: the letters run in order and the accidental
    // follows from them, which is the whole reason a scale is built out of
    // intervals rather than semitone counts.
    expect(spell('Eb4', 'mixolydian')).toBe('Eb4 F4 G4 Ab4 Bb4 C5 Db5 Eb5')
    expect(spell('Bb4', 'dorian')).toBe('Bb4 C5 Db5 Eb5 F5 G5 Ab5 Bb5')
    expect(spell('F#4', 'phrygian')).toBe('F#4 G4 A4 B4 C#5 D5 E5 F#5')
  })

  it('walks the letters in order, one per degree', () => {
    for (const mode of MODE_IDS) {
      for (const tonic of TONIC_CHOICES) {
        const pitches = scalePitches({ ...tonic, octave: 4 }, mode)
        if (pitches === undefined) continue

        pitches.forEach((pitch, index) => {
          expect(
            diatonicValue(pitch) - diatonicValue(pitches[0] as Pitch),
            `${tonicKey(tonic)} ${mode} degree ${index + 1}`,
          ).toBe(index)
        })
      }
    }
  })

  it('spans exactly an octave', () => {
    for (const mode of MODE_IDS) {
      const pitches = scalePitches(p('C4'), mode)
      expect(pitches, mode).toBeDefined()
      const first = pitches?.[0] as Pitch
      const last = pitches?.[7] as Pitch
      expect(chromaticValue(last) - chromaticValue(first), mode).toBe(12)
    }
  })

  it('is a rotation of the major scale — every diatonic mode, and only those', () => {
    // Dorian is the major scale played from its second degree, phrygian from
    // its third, and so on. Stated as pitch content — the same seven notes,
    // started somewhere else — so it is independent of how the degrees
    // happen to be written down in `DEGREE_QUALITIES`.
    const cMajor = (scalePitches(p('C4'), 'ionian') as readonly Pitch[]).slice(0, 7)
    const content = new Set(cMajor.map(tonicKey))

    for (const mode of MODES) {
      if (mode.degree === undefined) continue
      const tonic = cMajor[mode.degree - 1] as Pitch
      const scale = (scalePitches(tonic, mode.id) as readonly Pitch[]).slice(0, 7)
      expect(new Set(scale.map(tonicKey)), mode.id).toEqual(content)
    }

    // The other half of it: carrying a degree *is* being a rotation, so the
    // two minor scales must not have one. Harmonic minor raises a seventh
    // that no rotation of the major scale raises, and there is no degree it
    // could be said to begin on.
    expect(
      MODES.filter((mode) => mode.degree === undefined).map((mode) => mode.id),
    ).toEqual([...MINOR_SCALE_IDS])
    for (const id of MINOR_SCALE_IDS) {
      const notes = new Set(
        (scalePitches(p('C4'), id) as readonly Pitch[]).slice(0, 7).map(tonicKey),
      )
      // Not the white notes from anywhere: that is what makes it not a mode.
      for (const tonic of cMajor) {
        const rotation = new Set(
          (scalePitches(tonic, 'ionian') as readonly Pitch[]).slice(0, 7).map(tonicKey),
        )
        expect(
          [...notes].every((note) => rotation.has(note)),
          `${id} on ${tonicKey(tonic)}`,
        ).toBe(false)
      }
    }
  })

  it('spells the two minor scales the way they are written', () => {
    // Nothing new in the model: raising a degree is one stored interval, and
    // the letters still run in order. E♭ harmonic minor is the case worth
    // pinning — the sixth is C♭ and the seventh D♮, never B♮ and D♮, which is
    // the same sound spelled as something that is not a sixth.
    expect(spell('A4', 'harmonicMinor')).toBe('A4 B4 C5 D5 E5 F5 G#5 A5')
    expect(spell('A4', 'melodicMinor')).toBe('A4 B4 C5 D5 E5 F#5 G#5 A5')
    expect(spell('Eb4', 'harmonicMinor')).toBe('Eb4 F4 Gb4 Ab4 Bb4 Cb5 D5 Eb5')
    expect(spell('Eb4', 'melodicMinor')).toBe('Eb4 F4 Gb4 Ab4 Bb4 C5 D5 Eb5')
  })

  it('puts an augmented second between the sixth and seventh of harmonic minor', () => {
    // The sound the scale is known by, and it is what two stored intervals
    // already say rather than anything tabulated.
    const scale = scalePitches(p('A4'), 'harmonicMinor') as readonly Pitch[]
    const step = intervalBetween(scale[5] as Pitch, scale[6] as Pitch)
    expect(step === undefined ? '' : intervalKey(step)).toBe(
      intervalKey({
        number: 2,
        quality: 'augmented',
      }),
    )

    // Melodic minor raises the sixth as well, so the gap closes to a tone.
    const melodic = scalePitches(p('A4'), 'melodicMinor') as readonly Pitch[]
    const closed = intervalBetween(melodic[5] as Pitch, melodic[6] as Pitch)
    expect(closed === undefined ? '' : intervalKey(closed)).toBe(
      intervalKey({
        number: 2,
        quality: 'major',
      }),
    )
  })

  it('refuses a minor scale with no minor key to stand in', () => {
    // D♭ melodic minor spells perfectly well on its own — raising the sixth
    // is exactly what turns B double flat into B♭ — but D♭ minor is not a key
    // anybody writes, and the scale is written under one. C♯ is where it
    // belongs, and that is offered.
    expect(spell('Db4', 'melodicMinor')).toBe('Db4 Eb4 Fb4 Gb4 Ab4 Bb4 C5 Db5')
    expect(isCleanScale({ letter: 'D', alteration: -1 }, 'melodicMinor')).toBe(false)
    expect(isCleanScale({ letter: 'C', alteration: 1 }, 'melodicMinor')).toBe(true)
  })

  it('gives every mode a different sound, so a question is always answerable', () => {
    // The property interval hearing has to enforce by hand — there, an
    // augmented second and a minor third are one sound with two names. Modes
    // have no such collision, and this is what says so.
    const sounds = MODE_IDS.map((mode) => {
      const pitches = scalePitches(p('C4'), mode) as readonly Pitch[]
      return pitches.map(chromaticValue).join(',')
    })
    expect(new Set(sounds).size).toBe(MODE_IDS.length)
  })

  it('names the degrees it claims to', () => {
    for (const mode of MODES) {
      const pitches = scalePitches(p('C4'), mode.id) as readonly Pitch[]

      mode.intervals.forEach((interval, index) => {
        const actual = intervalBetween(pitches[0] as Pitch, pitches[index] as Pitch)
        expect(
          actual === undefined ? '' : intervalKey(actual),
          `${mode.id} ${index}`,
        ).toBe(intervalKey(interval))
      })
    }
  })
})

describe('modeOf', () => {
  it('reads a scale back to the mode that spelled it', () => {
    for (const mode of MODE_IDS) {
      for (const tonic of TONIC_CHOICES) {
        const pitches = scalePitches({ ...tonic, octave: 4 }, mode)
        if (pitches === undefined) continue
        expect(modeOf(pitches), `${tonicKey(tonic)} ${mode}`).toBe(mode)
      }
    }
  })

  it('refuses anything that is not a whole scale', () => {
    const cMajor = scalePitches(p('C4'), 'ionian') as readonly Pitch[]
    expect(modeOf(cMajor.slice(0, 5))).toBeUndefined()
    expect(modeOf([])).toBeUndefined()
    // One note flattened is no mode at all.
    expect(modeOf([...cMajor.slice(0, 4), p('Gb4'), ...cMajor.slice(5)])).toBeUndefined()
  })
})

describe('clean spellings', () => {
  it('rejects a tonic that would need a double accidental', () => {
    // A♭ locrian wants B double flat; G♯ lydian wants F triple sharp, which
    // `transpose` will not spell at all.
    expect(isCleanScale({ letter: 'A', alteration: -1 }, 'locrian')).toBe(false)
    expect(isCleanScale({ letter: 'D', alteration: -1 }, 'locrian')).toBe(false)
    expect(isCleanScale({ letter: 'C', alteration: 0 }, 'locrian')).toBe(true)
  })

  it('leaves every mode with somewhere to stand', () => {
    for (const mode of MODE_IDS) {
      expect(cleanTonics(mode).length, mode).toBeGreaterThanOrEqual(7)
    }
  })

  it('never spells past a double accidental in anything it accepts', () => {
    for (const mode of MODE_IDS) {
      for (const tonic of cleanTonics(mode)) {
        const pitches = scalePitches({ ...tonic, octave: 4 }, mode) as readonly Pitch[]
        for (const pitch of pitches) {
          expect(Math.abs(pitch.alteration), `${tonicKey(tonic)} ${mode}`).toBeLessThan(2)
        }
      }
    }
  })

  it('counts the accidentals a keyless staff has to print', () => {
    // C major prints nothing; F lydian prints nothing either, because its
    // raised fourth is B natural. That second one is the reason this counts
    // altered degrees rather than reading a key signature.
    expect(printedAccidentals({ letter: 'C', alteration: 0 }, 'ionian')).toBe(0)
    expect(printedAccidentals({ letter: 'F', alteration: 0 }, 'lydian')).toBe(0)
    expect(printedAccidentals({ letter: 'F', alteration: 0 }, 'ionian')).toBe(1)
    expect(printedAccidentals({ letter: 'C', alteration: 0 }, 'locrian')).toBe(5)
  })
})

describe('the scales that are not modes', () => {
  it('writes them under a natural minor and every mode under itself', () => {
    // The only thing `keySignatureFor` needed, and it is a fact about the
    // music rather than a fallback: no signature raises a seventh.
    for (const mode of DIATONIC_MODE_IDS) expect(signatureMode(mode), mode).toBe(mode)
    for (const mode of MINOR_SCALE_IDS) expect(signatureMode(mode), mode).toBe('aeolian')
  })

  it('only ever asks melodic minor upwards', () => {
    // Descending it is the natural minor note for note, so a falling one is a
    // question with two right answers. Harmonic minor has no such trouble —
    // its raised seventh is raised whichever way the scale runs.
    expect(ASCENDING_ONLY_MODE_IDS).toEqual(['melodicMinor'])
    expect(isAscendingOnly('harmonicMinor')).toBe(false)
    expect(isAscendingOnly('aeolian')).toBe(false)
  })

  it('keeps it out of anything that writes a melody, and nothing else out', () => {
    // A melody moves both ways, so there is no one spelling for it to draw
    // from. Everything else in the app can ask for every scale there is.
    expect([...MELODY_MODE_IDS].sort()).toEqual(
      MODE_IDS.filter((mode) => mode !== 'melodicMinor').sort(),
    )
    expect(isMelodyModeId('melodicMinor')).toBe(false)
    expect(isMelodyModeId('harmonicMinor')).toBe(true)
    expect(isMelodyModeId('nonsense')).toBe(false)
  })

  it('leaves a mode where it was on the keyboard', () => {
    // The two go on the end so nothing already learnt moves under a thumb.
    expect(MODE_IDS.slice(0, DIATONIC_MODE_IDS.length)).toEqual([...DIATONIC_MODE_IDS])
  })
})

describe('fittingOctaves', () => {
  it('only offers octaves where the whole scale fits', () => {
    const treble = { lowest: p('A3'), highest: p('C6') }

    for (const octave of fittingOctaves(
      { letter: 'C', alteration: 0 },
      'ionian',
      treble.lowest,
      treble.highest,
    )) {
      const pitches = scalePitches(
        { letter: 'C', alteration: 0, octave },
        'ionian',
      ) as readonly Pitch[]

      for (const pitch of pitches) {
        expect(chromaticValue(pitch)).toBeGreaterThanOrEqual(
          chromaticValue(treble.lowest),
        )
        expect(chromaticValue(pitch)).toBeLessThanOrEqual(chromaticValue(treble.highest))
      }
    }
  })

  it('finds nothing when the range is shorter than an octave', () => {
    expect(
      fittingOctaves({ letter: 'C', alteration: 0 }, 'ionian', p('C4'), p('G4')),
    ).toEqual([])
  })
})

describe('tonic keys', () => {
  it('round-trips every offered tonic', () => {
    for (const tonic of TONIC_CHOICES) {
      expect(parseTonicKey(tonicKey(tonic))).toEqual(tonic)
    }
  })

  it('rejects nonsense', () => {
    expect(parseTonicKey('H')).toBeUndefined()
    expect(parseTonicKey('C4')).toBeUndefined()
    expect(parseTonicKey('')).toBeUndefined()
  })
})
