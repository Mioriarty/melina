import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  allowedModes,
  firstNote,
  playOrder,
  type ScaleRoundSpec,
} from '@/exercises/scale-shared/generate'
import { scaleFilter } from '@/exercises/scale-shared/attempt'
import { ScaleRoundScreen } from '@/exercises/scale-shared/ScaleRoundScreen'
import { ScaleSummary } from '@/exercises/scale-shared/ScaleSummary'
import { useScaleRound } from '@/exercises/scale-shared/useScaleRound'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playScale, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { scaleMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { SCALE_HEARING_DIFFICULTIES } from './difficulties'
import { SetupScreen } from './SetupScreen'
import { SCALE_HEARING_SETTINGS, type ScaleHearingSettings } from './settings'

const EXERCISE_ID = 'scales/hearing'

/**
 * Scale Hearing.
 *
 * The same round as Scale Reading with the answer taken away from the eye:
 * only the note the scale starts from is on the staff, and the rest of it
 * appears once the answer is in. Which note that is follows the direction —
 * a descending scale starts from the octave above the tonic.
 */
export default function ScaleHearingExercise() {
  const stored = useSetting(SCALE_HEARING_SETTINGS)
  const writeSettings = useSettingWriter(SCALE_HEARING_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [draft, setDraft] = useState<ScaleHearingSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ScaleRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useScaleRound(spec, EXERCISE_ID)
  const options = useMemo(() => (spec === undefined ? [] : allowedModes(spec)), [spec])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Bound to the question on screen, so the hook itself knows nothing about
  // scales.
  const sound = useCallback(
    () => (current === undefined ? Promise.resolve() : playScale(playOrder(current))),
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
        <p className="text-sm text-ink-faint">{t('loading')}</p>
      </div>
    )
  }

  if (round.phase.name === 'levels') {
    return (
      <LevelsScreen
        titleKey="curriculum:categories.scales.exercises.hearing.title"
        blurbKey="exercise:scales.hearing.levelsBlurb"
        group="scale-hearing"
        levels={SCALE_HEARING_DIFFICULTIES}
        accuracyFilter={(level) => scaleFilter(level.settings, EXERCISE_ID)}
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
      <ScaleSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  const revealed = round.phase.name === 'revealed'
  const opening = firstNote(question)
  const order = playOrder(question)

  // The whole scale is engraved either way — written in the order it was
  // played, so a descending one reads downwards across the staff exactly as
  // it was heard. Before the answer the rest of it is simply not drawn, which
  // is what stops the staff from jumping when it appears.
  const mei = scaleMei({
    pitches: order,
    clef: question.clef,
    ...(revealed ? {} : { hideFrom: 1 }),
  })

  const shown = revealed ? order : [opening]

  return (
    <ScaleRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      options={options}
      correct={question.mode}
      mei={mei}
      scoreLabel={t('score.notes', {
        clef: names.clefSpoken(question.clef),
        pitches: shown.map((pitch) => names.pitchSpoken(pitch)).join(', '),
      })}
      onPlay={play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
