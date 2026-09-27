import { describe, expect, it } from 'vitest'

import { generateRound, harmonySpec } from '@/exercises/harmony-shared/generate'
import { correctAnswer } from '@/lib/db/attemptQuestion'
import { numeralsKey, type Numeral } from '@/lib/music/numeral'
import { createRandom } from '@/lib/utils/seededRandom'

import { STUFEN_DIFFICULTIES } from './difficulties'
import { isStufenCorrect, STUFEN_RULES, stufenAnswer, stufenVerdicts } from './rules'

/**
 * Naming the chords of a progression.
 *
 * The model underneath — that every generated chord has a name, and that a
 * name is graded by the chord it spells — is `numeral.test.ts`'s business.
 * What is checked here is the exercise's use of it: every level's questions
 * have an answer, the answer is marked right, anything else is not, and the
 * attempt log can say what was asked.
 */

const ROUNDS = STUFEN_DIFFICULTIES.map((level) => ({
  level,
  questions: generateRound(createRandom(11), harmonySpec(level.settings)),
}))

describe('every level', () => {
  it.each(ROUNDS)(
    '$level.id has an answer to every question, and it is right',
    ({ questions }) => {
      expect(questions.length).toBeGreaterThan(0)
      for (const question of questions) {
        const answer = stufenAnswer(question)
        expect(answer).toBeDefined()
        expect(isStufenCorrect(answer ?? [], question)).toBe(true)
      }
    },
  )

  it('asks for inversions exactly where the level says so', () => {
    for (const { level, questions } of ROUNDS) {
      for (const question of questions) {
        expect(question.inversions === true, level.id).toBe(level.settings.inversions)
      }
    }
  })
})

describe('grading', () => {
  const question = ROUNDS[0]?.questions[0]

  it('marks a wrong chord wrong, and says which', () => {
    expect(question).toBeDefined()
    if (question === undefined) return
    const answer = [...(stufenAnswer(question) ?? [])]
    // The subdominant where the tonic opened — never the same chord.
    const wrong: Numeral[] = [{ degree: 4, inversion: 0 }, ...answer.slice(1)]
    expect(isStufenCorrect(wrong, question)).toBe(false)
    expect(stufenVerdicts(question, wrong)[0]).toBe(false)
    expect(stufenVerdicts(question, wrong).slice(1).every(Boolean)).toBe(true)
  })

  it('does not accept a short answer', () => {
    if (question === undefined) return
    const answer = stufenAnswer(question) ?? []
    expect(isStufenCorrect(answer.slice(0, -1), question)).toBe(false)
  })
})

describe('the attempt log', () => {
  it('says the row asked for Stufen, and derives the answer it asked for', () => {
    // A row keeps the progression only; the Stufen are read back from it.
    for (const { questions } of ROUNDS) {
      for (const question of questions) {
        const row = STUFEN_RULES.attempt(question)
        expect(row.kind === 'harmony' && row.asks).toBe('stufen')
        expect(correctAnswer(row)).toBe(numeralsKey(stufenAnswer(question) ?? []))
      }
    }
  })
})
