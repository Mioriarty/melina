import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { IntervalKeyboard } from '@/components/input/IntervalKeyboard'
import { KeyboardShell } from '@/components/input/KeyboardShell'
import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { getClef } from '@/lib/music/clef'
import { getKeySignature } from '@/lib/music/keySignature'
import { intervalKey, intervalsEqual, type Interval } from '@/lib/music/interval'
import { pitchSpokenName } from '@/lib/music/pitch'
import { harmonicIntervalMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'
import { recordAttempt } from '@/lib/db/attempts'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { createRandom } from '@/lib/utils/seededRandom'
import { cn } from '@/lib/utils/cn'

import { allowedIntervals, generateRound, type Question } from './generate'
import { RoundSummary } from './RoundSummary'
import { SetupScreen } from './SetupScreen'
import { CORRECT_DELAY_MS, EXERCISE_ID, type Answered, type Phase } from './round'
import { INTERVAL_READING_SETTINGS, type IntervalReadingSettings } from './settings'

/**
 * Interval Reading.
 *
 * Setup, then a fixed round, then a summary. A correct answer moves on by
 * itself; a wrong one stops and shows which key was right, because the whole
 * value of getting it wrong is in looking at the answer.
 */
export default function IntervalReadingExercise() {
  const stored = useSetting(INTERVAL_READING_SETTINGS)
  const writeSettings = useSettingWriter(INTERVAL_READING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<IntervalReadingSettings>()
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [questions, setQuestions] = useState<readonly Question[]>([])
  const [answers, setAnswers] = useState<readonly Answered[]>([])

  // Start fetching the ~7 MB engraver while the setup screen is being read,
  // so the first question is not waiting on a download.
  useEffect(preloadEngraver, [])

  const settings = draft ?? stored

  const startRound = useCallback((active: IntervalReadingSettings) => {
    const round = generateRound(createRandom(Date.now() >>> 0), active)
    setQuestions(round)
    setAnswers([])
    setPhase(round.length === 0 ? { name: 'setup' } : { name: 'asking', index: 0 })
  }, [])

  if (settings === undefined) return <Loading />

  if (phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        onChange={(next) => {
          setDraft(next)
          writeSettings(next)
        }}
        onStart={() => startRound(settings)}
      />
    )
  }

  if (phase.name === 'summary') {
    return (
      <RoundSummary
        answers={answers}
        onPlayAgain={() => startRound(settings)}
        onChangeSettings={() => setPhase({ name: 'setup' })}
      />
    )
  }

  return (
    <RoundScreen
      key={phase.index}
      phase={phase}
      questions={questions}
      settings={settings}
      reducedMotion={reducedMotion}
      onAnswered={(answer) => {
        setAnswers((current) => [...current, answer])
        setPhase({ name: 'revealed', index: phase.index, answer })
      }}
      onNext={() => {
        const next = phase.index + 1
        setPhase(
          next >= questions.length
            ? { name: 'summary' }
            : { name: 'asking', index: next },
        )
      }}
      onQuit={() => setPhase({ name: 'setup' })}
    />
  )
}

interface RoundScreenProps {
  phase: Extract<Phase, { name: 'asking' | 'revealed' }>
  questions: readonly Question[]
  settings: IntervalReadingSettings
  reducedMotion: boolean
  onAnswered: (answer: Answered) => void
  onNext: () => void
  onQuit: () => void
}

function RoundScreen({
  phase,
  questions,
  settings,
  reducedMotion,
  onAnswered,
  onNext,
  onQuit,
}: RoundScreenProps) {
  const question = questions[phase.index]

  // Set on mount rather than during render: `useRef(Date.now())` evaluates
  // the clock on every render even though only the first value is kept, and
  // starting the timer after paint measures reading time more honestly.
  // RoundScreen is keyed by question index, so this remounts per question.
  const askedAt = useRef(0)
  useEffect(() => {
    askedAt.current = Date.now()
  }, [])
  const options = useMemo(() => allowedIntervals(settings), [settings])

  const revealed = phase.name === 'revealed'
  const answer = phase.name === 'revealed' ? phase.answer : undefined

  // A correct answer advances on its own; a wrong one waits to be dismissed.
  useEffect(() => {
    if (answer === undefined || !answer.correct) return
    const delay = reducedMotion ? 0 : CORRECT_DELAY_MS
    const timer = setTimeout(onNext, delay)
    return () => clearTimeout(timer)
  }, [answer, onNext, reducedMotion])

  const handleAnswer = useCallback(
    (chosen: Interval) => {
      if (question === undefined) return

      const correct = intervalsEqual(chosen, question.interval)
      const ms = Date.now() - askedAt.current

      recordAttempt({
        exerciseId: EXERCISE_ID,
        ts: Date.now(),
        correct,
        subject: intervalKey(question.interval),
        ...(correct ? {} : { answered: intervalKey(chosen) }),
        ms,
        context: { clef: question.clef, keySignature: question.keySignature },
      })

      onAnswered({ question, chosen, correct, ms })
    },
    [onAnswered, question],
  )

  if (question === undefined) return <Loading />

  const clef = getClef(question.clef)
  const signature = getKeySignature(question.keySignature)
  const mei = harmonicIntervalMei(question)

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

          <Score
            className="max-h-[34dvh] min-h-0 w-full flex-1"
            mei={mei}
            label={`${clef.label} clef, key signature of ${signature.major} major: ${pitchSpokenName(question.lower)} and ${pitchSpokenName(question.upper)}`}
          />

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
      <p className="mt-4 flex items-center gap-1.5 font-medium text-correct">
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
        'mt-4 flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper',
        'transition-colors hover:opacity-90',
      )}
    >
      <Icon name="arrowForward" size={18} />
      Next question
    </button>
  )
}

function Loading() {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-sm text-ink-faint">Loading…</p>
    </div>
  )
}
