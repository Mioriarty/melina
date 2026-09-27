import { describe, expect, it } from 'vitest'

import { correctAnswer } from '@/lib/db/attemptQuestion'
import {
  degreeKey,
  degreePitch,
  degreesKey,
  stepIndex,
  type Degree,
} from '@/lib/music/degree'
import { KEY_KEYS } from '@/lib/music/key'
import { comparePitch, pitchKey } from '@/lib/music/pitch'
import { createRandom } from '@/lib/utils/seededRandom'

import { HARMONY_DICTATION_DIFFICULTIES } from './difficulties'
import { sopranoSteps } from '@/lib/music/soprano'

import { generateRound, harmonySpec, type HarmonyQuestion } from './generate'
import { BASS_LINE, SOPRANO_LINE } from './lines'
import { BASS_RULES, isLineCorrect, SOPRANO_RULES } from './rules'

/**
 * The voices a line dictation asks for.
 *
 * The soprano is the one that needed new model: it is answered **with its
 * octave**, so the keyboard has to reach every note the soprano can sing and
 * the answer has to name the exact note that sounded. Both are checked the
 * way this codebase checks a generator — by reading the answer back into the
 * pitches it claims to describe.
 */

function questions(): HarmonyQuestion[] {
  // Every key, so the keyboard is exercised in all of them; the first and last
  // level, so both plain progressions and every technique are covered.
  const levels = [
    HARMONY_DICTATION_DIFFICULTIES[0],
    HARMONY_DICTATION_DIFFICULTIES[HARMONY_DICTATION_DIFFICULTIES.length - 1],
  ]
  return levels.flatMap((level) =>
    [1, 2].flatMap((seed) =>
      generateRound(
        createRandom(seed),
        harmonySpec({
          ...(level?.settings as NonNullable<typeof level>['settings']),
          keys: KEY_KEYS,
          questionsPerRound: KEY_KEYS.length,
        }),
      ),
    ),
  )
}

const ASKED = questions()

describe('the soprano line', () => {
  it('generates questions to check', () => {
    expect(ASKED.length).toBeGreaterThan(20)
  })

  it('names every note the soprano sang, in the octave it sang it', () => {
    for (const question of ASKED) {
      const { key } = question.progression
      const degrees = SOPRANO_LINE.answer(question)
      expect(degrees, `${key.tonic.letter} ${key.mode}`).toBeDefined()
      if (degrees === undefined) continue

      expect(degrees).toHaveLength(question.satz.voicings.length)
      degrees.forEach((degree, index) => {
        const sung = question.satz.voicings[index]?.soprano
        const named = degreePitch(SOPRANO_LINE.tonic(key), key.mode, degree)
        expect(named && pitchKey(named), degreeKey(degree)).toBe(sung && pitchKey(sung))
      })
    }
  })

  it('has a key for every note it can be asked', () => {
    // Otherwise a question could ask for a note the keyboard cannot write.
    for (const question of ASKED) {
      const { key } = question.progression
      const offered = new Set(sopranoSteps(key).map(stepIndex))
      for (const degree of SOPRANO_LINE.answer(question) ?? []) {
        expect(offered.has(stepIndex(degree)), degreeKey(degree)).toBe(true)
      }
    }
  })

  it('offers the compass and no more, in every key', () => {
    // The whole compass rather than the question's own range, which would
    // give the highest and lowest notes away.
    for (const question of ASKED) {
      const { key } = question.progression
      const steps = sopranoSteps(key)
      expect(steps.length).toBeGreaterThanOrEqual(11)
      expect(steps.length).toBeLessThanOrEqual(12)
      const pitches = steps.map((step) =>
        degreePitch(SOPRANO_LINE.tonic(key), key.mode, step),
      )
      expect(pitches.every((pitch) => pitch !== undefined)).toBe(true)
      // Low to high, one key per step.
      for (let i = 1; i < pitches.length; i += 1) {
        expect(
          comparePitch(pitches[i] as never, pitches[i - 1] as never),
        ).toBeGreaterThan(0)
      }
    }
  })
})

describe('grading a line', () => {
  const question = ASKED[0] as HarmonyQuestion
  const move = (degrees: readonly Degree[], by: number): Degree[] =>
    degrees.map((degree) => ({ ...degree, octave: (degree.octave ?? 0) + by }))

  it('marks the line that was sung right', () => {
    expect(
      isLineCorrect(SOPRANO_LINE, SOPRANO_LINE.answer(question) ?? [], question),
    ).toBe(true)
    expect(isLineCorrect(BASS_LINE, BASS_LINE.answer(question) ?? [], question)).toBe(
      true,
    )
  })

  it('holds the soprano to its octave', () => {
    const sung = SOPRANO_LINE.answer(question) ?? []
    expect(isLineCorrect(SOPRANO_LINE, move(sung, 1), question)).toBe(false)
  })

  it('writes one soprano note per sonority, and one bass note per bass note', () => {
    for (const asked of ASKED) {
      expect(SOPRANO_LINE.length(asked)).toBe(asked.satz.events.length)
      expect(BASS_LINE.length(asked)).toBe(
        asked.satz.events.filter((event) => event.held !== true).length,
      )
    }
  })
})

describe('the attempt log', () => {
  it('derives the soprano a row asked for, and the bass', () => {
    for (const question of ASKED.slice(0, 8)) {
      const soprano = SOPRANO_RULES.attempt(question)
      expect(soprano.kind === 'harmony' && soprano.asks).toBe('soprano')
      expect(correctAnswer(soprano)).toBe(degreesKey(SOPRANO_LINE.answer(question) ?? []))

      const bass = BASS_RULES.attempt(question)
      expect(bass.kind === 'harmony' && bass.asks).toBeUndefined()
      expect(correctAnswer(bass)).toBe(degreesKey(BASS_LINE.answer(question) ?? []))
    }
  })
})
