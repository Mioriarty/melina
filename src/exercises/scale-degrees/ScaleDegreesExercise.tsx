import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playDegrees, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { tonicTriad } from '@/lib/music/degree'
import { preloadEngraver } from '@/lib/notation/verovio'

import { degreeFilter } from './attempt'
import { DEGREE_DIFFICULTIES } from './difficulties'
import { DegreeRoundScreen } from './DegreeRoundScreen'
import { DegreeSummary } from './DegreeSummary'
import { allowedDegrees, type DegreeRoundSpec } from './generate'
import { SetupScreen } from './SetupScreen'
import { DEGREE_SETTINGS, type DegreeSettings } from './settings'
import { useDegreeRound } from './useDegreeRound'

const EXERCISE_ID = 'scales/degrees'

/**
 * Scale Degrees.
 *
 * A chord to put a key in the ear, then a short melody from that one scale, and
 * the player writes it down by naming each note's degree. The other half of
 * what melodic dictation asks for — rhythmic dictation is the *when*, and this
 * is the *what*.
 */
export default function ScaleDegreesExercise() {
  const stored = useSetting(DEGREE_SETTINGS)
  const writeSettings = useSettingWriter(DEGREE_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<DegreeSettings>()
  const settings = draft ?? stored

  const spec = useMemo<DegreeRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useDegreeRound(spec, EXERCISE_ID)
  const numbers = useMemo(() => (spec === undefined ? [] : allowedDegrees(spec)), [spec])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Bound to the question on screen, so the hook itself knows nothing about
  // degrees.
  const sound = useCallback(() => {
    if (current === undefined) return Promise.resolve()
    const chord = tonicTriad(current.tonic, current.mode) ?? []
    return playDegrees(chord, current.pitches)
  }, [current])

  const audio = usePlayback(sound)
  const { play, preload } = audio

  useEffect(preloadEngraver, [])

  // The piano, and this exercise plays by itself, so it is fetched while the
  // level screen is being read.
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
        <p className="text-sm text-ink-faint">{t('loading')}</p>
      </div>
    )
  }

  if (round.phase.name === 'levels') {
    return (
      <LevelsScreen
        titleKey="curriculum:categories.scales.exercises.degrees.title"
        blurbKey="exercise:degrees.levelsBlurb"
        group="scale-degrees"
        levels={DEGREE_DIFFICULTIES}
        accuracyFilter={(level) => degreeFilter(level.settings, EXERCISE_ID)}
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
          void unlockAudio()
          round.start()
        }}
        onBack={round.toLevels}
      />
    )
  }

  if (round.phase.name === 'summary') {
    return (
      <DegreeSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <DegreeRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      numbers={numbers}
      alterations={settings.alterations}
      onPlay={play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
