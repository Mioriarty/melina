import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { loadMelodyInstruments, playMelody, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { melodyFilter } from './attempt'
import { MELODY_DIFFICULTIES } from './difficulties'
import { allowedSteps, type MelodyRoundSpec } from './generate'
import { MelodyRoundScreen } from './MelodyRoundScreen'
import { MelodySummary } from './MelodySummary'
import { SetupScreen } from './SetupScreen'
import { MELODY_SETTINGS, type MelodySettings } from './settings'
import { useMelodyRound } from './useMelodyRound'

const EXERCISE_ID = 'dictation/short-melodies'

/**
 * Melodic Dictation.
 *
 * Hear a phrase, see its first note, and write down the rest of it. The
 * culmination of the two exercises beside it on the path: rhythmic dictation is
 * where the notes fall, scale degrees is which notes they are, and this is both
 * at once. Nothing underneath it is new — the bar builder, the degree model,
 * the round machinery and the attempt log all took it as written.
 */
export default function MelodicDictationExercise() {
  const stored = useSetting(MELODY_SETTINGS)
  const writeSettings = useSettingWriter(MELODY_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<MelodySettings>()
  const settings = draft ?? stored

  const spec = useMemo<MelodyRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useMelodyRound(spec, EXERCISE_ID)

  // **Coming back from the guide lands where it was opened from.** The
  // settings themselves are in Dexie and survive the trip, but which screen
  // was showing is React state and does not — so without this, reading the
  // explainer costs the player their place and they arrive at the level list.
  // Once only: it says where to *start*, not where to stay.
  const [params] = useSearchParams()
  const returning = params.get('screen') === 'setup'
  const restored = useRef(false)
  const { toSetup } = round
  useEffect(() => {
    if (!returning || restored.current) return
    restored.current = true
    toSetup()
  }, [returning, toSetup])
  const steps = useMemo(() => (spec === undefined ? [] : allowedSteps(spec)), [spec])

  // Only the brackets this level can actually produce, so a switch never
  // offers a tuplet no question will contain.
  const tuplets = useMemo(() => {
    if (settings === undefined) return []
    return [
      ...((settings.cellWeights.triplet ?? 0) > 0 ? [3] : []),
      ...((settings.cellWeights.quintuplet ?? 0) > 0 ? [5] : []),
    ]
  }, [settings])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Bound to the question on screen, so the hook itself knows nothing about
  // melodies.
  const sound = useCallback(() => {
    if (current === undefined) return Promise.resolve()
    return playMelody(current.phrase, current.pitches, {
      tempo: current.tempo,
      metronome: current.metronome,
    })
  }, [current])

  const audio = usePlayback(sound, loadMelodyInstruments)
  const { play, preload } = audio

  useEffect(preloadEngraver, [])

  // The piano *and* the kit — this exercise counts itself in and then plays
  // pitches, and it plays by itself the moment a question appears.
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
        titleKey="curriculum:categories.dictation.exercises.short-melodies.title"
        blurbKey="exercise:melody.levelsBlurb"
        group="melodic-dictation"
        levels={MELODY_DIFFICULTIES}
        accuracyFilter={(level) => melodyFilter(level.settings, EXERCISE_ID)}
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
      <MelodySummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <MelodyRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      steps={steps}
      alterations={settings.alterations}
      tuplets={tuplets}
      onPlay={play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
