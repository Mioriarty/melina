import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { KeyboardShell } from '@/components/input/KeyboardShell'
import type { KeyboardState } from '@/components/input/keyClasses'
import { Score } from '@/components/notation/Score'
import { DEFAULT_NOTE_SPACING } from '@/lib/notation/verovio'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import { CORRECT_DELAY_MS, type ActivePhase, type Answered } from './round'

/**
 * A question, mid-round.
 *
 * Every exercise so far asks the same way: some notation, a prompt, and a
 * keyboard of the answers that are allowed. What differs is the notation, the
 * keyboard and — for hearing — a play button beside the staff, so those are
 * the props. The progress bar, the reveal behaviour and the timing are the
 * same game in all of them.
 */

/** What a keyboard needs in order to be the answer surface for a round. */
export interface KeyboardBinding<TAnswer> {
  state: KeyboardState
  /** What the player picked, once they have picked. */
  chosen: TAnswer | undefined
  /** The right answer, present only once the question has been revealed. */
  correct: TAnswer | undefined
  onAnswer: (chosen: TAnswer) => void
}

export interface RoundScreenProps<TQuestion, TAnswer> {
  phase: ActivePhase<TQuestion, TAnswer>
  /** Questions in the round, for the progress bar. */
  total: number
  /** The question above the staff: "What interval is this?" */
  prompt: string
  /** The engraved notation for this question, in its current state. */
  mei: string
  /** What that notation shows, for screen readers. Never the answer. */
  scoreLabel: string
  /** How much room each note gets — see `SCALE_NOTE_SPACING`. */
  noteSpacing?: number
  /** This question's answer, revealed on the keyboard once it is given. */
  correct: TAnswer
  /** Optional control beside the staff — the hearing exercises' replay button. */
  aside?: ReactNode
  keyboard: (binding: KeyboardBinding<TAnswer>) => ReactNode
  reducedMotion: boolean
  onAnswer: (chosen: TAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export function RoundScreen<TQuestion, TAnswer>({
  phase,
  total,
  prompt,
  mei,
  scoreLabel,
  noteSpacing = DEFAULT_NOTE_SPACING,
  correct,
  aside,
  keyboard,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: RoundScreenProps<TQuestion, TAnswer>) {
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

  // A correct answer advances on its own; a wrong one waits to be dismissed,
  // because the whole value of getting it wrong is in looking at the answer.
  useEffect(() => {
    if (answer === undefined || !answer.correct) return
    const timer = setTimeout(onNext, reducedMotion ? 0 : CORRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [answer, onNext, reducedMotion])

  const handleAnswer = useCallback(
    (chosen: TAnswer) => onAnswer(chosen, Date.now() - askedAt.current),
    [onAnswer],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pt-3 sm:px-6">
        <Progress index={phase.index} total={total} onQuit={onQuit} />

        {/*
          The staff takes whatever space is left rather than a fixed height.
          Sizing it independently and centring the column meant that on a
          short screen the content overflowed both ends, and the bottom of it
          — the feedback and the Next button — was painted over by the
          keyboard below.
        */}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-hidden pt-8 pb-2">
          <h1 className="shrink-0 text-center text-heading">{prompt}</h1>

          <div className="flex min-h-0 w-full max-w-full flex-1 items-center justify-center gap-3">
            <Score
              className="max-h-[34dvh] min-h-0 flex-1"
              mei={mei}
              label={scoreLabel}
              noteSpacing={noteSpacing}
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
        {/*
          The keyboard is built here rather than passed in ready-made,
          because what it has to show — the chosen key, the right one, whether
          anything is still pressable — is this screen's state, not the
          exercise's. `handleAnswer` reads the ref inside the click handler,
          never while rendering; the rule cannot see through the call.
        */}
        {/* oxlint-disable-next-line react/refs */}
        {keyboard({
          state: revealed ? 'revealed' : 'answering',
          chosen: answer?.chosen,
          correct: revealed ? correct : undefined,
          onAnswer: handleAnswer,
        })}
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
  const { t } = useTranslation('exercise')

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onQuit}
        className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
      >
        <Icon name="arrowBack" size={20} label={t('round.end')} />
      </button>

      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={t('round.progress', { current: index + 1, total })}
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

function Feedback<TQuestion, TAnswer>({
  answer,
  onNext,
}: {
  answer: Answered<TQuestion, TAnswer>
  onNext: () => void
}) {
  const { t } = useTranslation('exercise')

  if (answer.correct) {
    return (
      <p className="flex items-center gap-1.5 font-medium text-correct">
        <Icon name="correct" size={20} />
        {t('round.correct')}
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
      {t('round.next')}
    </button>
  )
}
