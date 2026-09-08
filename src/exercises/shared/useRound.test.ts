import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { attemptsFor } from '@/lib/db/attempts'
import type { Random } from '@/lib/utils/seededRandom'

import { useRound, type RoundRules } from './useRound'

/**
 * The round machine, on its own.
 *
 * It is generic over what is being asked, so this exercises it with a made-up
 * subject rather than with intervals or scales: what is under test is the
 * phase machine and the attempt log, not any particular music.
 */

interface Spec {
  count: number
  /** Questions this spec can produce, in order. */
  pool: readonly string[]
}

const RULES: RoundRules<Spec, string, string> = {
  generate: (_random: Random, spec) => spec.pool.slice(0, spec.count),
  isCorrect: (chosen, question) => chosen === question,
  subject: (question) => question,
  answerKey: (chosen) => chosen,
  context: (question) => ({ question }),
}

const SPEC: Spec = { count: 3, pool: ['a', 'b', 'c'] }

function round(spec: Spec | undefined, exerciseId = 'test/round') {
  return renderHook(() => useRound(spec, exerciseId, RULES))
}

describe('useRound', () => {
  it('starts on the levels screen, not mid-round', () => {
    // Levels are the landing screen for every exercise.
    expect(round(SPEC).result.current.phase).toEqual({ name: 'levels' })
  })

  it('generates the whole round up front when it starts', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())

    expect(result.current.questions).toEqual(['a', 'b', 'c'])
    expect(result.current.phase).toEqual({ name: 'asking', index: 0 })
  })

  it('takes a spec explicitly, so a level starts in the tap that picks it', () => {
    // Without this the round would be generated from settings state that has
    // not been written back yet, and the first level tap would run the
    // previous level.
    const { result } = round(SPEC)
    act(() => result.current.start({ count: 2, pool: ['x', 'y', 'z'] }))

    expect(result.current.questions).toEqual(['x', 'y'])
  })

  it('stays put rather than starting a round with no questions in it', () => {
    // What an impossible combination of settings produces — every mode on a
    // tonic none of them spell, say.
    const { result } = round({ count: 3, pool: [] })
    act(() => result.current.start())

    expect(result.current.phase).toEqual({ name: 'levels' })
    expect(result.current.questions).toEqual([])
  })

  it('does nothing at all until the settings have loaded', () => {
    const { result } = round(undefined)
    act(() => result.current.start())
    expect(result.current.phase).toEqual({ name: 'levels' })
  })

  it('reveals an answer and keeps it', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())
    act(() => result.current.answer('a', 1200))

    expect(result.current.phase).toEqual({
      name: 'revealed',
      index: 0,
      answer: { question: 'a', chosen: 'a', correct: true, ms: 1200 },
    })
    expect(result.current.answers).toHaveLength(1)
  })

  it('scores a wrong answer as wrong', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())
    act(() => result.current.answer('c', 900))

    expect(result.current.answers[0]?.correct).toBe(false)
  })

  it('ignores an answer that arrives when nothing was asked', () => {
    const { result } = round(SPEC)
    act(() => result.current.answer('a', 10))
    expect(result.current.answers).toEqual([])
  })

  it('advances, and finishes after the last question', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())

    for (const question of ['a', 'b']) {
      act(() => result.current.answer(question, 100))
      act(() => result.current.next())
    }
    expect(result.current.phase).toEqual({ name: 'asking', index: 2 })

    act(() => result.current.answer('c', 100))
    act(() => result.current.next())
    expect(result.current.phase).toEqual({ name: 'summary' })
  })

  it('will not advance from a question that has not been answered', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())
    act(() => result.current.next())

    expect(result.current.phase).toEqual({ name: 'asking', index: 0 })
  })

  it('clears the previous round when a new one starts', () => {
    const { result } = round(SPEC)
    act(() => result.current.start())
    act(() => result.current.answer('a', 100))
    act(() => result.current.start())

    expect(result.current.answers).toEqual([])
    expect(result.current.phase).toEqual({ name: 'asking', index: 0 })
  })

  it('reaches the settings screen and the levels screen', () => {
    const { result } = round(SPEC)
    act(() => result.current.toSetup())
    expect(result.current.phase).toEqual({ name: 'setup' })

    act(() => result.current.toLevels())
    expect(result.current.phase).toEqual({ name: 'levels' })
  })

  it('logs what was asked, and what was answered when it was wrong', async () => {
    // The substrate Progress will read. A silently broken log costs nothing
    // today and everything the day that screen is built.
    const { result } = round(SPEC, 'test/logging')
    act(() => result.current.start())
    act(() => result.current.answer('a', 1500))
    act(() => result.current.next())
    act(() => result.current.answer('a', 800))

    const attempts = await attemptsFor('test/logging')
    expect(attempts).toHaveLength(2)

    expect(attempts[0]).toMatchObject({
      exerciseId: 'test/logging',
      correct: true,
      subject: 'a',
      ms: 1500,
      context: { question: 'a' },
    })
    // Right answers carry no `answered`: it would only ever repeat `subject`.
    expect(attempts[0]?.answered).toBeUndefined()

    expect(attempts[1]).toMatchObject({ correct: false, subject: 'b', answered: 'a' })
  })
})
