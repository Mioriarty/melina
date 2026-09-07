import { useCallback, useEffect, useRef, type ReactNode } from 'react'

import { IntervalKeyboard } from '@/components/input/IntervalKeyboard'
import { KeyboardShell } from '@/components/input/KeyboardShell'
import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import type { Interval } from '@/lib/music/interval'
import { cn } from '@/lib/utils/cn'

import type { IntervalQuestion } from './generate'
import { CORRECT_DELAY_MS, type Answered, type Phase } from './round'

/**
 * A question, mid-round.
 *
 * Shared by reading and hearing, which differ only in what notation they show
 * and whether there is a play button beside it — everything else, from the
 * progress bar to the reveal behaviour, is the same exercise.
 */
export interface IntervalRoundScreenProps {
  phase: Extract<Phase, { name: 'asking' | 'revealed' }>
  questions: readonly IntervalQuestion[]
  options: readonly Interval[]
  /** The engraved notation for this question, in its current state. */
  mei: string
  /** What that notation shows, for screen readers. Never the answer. */
  scoreLabel: string
  /** Optional control beside the staff — the hearing exercise's replay button. */
  aside?: ReactNode
  reducedMotion: boolean
  onAnswer: (chosen: Interval, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export function IntervalRoundScreen({
  phase,
  questions,
  options,
  mei,
  scoreLabel,
  aside,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: IntervalRoundScreenProps) {
  // Set on mount rather than during render: `useRef(Date.now())` evaluates
  // the clock on every render even though only the first value is kept, and
  // starting the timer after paint measures thinking time more honestly.
  // This screen is keyed by question index, so it remounts per question.
  const askedAt = useRef(0)
  useEffect(() => {
    askedAt.current = Date.now()
  }, [])

  const revealed = phase.name === 'revealed'
  const answer = phase.name === 'revealed' ? phase.answer : undefined
  const question = questions[phase.index]

  // A correct answer advances on its own; a wrong one waits to be dismissed,
  // because the whole value of getting it wrong is in looking at the answer.
  useEffect(() => {
    if (answer === undefined || !answer.correct) return
    const timer = setTimeout(onNext, reducedMotion ? 0 : CORRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [answer, onNext, reducedMotion])

  const handleAnswer = useCallback(
    (chosen: Interval) => onAnswer(chosen, Date.now() - askedAt.current),
    [onAnswer],
  )

  if (question === undefined) return null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pt-3 sm:px-6">
        <Progress index={phase.index} total={questions.length} onQuit={onQuit} />

        {/*
          The staff takes whatever space is left rather than a fixed height.
          Sizing it independently and centring the column meant that on a
          short screen the content overflowed both ends, and the bottom of it
          — the feedback and the Next button — was painted over by the
          keyboard below.
        */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden pt-8 pb-2">
          <h1 className="shrink-0 text-center text-heading">What interval is this?</h1>

          <div className="flex min-h-0 w-full max-w-full flex-1 items-center justify-center gap-3">
            <Score
              className="max-h-[34dvh] min-h-0 flex-1"
              mei={mei}
              label={scoreLabel}
            />
            {aside !== undefined && <div className="shrink-0">{aside}</div>}
          </div>

          <div className="flex min-h-11 shrink-0 items-center">
            {revealed && answer !== undefined && (
              <Feedback answer={answer} onNext={onNext} />
            )}
          </div>
        </div>
      </div>

      <KeyboardShell>
        <IntervalKeyboard
          options={options}
          onAnswer={handleAnswer}
          state={revealed ? 'revealed' : 'answering'}
          chosen={answer?.chosen}
          correct={revealed ? question.interval : undefined}
        />
      </KeyboardShell>
    </div>
  )
}

function Progress({
  index,
  total,
  onQuit,
}: {
  index: number
  total: number
  onQuit: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onQuit}
        className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
      >
        <Icon name="arrowBack" size={20} label="End this round" />
      </button>

      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Question ${index + 1} of ${total}`}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-[--ease-out-soft]"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <span className="tabular shrink-0 text-sm text-ink-faint">
        {index + 1}/{total}
      </span>
    </div>
  )
}

function Feedback({ answer, onNext }: { answer: Answered; onNext: () => void }) {
  if (answer.correct) {
    return (
      <p className="flex items-center gap-1.5 font-medium text-correct">
        <Icon name="correct" size={20} />
        Correct
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={onNext}
      autoFocus
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper',
        'transition-colors hover:opacity-90',
      )}
    >
      <Icon name="arrowForward" size={18} />
      Next question
    </button>
  )
}
