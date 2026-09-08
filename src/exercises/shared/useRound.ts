import { useCallback, useState } from 'react'

import { recordAttempt } from '@/lib/db/attempts'
import { createRandom, type Random } from '@/lib/utils/seededRandom'

import type { Answered, Phase } from './round'

/**
 * The levels → setup → round → summary state machine.
 *
 * Identical for every exercise, so it lives here rather than being written
 * out once per game with the chance to drift. An exercise supplies what a
 * round may contain and the handful of rules that only it knows — how to
 * generate its questions, and whether an answer is right — and gets back the
 * phase to render.
 */

export interface RoundRules<TSpec, TQuestion, TAnswer> {
  /**
   * Build a whole round up front, rather than a question at a time: that is
   * what lets a generator spread the subjects evenly and guarantees a round
   * cannot stall halfway through because the next one will not fit.
   */
  generate: (random: Random, spec: TSpec) => readonly TQuestion[]
  isCorrect: (chosen: TAnswer, question: TQuestion) => boolean
  /** What was asked, for the attempt log. */
  subject: (question: TQuestion) => string
  /** What was answered, for the attempt log, when it was wrong. */
  answerKey: (chosen: TAnswer) => string
  /** Anything else worth keeping about the question: clef, key, direction. */
  context: (question: TQuestion) => Record<string, string>
}

export interface RoundController<TSpec, TQuestion, TAnswer> {
  phase: Phase<TQuestion, TAnswer>
  questions: readonly TQuestion[]
  answers: readonly Answered<TQuestion, TAnswer>[]
  /**
   * Generate a fresh round and start asking. Takes the spec explicitly so a
   * level can be started in the same tap that picks it, without waiting for
   * the settings state to round-trip.
   */
  start: (override?: TSpec) => void
  /** Record an answer and reveal it. */
  answer: (chosen: TAnswer, ms: number) => void
  /** Advance, or finish the round if that was the last question. */
  next: () => void
  toSetup: () => void
  toLevels: () => void
}

export function useRound<TSpec, TQuestion, TAnswer>(
  spec: TSpec | undefined,
  exerciseId: string,
  rules: RoundRules<TSpec, TQuestion, TAnswer>,
): RoundController<TSpec, TQuestion, TAnswer> {
  const [phase, setPhase] = useState<Phase<TQuestion, TAnswer>>({ name: 'levels' })
  const [questions, setQuestions] = useState<readonly TQuestion[]>([])
  const [answers, setAnswers] = useState<readonly Answered<TQuestion, TAnswer>[]>([])

  const start = useCallback(
    (override?: TSpec) => {
      const active = override ?? spec
      if (active === undefined) return

      const round = rules.generate(createRandom(Date.now() >>> 0), active)
      setQuestions(round)
      setAnswers([])
      // An empty round means the settings allow nothing; stay put rather than
      // dropping the player into a round with no questions in it.
      setPhase((current) => (round.length === 0 ? current : { name: 'asking', index: 0 }))
    },
    [rules, spec],
  )

  const answer = useCallback(
    (chosen: TAnswer, ms: number) => {
      if (phase.name !== 'asking') return

      const question = questions[phase.index]
      if (question === undefined) return

      const correct = rules.isCorrect(chosen, question)

      recordAttempt({
        exerciseId,
        ts: Date.now(),
        correct,
        subject: rules.subject(question),
        ...(correct ? {} : { answered: rules.answerKey(chosen) }),
        ms,
        context: rules.context(question),
      })

      const recorded: Answered<TQuestion, TAnswer> = { question, chosen, correct, ms }
      setAnswers((current) => [...current, recorded])
      setPhase({ name: 'revealed', index: phase.index, answer: recorded })
    },
    [exerciseId, phase, questions, rules],
  )

  const next = useCallback(() => {
    setPhase((current) => {
      if (current.name !== 'revealed') return current
      const index = current.index + 1
      return index >= questions.length ? { name: 'summary' } : { name: 'asking', index }
    })
  }, [questions.length])

  const toSetup = useCallback(() => setPhase({ name: 'setup' }), [])
  const toLevels = useCallback(() => setPhase({ name: 'levels' }), [])

  return { phase, questions, answers, start, answer, next, toSetup, toLevels }
}
