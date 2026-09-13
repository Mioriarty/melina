import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { harmonyFilter } from '@/exercises/harmony-shared/attempt'
import { harmonySchedule } from '@/exercises/harmony-shared/schedule'
import { harmonySpec, type HarmonyRoundSpec } from '@/exercises/harmony-shared/generate'
import type { HarmonySettings } from '@/exercises/harmony-shared/settings'
import { useBassRound } from '@/exercises/harmony-shared/useHarmonyRound'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { playStruck, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { BASS_DIFFICULTIES } from './difficulties'
import { BassRoundScreen } from './BassRoundScreen'
import { BassSummary } from './BassSummary'
import { SetupScreen } from './SetupScreen'
import { BASS_DICTATION_SETTINGS } from './settings'

const EXERCISE_ID = 'harmony/bass'
const TITLE_KEY = 'curriculum:categories.harmony.exercises.bass.title'
const BLURB_KEY = 'curriculum:categories.harmony.exercises.bass.blurb'

/**
 * Hear a four-part progression; write down its bass.
 *
 * The smallest exercise the harmony model can carry, and deliberately so: it
 * exists to make the generator **audible and judgeable**. Everything under it
 * — the block grammar, the voice-leading search, the figured-bass storage — is
 * built to serve a dozen exercises, and this is the one that proves it works
 * by putting it in front of an ear.
 */
export default function BassDictationExercise() {
  useTranslation(['exercise', 'common'])
  const stored = useSetting(BASS_DICTATION_SETTINGS)
  const writeSettings = useSettingWriter(BASS_DICTATION_SETTINGS)

  const [draft, setDraft] = useState<HarmonySettings>()
  const settings = draft ?? stored

  const spec = useMemo<HarmonyRoundSpec | undefined>(
    () => (settings === undefined ? undefined : harmonySpec(settings)),
    [settings],
  )

  const round = useBassRound(spec, EXERCISE_ID)

  // `?screen=setup` brings the player back where they left off after a trip to
  // a guide — the settings survive in Dexie, but which screen was showing is
  // React state and does not.
  const [params] = useSearchParams()
  const returning = params.get('screen') === 'setup'
  const restored = useRef(false)
  const { toSetup } = round
  useEffect(() => {
    if (!returning || restored.current || settings === undefined) return
    restored.current = true
    toSetup()
  }, [returning, settings, toSetup])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  const sound = useCallback(
    () =>
      current === undefined ? Promise.resolve() : playStruck(harmonySchedule(current)),
    [current],
  )
  const { status, play, preload } = usePlayback(sound)

  useEffect(preloadEngraver, [])
  // A hearing exercise preloads, because it plays by itself.
  useEffect(preload, [preload])
  useEffect(() => {
    if (current !== undefined) play()
  }, [current, play])

  if (settings === undefined || spec === undefined) return null

  if (round.phase.name === 'levels') {
    return (
      <LevelsScreen
        titleKey={TITLE_KEY}
        blurbKey={BLURB_KEY}
        group="harmony-bass"
        levels={BASS_DIFFICULTIES}
        accuracyFilter={(level) =>
          harmonyFilter(harmonySpec(level.settings), EXERCISE_ID)
        }
        onPick={(level) => {
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          // The spec is passed explicitly so picking a level starts a round in
          // the same tap, without waiting for Dexie to come back.
          round.start(harmonySpec(level.settings))
        }}
        onCustom={round.toSetup}
      />
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        titleKey={TITLE_KEY}
        blurbKey={BLURB_KEY}
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
      <BassSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toSetup}
      />
    )
  }

  if (current === undefined) return null

  return (
    <BassRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={current}
      onPlay={play}
      playStatus={status}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
