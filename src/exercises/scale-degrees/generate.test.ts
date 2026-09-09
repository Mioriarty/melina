import { describe, expect, it } from 'vitest'

import {
  DEGREE_NUMBERS,
  degreeKey,
  degreePitch,
  keySignatureFor,
} from '@/lib/music/degree'
import { comparePitch, pitchKey } from '@/lib/music/pitch'
import { MODE_IDS, TONIC_KEYS, scalePitches, tonicKey } from '@/lib/music/scale'
import { createRandom } from '@/lib/utils/seededRandom'

import { generateRound, type DegreeRoundSpec } from './generate'
import { DEFAULT_SETTINGS } from './settings'

const SEEDS = [1, 2, 3, 7, 11, 101]

function spec(overrides: Partial<DegreeRoundSpec> = {}): DegreeRoundSpec {
  return { ...DEFAULT_SETTINGS, questionsPerRound: 20, ...overrides }
}

function everyQuestion(value: DegreeRoundSpec) {
  return SEEDS.flatMap((seed) => generateRound(createRandom(seed), value))
}

describe('generateRound', () => {
  it('fills the round it was asked for', () => {
    for (const seed of SEEDS) {
      expect(generateRound(createRandom(seed), spec()).length).toBe(20)
    }
  })

  it('generates nothing rather than something wrong when nothing is allowed', () => {
    expect(generateRound(createRandom(1), spec({ modes: [] }))).toEqual([])
    expect(generateRound(createRandom(1), spec({ tonics: [] }))).toEqual([])
    expect(generateRound(createRandom(1), spec({ clefs: [] }))).toEqual([])
    expect(generateRound(createRandom(1), spec({ degrees: [] }))).toEqual([])
  })

  it('deals the modes evenly rather than leaving one out', () => {
    const modes = ['ionian', 'aeolian', 'dorian'] as const
    const asked = new Set(
      generateRound(createRandom(5), spec({ modes: [...modes] })).map((q) => q.mode),
    )
    expect([...asked].sort()).toEqual([...modes].sort())
  })

  it('gives the melody the length the level asked for', () => {
    for (const melodyLength of [2, 3, 5, 6] as const) {
      for (const question of everyQuestion(spec({ melodyLength }))) {
        expect(question.degrees.length).toBe(melodyLength)
        expect(question.pitches.length).toBe(melodyLength)
      }
    }
  })
})

describe('every question it builds', () => {
  const WIDE = spec({
    modes: [...MODE_IDS],
    tonics: [...TONIC_KEYS],
    clefs: ['treble', 'bass', 'alto', 'tenor'],
    degrees: [...DEGREE_NUMBERS],
    alterations: true,
    startOnTonic: false,
    melodyLength: 5,
    questionsPerRound: 30,
  })

  const questions = everyQuestion(WIDE)

  it('has questions to check', () => {
    expect(questions.length).toBeGreaterThan(100)
  })

  it('names a key signature that spells its own scale', () => {
    for (const question of questions) {
      expect(
        keySignatureFor(question.tonic, question.mode),
        pitchKey(question.tonic),
      ).toBe(question.keySignature)
    }
  })

  it('spells every degree it asks', () => {
    for (const question of questions) {
      question.degrees.forEach((degree, index) => {
        const pitch = degreePitch(question.tonic, question.mode, degree)
        expect(pitch, `${degreeKey(degree)}`).toBeDefined()
        expect(pitchKey(pitch as never)).toBe(pitchKey(question.pitches[index] as never))
      })
    }
  })

  it('keeps the melody inside the octave above the tonic', () => {
    // The decision that makes a degree and a pitch the same thing, so an answer
    // is never ambiguous and the staff always draws the note that was meant.
    for (const question of questions) {
      const scale = scalePitches(question.tonic, question.mode)
      const octave = scale?.[7]
      expect(octave).toBeDefined()

      for (const pitch of question.pitches) {
        // An altered degree may sit a semitone outside, which is still one
        // notehead's worth and not another octave.
        expect(
          comparePitch(pitch, question.tonic),
          pitchKey(pitch),
        ).toBeGreaterThanOrEqual(-1)
        expect(comparePitch(pitch, octave as never), pitchKey(pitch)).toBeLessThanOrEqual(
          1,
        )
      }
    }
  })

  it('never repeats a note straight away', () => {
    // A note repeated is a note not asked about.
    for (const question of questions) {
      question.degrees.forEach((degree, index) => {
        if (index === 0) return
        expect(degreeKey(degree)).not.toBe(
          degreeKey(question.degrees[index - 1] as never),
        )
      })
    }
  })
})

describe('what a level bounds', () => {
  it('asks only the degrees it offers', () => {
    for (const degrees of [
      [1, 3, 5],
      [1, 2, 3, 4, 5],
    ]) {
      for (const question of everyQuestion(spec({ degrees }))) {
        for (const degree of question.degrees) {
          expect(degrees, degreeKey(degree)).toContain(degree.number)
        }
      }
    }
  })

  it('leaves the key alone unless the level allows otherwise', () => {
    for (const question of everyQuestion(spec({ alterations: false }))) {
      for (const degree of question.degrees) {
        expect(degree.alteration, degreeKey(degree)).toBe(0)
      }
    }

    const chromatic = everyQuestion(spec({ alterations: true, melodyLength: 6 }))
    expect(
      chromatic.some((q) => q.degrees.some((degree) => degree.alteration !== 0)),
    ).toBe(true)
  })

  it('opens on the tonic only when told to', () => {
    for (const question of everyQuestion(spec({ startOnTonic: true }))) {
      expect(question.degrees[0]).toEqual({ number: 1, alteration: 0 })
    }

    const free = everyQuestion(spec({ startOnTonic: false, degrees: [1, 2, 3, 4, 5] }))
    expect(free.some((q) => q.degrees[0]?.number !== 1)).toBe(true)
  })

  it('asks only the modes, tonics and clefs it allows', () => {
    const narrow = spec({
      modes: ['dorian'],
      tonics: ['D', 'G'],
      clefs: ['bass'],
    })
    for (const question of everyQuestion(narrow)) {
      expect(question.mode).toBe('dorian')
      expect(narrow.tonics).toContain(tonicKey(question.tonic))
      expect(question.clef).toBe('bass')
    }
  })
})

describe('determinism', () => {
  it('gives the same round for the same seed', () => {
    expect(JSON.stringify(generateRound(createRandom(99), spec()))).toBe(
      JSON.stringify(generateRound(createRandom(99), spec())),
    )
  })
})
