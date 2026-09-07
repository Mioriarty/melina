import { useEffect, useMemo, useState } from 'react'

import { IntervalRoundScreen } from '@/exercises/shared/IntervalRoundScreen'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import { allowedIntervals, type RoundSpec } from '@/exercises/shared/generate'
import { useIntervalRound } from '@/exercises/shared/useIntervalRound'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { getClef } from '@/lib/music/clef'
import { getKeySignature } from '@/lib/music/keySignature'
import { pitchSpokenName } from '@/lib/music/pitch'
import { harmonicIntervalMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { SetupScreen } from './SetupScreen'
import {
  INTERVAL_READING_SETTINGS,
  READING_DIRECTIONS,
  type IntervalReadingSettings,
} from './settings'

const EXERCISE_ID = 'intervals/reading'

/**
 * Interval Reading.
 *
 * Both notes are on the staff from the start; the whole question is whether
 * you can name what you see. Setup, then a fixed round, then a summary.
 */
export default function IntervalReadingExercise() {
  const stored = useSetting(INTERVAL_READING_SETTINGS)
  const writeSettings = useSettingWriter(INTERVAL_READING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<IntervalReadingSettings>()
  const settings = draft ?? stored

  const spec = useMemo<RoundSpec | undefined>(
    () =>
      settings === undefined
        ? undefined
        : { ...settings, directions: READING_DIRECTIONS },
    [settings],
  )

  const round = useIntervalRound(spec, EXERCISE_ID)
  const options = useMemo(
    () => (spec === undefined ? [] : allowedIntervals(spec)),
    [spec],
  )

  // Start fetching the ~7 MB engraver while the setup screen is being read,
  // so the first question is not waiting on a download.
  useEffect(preloadEngraver, [])

  if (settings === undefined) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        onChange={(next) => {
          setDraft(next)
          writeSettings(next)
        }}
        onStart={round.start}
      />
    )
  }

  if (round.phase.name === 'summary') {
    return (
      <RoundSummary
        answers={round.answers}
        onPlayAgain={round.start}
        onChangeSettings={round.toSetup}
      />
    )
  }

  const question = round.questions[round.phase.index]
  if (question === undefined) return null

  const clef = getClef(question.clef)
  const signature = getKeySignature(question.keySignature)

  return (
    <IntervalRoundScreen
      key={round.phase.index}
      phase={round.phase}
      questions={round.questions}
      options={options}
      mei={harmonicIntervalMei(question)}
      scoreLabel={`${clef.label} clef, key signature of ${signature.major} major: ${pitchSpokenName(question.lower)} and ${pitchSpokenName(question.upper)}`}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toSetup}
    />
  )
}
