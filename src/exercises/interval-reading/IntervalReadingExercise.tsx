import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { exerciseTitleKey } from '@/config/curriculum'
import { IntervalRoundScreen } from '@/exercises/shared/IntervalRoundScreen'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import { allowedIntervals, type RoundSpec } from '@/exercises/shared/generate'
import { useIntervalRound } from '@/exercises/shared/useIntervalRound'
import { useMusicNames } from '@/hooks/useMusicNames'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { harmonicIntervalMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { READING_DIFFICULTIES } from './difficulties'
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
  const { t } = useTranslation(['exercise', 'common'])
  const names = useMusicNames()
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
        <p className="text-sm text-ink-faint">{t('common:loading')}</p>
      </div>
    )
  }

  if (round.phase.name === 'levels') {
    return (
      <LevelsScreen
        titleKey={exerciseTitleKey('intervals', 'reading')}
        blurbKey="exercise:intervals.reading.levelsBlurb"
        group="reading"
        levels={READING_DIFFICULTIES}
        onPick={(level) => {
          // Persist the level so Custom opens where you just were, and start
          // from the level itself rather than waiting for state to settle.
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start({ ...level.settings, directions: READING_DIRECTIONS })
        }}
        onCustom={round.toSetup}
      />
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
        onStart={() => round.start()}
        onBack={round.toLevels}
      />
    )
  }

  if (round.phase.name === 'summary') {
    return (
      <RoundSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = round.questions[round.phase.index]
  if (question === undefined) return null

  return (
    <IntervalRoundScreen
      key={round.phase.index}
      phase={round.phase}
      questions={round.questions}
      options={options}
      mei={harmonicIntervalMei(question)}
      scoreLabel={t('score.twoNotes', {
        clef: names.clefSpoken(question.clef),
        key: names.keyMajorName(question.keySignature),
        first: names.pitchSpoken(question.lower),
        second: names.pitchSpoken(question.upper),
      })}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
