import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { exerciseTitleKey } from '@/config/curriculum'
import { intervalFilter } from '@/exercises/interval-shared/attempt'
import { IntervalRoundScreen } from '@/exercises/interval-shared/IntervalRoundScreen'
import { IntervalSummary } from '@/exercises/interval-shared/IntervalSummary'
import {
  allowedIntervals,
  firstNote,
  playOrder,
  secondNote,
  type RoundSpec,
} from '@/exercises/interval-shared/generate'
import { useIntervalRound } from '@/exercises/interval-shared/useIntervalRound'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playInterval, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { isMelodic } from '@/lib/music/direction'
import { harmonicIntervalMei, melodicIntervalMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { HEARING_DIFFICULTIES } from './difficulties'
import { SetupScreen } from './SetupScreen'
import { INTERVAL_HEARING_SETTINGS, type IntervalHearingSettings } from './settings'

const EXERCISE_ID = 'intervals/hearing'

/**
 * Interval Hearing.
 *
 * The same round as Interval Reading, with the answer taken away from the
 * eye: only the note the interval starts from is on the staff, and its
 * partner appears when the answer is in. Which note that is follows the
 * direction — a descending interval starts from its upper note.
 */
export default function IntervalHearingExercise() {
  const { t } = useTranslation(['exercise', 'common'])
  const names = useMusicNames()
  const stored = useSetting(INTERVAL_HEARING_SETTINGS)
  const writeSettings = useSettingWriter(INTERVAL_HEARING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<IntervalHearingSettings>()
  const settings = draft ?? stored

  const spec = useMemo<RoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useIntervalRound(spec, EXERCISE_ID)
  const options = useMemo(
    () => (spec === undefined ? [] : allowedIntervals(spec)),
    [spec],
  )

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Bound to the question on screen, so the hook itself knows nothing about
  // intervals.
  const sound = useCallback(
    () =>
      current === undefined
        ? Promise.resolve()
        : playInterval(playOrder(current), current.direction),
    [current],
  )

  const audio = usePlayback(sound)
  const { play, preload } = audio

  useEffect(preloadEngraver, [])

  // Fetch the samples while the levels screen is being read: this exercise
  // plays by itself, so the first question must not wait on a download.
  useEffect(preload, [preload])

  // Sound each question once as it appears. `current` is the question object
  // itself, which does not change when the phase moves from asking to
  // revealed, so answering does not replay it.
  useEffect(() => {
    if (current === undefined) return
    play()
  }, [current, play])

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
        titleKey={exerciseTitleKey('intervals', 'hearing')}
        blurbKey="exercise:intervals.hearing.levelsBlurb"
        group="interval-hearing"
        levels={HEARING_DIFFICULTIES}
        accuracyFilter={(level) => intervalFilter(level.settings, EXERCISE_ID)}
        onPick={(level) => {
          // Unlock audio inside the tap itself — a level starts a round
          // straight away, and the first question plays by itself.
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start(level.settings)
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
        onStart={() => {
          // Unlock audio inside the tap itself, then start.
          void unlockAudio()
          round.start()
        }}
        onBack={round.toLevels}
      />
    )
  }

  if (round.phase.name === 'summary') {
    return (
      <IntervalSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  const revealed = round.phase.name === 'revealed'

  // Both notes are engraved either way — as a chord when they sounded
  // together, and left to right in the order they were played when they did
  // not. Before the answer the second one is simply not drawn, so the staff
  // does not shift when it appears.
  const mei = isMelodic(question.direction)
    ? melodicIntervalMei({
        first: firstNote(question),
        second: secondNote(question),
        clef: question.clef,
        keySignature: question.keySignature,
        ...(revealed ? {} : { hide: 'second' }),
      })
    : harmonicIntervalMei({
        ...question,
        // A simultaneous interval leads with its lower note.
        ...(revealed ? {} : { hide: 'upper' }),
      })

  const staff = {
    clef: names.clefSpoken(question.clef),
    key: names.keyMajorName(question.keySignature),
    first: names.pitchSpoken(firstNote(question)),
  }
  const scoreLabel = revealed
    ? t('score.twoNotes', { ...staff, second: names.pitchSpoken(secondNote(question)) })
    : t('score.oneNote', staff)

  return (
    <IntervalRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      options={options}
      correct={question.interval}
      mei={mei}
      scoreLabel={scoreLabel}
      onPlay={play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
