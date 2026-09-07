import { useCallback, useState } from 'react'

import { recordAttempt } from '@/lib/db/attempts'
import { intervalKey, intervalsEqual, type Interval } from '@/lib/music/interval'
import { createRandom } from '@/lib/utils/seededRandom'

import { generateRound, type IntervalQuestion, type RoundSpec } from './generate'
import type { Answered, Phase } from './round'

/**
 * The setup → round → summary state machine.
 *
 * Identical for every interval exercise, so it lives here rather than being
 * written out twice with the chance to drift. The exercise supplies what a
 * round may contain and gets back the phase to render.
 */
export interface RoundController {
  phase: Phase
  questions: readonly IntervalQuestion[]
  answers: readonly Answered[]
  /** Generate a fresh round and start asking. */
  start: () => void
  /** Record an answer and reveal it. */
  answer: (chosen: Interval, ms: number) => void
  /** Advance, or finish the round if that was the last question. */
  next: () => void
  toSetup: () => void
}

export function useIntervalRound(
  spec: RoundSpec | undefined,
  exerciseId: string,
): RoundController {
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [questions, setQuestions] = useState<readonly IntervalQuestion[]>([])
  const [answers, setAnswers] = useState<readonly Answered[]>([])

  const start = useCallback(() => {
    if (spec === undefined) return

    const round = generateRound(createRandom(Date.now() >>> 0), spec)
    setQuestions(round)
    setAnswers([])
    // An empty round means the settings allow nothing; stay put rather than
    // dropping the player into a round with no questions in it.
    setPhase(round.length === 0 ? { name: 'setup' } : { name: 'asking', index: 0 })
  }, [spec])

  const answer = useCallback(
    (chosen: Interval, ms: number) => {
      if (phase.name !== 'asking') return

      const question = questions[phase.index]
      if (question === undefined) return

      const correct = intervalsEqual(chosen, question.interval)

      recordAttempt({
        exerciseId,
        ts: Date.now(),
        correct,
        subject: intervalKey(question.interval),
        ...(correct ? {} : { answered: intervalKey(chosen) }),
        ms,
        context: {
          clef: question.clef,
          keySignature: question.keySignature,
          direction: question.direction,
        },
      })

      const recorded: Answered = { question, chosen, correct, ms }
      setAnswers((current) => [...current, recorded])
      setPhase({ name: 'revealed', index: phase.index, answer: recorded })
    },
    [exerciseId, phase, questions],
  )

  const next = useCallback(() => {
    setPhase((current) => {
      if (current.name !== 'revealed') return current
      const index = current.index + 1
      return index >= questions.length ? { name: 'summary' } : { name: 'asking', index }
    })
  }, [questions.length])

  const toSetup = useCallback(() => setPhase({ name: 'setup' }), [])

  return { phase, questions, answers, start, answer, next, toSetup }
}
