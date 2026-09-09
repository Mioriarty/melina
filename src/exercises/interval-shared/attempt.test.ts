import { describe, expect, it } from 'vitest'

import { HEARING_DIFFICULTIES } from '@/exercises/interval-hearing/difficulties'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import { READING_DIRECTIONS } from '@/exercises/interval-reading/settings'
import { matchesFilter } from '@/lib/db/progress'
import type { AttemptRow } from '@/lib/db/schema'
import { createRandom } from '@/lib/utils/seededRandom'

import { intervalAttempt, intervalFilter, intervalQuestion } from './attempt'
import { generateRound, type RoundSpec } from './generate'

/**
 * What an interval question becomes in the log, and what comes back out.
 *
 * Two properties, and they are the whole reason the log is shaped the way it
 * is. A row must rebuild the question exactly — otherwise it is a summary,
 * not a record — and a question a level asked must be one that level's own
 * filter admits, or its accuracy is measured over the wrong answers.
 */

const SPECS: readonly { id: string; spec: RoundSpec }[] = [
  ...READING_DIFFICULTIES.map((level) => ({
    id: `reading/${level.id}`,
    spec: { ...level.settings, directions: READING_DIRECTIONS } as RoundSpec,
  })),
  ...HEARING_DIFFICULTIES.map((level) => ({
    id: `hearing/${level.id}`,
    spec: level.settings as RoundSpec,
  })),
]

function rowFor(question: ReturnType<typeof generateRound>[number]): AttemptRow {
  return {
    exerciseId: 'intervals/reading',
    ts: 1,
    correct: true,
    question: intervalAttempt(question),
    answered: 'P5',
    ms: 100,
  }
}

describe.each(SPECS)('$id', ({ spec }) => {
  // Several seeds, because one round of ten cannot cover a level offering a
  // dozen intervals across four clefs.
  const questions = [1, 2, 3, 4, 5].flatMap((seed) =>
    generateRound(createRandom(seed), spec),
  )

  it('generates questions at all', () => {
    expect(questions.length).toBeGreaterThan(0)
  })

  it('rebuilds every question exactly from its row', () => {
    for (const question of questions) {
      expect(intervalQuestion(intervalAttempt(question))).toEqual(question)
    }
  })

  it('admits every question it asked', () => {
    // The guard against a level whose accuracy is measured over an empty set
    // because one of its own dimensions was recorded under another name.
    const filter = intervalFilter(spec, 'intervals/reading')
    for (const question of questions) {
      expect(matchesFilter(rowFor(question), filter)).toBe(true)
    }
  })
})

describe('intervalFilter', () => {
  it('leaves out what a level does not constrain', () => {
    // `questionsPerRound` says how many questions a round holds, not which
    // ones, so it must not narrow anything.
    const spec = SPECS[0]?.spec as RoundSpec
    expect(intervalFilter(spec)).not.toHaveProperty('questionsPerRound')
  })

  it('narrows to the staff only when the level asked for it', () => {
    const spec = SPECS[0]?.spec as RoundSpec
    expect(intervalFilter({ ...spec, staffOnly: true }).staffOnly).toBe(true)
    // Not `false`: a level that does not ask for the staff is happy with
    // either, and pinning it would exclude half of its own history.
    expect(intervalFilter({ ...spec, staffOnly: false }).staffOnly).toBeUndefined()
  })
})
