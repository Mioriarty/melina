import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RoundScreen } from './RoundScreen'
import { CORRECT_DELAY_MS, type ActivePhase, type Answered } from './round'

/**
 * The screen a question is asked on, shared by all four exercises.
 *
 * Its one piece of real behaviour is the reveal: a correct answer advances on
 * its own, and a wrong one waits to be dismissed, because the whole value of
 * getting it wrong is in looking at the answer. A mistake either way strands
 * the player mid-round.
 */

vi.mock('@/components/notation/Score', () => ({
  Score: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}))

type Question = string
type Answer = string

function answered(correct: boolean): Answered<Question, Answer> {
  return { question: 'q', chosen: correct ? 'right' : 'wrong', correct, ms: 400 }
}

function screenAt(
  phase: ActivePhase<Question, Answer>,
  handlers: {
    onAnswer?: (chosen: Answer, ms: number) => void
    onNext?: () => void
    onQuit?: () => void
    onPlay?: () => void
    playStatus?: 'idle' | 'loading' | 'ready' | 'failed'
  } = {},
) {
  const onAnswer = handlers.onAnswer ?? vi.fn()
  const onNext = handlers.onNext ?? vi.fn()
  const onQuit = handlers.onQuit ?? vi.fn()

  render(
    <RoundScreen
      phase={phase}
      total={10}
      prompt="What is this?"
      mei="<mei/>"
      scoreLabel="two notes"
      correct="right"
      reducedMotion={false}
      {...(handlers.onPlay === undefined ? {} : { onPlay: handlers.onPlay })}
      {...(handlers.playStatus === undefined ? {} : { playStatus: handlers.playStatus })}
      keyboard={(binding) => (
        <div>
          <button type="button" onClick={() => binding.onAnswer('right')}>
            right
          </button>
          <span data-testid="state">{binding.state}</span>
          <span data-testid="revealed">{binding.correct ?? '—'}</span>
          <span data-testid="chosen">{binding.chosen ?? '—'}</span>
        </div>
      )}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
    />,
  )

  return { onAnswer, onNext, onQuit }
}

describe('RoundScreen', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('shows where in the round the player is', () => {
    screenAt({ name: 'asking', index: 3 })

    expect(screen.getByText('4/10')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4')
  })

  it('describes the notation without giving the answer away', () => {
    screenAt({ name: 'asking', index: 0 })
    expect(screen.getByRole('img', { name: 'two notes' })).toBeTruthy()
  })

  it('hands the keyboard nothing to reveal until the answer is in', () => {
    screenAt({ name: 'asking', index: 0 })

    expect(screen.getByTestId('state').textContent).toBe('answering')
    expect(screen.getByTestId('revealed').textContent).toBe('—')
  })

  it('reveals the right answer and what was picked, once answered', () => {
    screenAt({ name: 'revealed', index: 0, answer: answered(false) })

    expect(screen.getByTestId('state').textContent).toBe('revealed')
    expect(screen.getByTestId('revealed').textContent).toBe('right')
    expect(screen.getByTestId('chosen').textContent).toBe('wrong')
  })

  it('times the answer', () => {
    const onAnswer = vi.fn()
    screenAt({ name: 'asking', index: 0 }, { onAnswer })

    vi.advanceTimersByTime(2500)
    fireEvent.click(screen.getByRole('button', { name: 'right' }))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    const [chosen, ms] = onAnswer.mock.calls[0] as [string, number]
    expect(chosen).toBe('right')
    expect(ms).toBeGreaterThanOrEqual(2500)
  })

  it('moves on by itself after a correct answer', () => {
    const onNext = vi.fn()
    screenAt({ name: 'revealed', index: 0, answer: answered(true) }, { onNext })

    expect(onNext).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(CORRECT_DELAY_MS))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('waits after a wrong one, however long it takes', () => {
    // The mistake is the point: nothing advances until it has been looked at.
    const onNext = vi.fn()
    screenAt({ name: 'revealed', index: 0, answer: answered(false) }, { onNext })

    act(() => vi.advanceTimersByTime(CORRECT_DELAY_MS * 10))
    expect(onNext).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /next question/i }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('marks a correct answer with a glyph, never with colour alone', () => {
    screenAt({ name: 'revealed', index: 0, answer: answered(true) })

    const feedback = screen.getByText('Correct')
    expect(feedback.querySelector('svg')).toBeTruthy()
  })

  it('makes the notation the play control, when there is anything to play', () => {
    const onPlay = vi.fn()
    screenAt({ name: 'revealed', index: 0, answer: answered(true) }, { onPlay })

    const notation = screen.getByRole('button', { name: /press to hear it/i })
    fireEvent.click(notation)
    expect(onPlay).toHaveBeenCalledTimes(1)
    // And says so, rather than leaving the affordance to be discovered — as a
    // mark on the staff rather than a caption under it, which spent a line of
    // a short screen on something you learn once.
    expect(screen.getByTitle('Tap the notes to hear them')).toBeTruthy()
  })

  it('leaves the notation alone when it must not be heard', () => {
    // A reading question before its answer: sounding it would answer it.
    screenAt({ name: 'asking', index: 0 })

    expect(screen.queryByRole('button', { name: /press to hear it/i })).toBeNull()
    expect(screen.getByRole('img', { name: 'two notes' })).toBeTruthy()
  })

  it('says why nothing is playing, in the place the hint would be', () => {
    const onPlay = vi.fn()
    screenAt({ name: 'asking', index: 0 }, { onPlay, playStatus: 'loading' })
    expect(screen.getByTitle('Loading the instrument')).toBeTruthy()
    // The hint it replaces is gone while it says so, rather than both at once.
    expect(screen.queryByTitle('Tap the notes to hear them')).toBeNull()

    screen.getByRole('button', { name: /press to hear it/i })
  })

  it('cannot be pressed when playback has failed', () => {
    const onPlay = vi.fn()
    screenAt({ name: 'asking', index: 0 }, { onPlay, playStatus: 'failed' })

    fireEvent.click(screen.getByRole('button', { name: /press to hear it/i }))
    expect(onPlay).not.toHaveBeenCalled()
    expect(screen.getByTitle('Playback unavailable')).toBeTruthy()
  })

  it('leaves the round by the button in the progress bar', () => {
    // Exercises run without the app header, so this is the way out.
    const onQuit = vi.fn()
    screenAt({ name: 'asking', index: 0 }, { onQuit })

    fireEvent.click(screen.getByRole('button', { name: 'End this round' }))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})
