import { describe, expect, it } from 'vitest'

import { SCALE_HEARING_DIFFICULTIES } from '@/exercises/scale-hearing/difficulties'
import { SCALE_READING_DIFFICULTIES } from '@/exercises/scale-reading/difficulties'
import { READING_DIRECTIONS } from '@/exercises/scale-reading/settings'
import { matchesFilter } from '@/lib/db/progress'
import type { AttemptRow } from '@/lib/db/schema'
import { createRandom } from '@/lib/utils/seededRandom'

import { scaleAttempt, scaleFilter, scaleQuestion } from './attempt'
import { generateRound, type ScaleQuestion, type ScaleRoundSpec } from './generate'

/**
 * What a scale question becomes in the log, and what comes back out.
 *
 * The row keeps a tonic and a mode. Everything a player sees — eight spelled
 * pitches, the accidentals in front of them — is spelled again from those
 * two, so the test that matters is that the eight come back identical.
 */

const SPECS: readonly { id: string; spec: ScaleRoundSpec }[] = [
  ...SCALE_READING_DIFFICULTIES.map((level) => ({
    id: `reading/${level.id}`,
    spec: { ...level.settings, directions: READING_DIRECTIONS } as ScaleRoundSpec,
  })),
  ...SCALE_HEARING_DIFFICULTIES.map((level) => ({
    id: `hearing/${level.id}`,
    spec: level.settings as ScaleRoundSpec,
  })),
]

function rowFor(question: ScaleQuestion): AttemptRow {
  return {
    exerciseId: 'scales/reading',
    ts: 1,
    correct: true,
    question: scaleAttempt(question),
    answered: question.mode,
    ms: 100,
  }
}

describe.each(SPECS)('$id', ({ spec }) => {
  const questions = [1, 2, 3, 4, 5].flatMap((seed) =>
    generateRound(createRandom(seed), spec),
  )

  it('generates questions at all', () => {
    expect(questions.length).toBeGreaterThan(0)
  })

  it('rebuilds every scale, note for note, from a tonic and a mode', () => {
    for (const question of questions) {
      expect(scaleQuestion(scaleAttempt(question))).toEqual(question)
    }
  })

  it('admits every question it asked', () => {
    const filter = scaleFilter(spec, 'scales/reading')
    for (const question of questions) {
      expect(matchesFilter(rowFor(question), filter)).toBe(true)
    }
  })
})

describe('scaleFilter', () => {
  it('asks about the root, not the tonic, so the clef may place it', () => {
    // A level offers B♭; which octave the scale lands in is the clef's
    // decision. Pinning the octave would exclude the level's own history.
    const spec = SPECS[0]?.spec as ScaleRoundSpec
    const filter = scaleFilter(spec)

    expect(filter.root).toEqual(spec.tonics)
    expect(filter.tonic).toBeUndefined()
  })
})
