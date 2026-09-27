import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { exerciseBlurbKey, exerciseTitleKey } from '@/config/curriculum'
import type { Difficulty } from '@/exercises/shared/difficulty'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import type { ActivePhase, Answered, ChangeSettings } from '@/exercises/shared/round'
import { useRound, type RoundRules } from '@/exercises/shared/useRound'
import { usePlayback, type PlaybackStatus } from '@/exercises/shared/usePlayback'
import { playStruck, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter, type SettingSpec } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { harmonyFilter } from './attempt'
import { harmonySpec, type HarmonyQuestion, type HarmonyRoundSpec } from './generate'
import { harmonySchedule } from './schedule'
import type { HarmonySettings } from './settings'
import { SetupScreen } from './SetupScreen'

/** What the round screen of a harmony dictation is handed. */
export interface HarmonyRoundProps<TAnswer> {
  phase: ActivePhase<HarmonyQuestion, TAnswer>
  total: number
  question: HarmonyQuestion
  settings: HarmonySettings
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: TAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export interface HarmonySummaryProps<TAnswer> {
  answers: readonly Answered<HarmonyQuestion, TAnswer>[]
  onPlayAgain: () => void
  changeSettings: ChangeSettings
}

export interface HarmonyDictationProps<TAnswer> {
  /** The id under the harmony category, which names its levels group too. */
  exercise: 'bass'
  levels: readonly Difficulty<HarmonySettings>[]
  settings: SettingSpec<HarmonySettings>
  rules: RoundRules<HarmonyRoundSpec, HarmonyQuestion, TAnswer>
  round: (props: HarmonyRoundProps<TAnswer>) => ReactNode
  summary: (props: HarmonySummaryProps<TAnswer>) => ReactNode
  /** Sections this exercise adds to the settings screen. */
  setup?: (
    settings: HarmonySettings,
    onChange: (patch: Partial<HarmonySettings>) => void,
  ) => ReactNode
}

/**
 * Hear a four-part progression; write down something about it.
 *
 * The bass, the soprano and the Stufen are three answers to one question, so
 * everything around the answer — the levels, the settings, the playback, the
 * establishing cadence, the attempt log — is this one component, and each
 * exercise supplies only its round screen, its summary and its rules.
 */
export function HarmonyDictation<TAnswer>({
  exercise,
  levels,
  settings: settingSpec,
  rules,
  round: renderRound,
  summary: renderSummary,
  setup,
}: HarmonyDictationProps<TAnswer>) {
  useTranslation(['exercise', 'common'])
  const exerciseId = `harmony/${exercise}`
  const titleKey = exerciseTitleKey('harmony', exercise)
  const blurbKey = exerciseBlurbKey('harmony', exercise)

  const stored = useSetting(settingSpec)
  const writeSettings = useSettingWriter(settingSpec)

  const [draft, setDraft] = useState<HarmonySettings>()
  const settings = draft ?? stored

  const spec = useMemo<HarmonyRoundSpec | undefined>(
    () => (settings === undefined ? undefined : harmonySpec(settings)),
    [settings],
  )

  const round = useRound(spec, exerciseId, rules)

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
        titleKey={titleKey}
        blurbKey={blurbKey}
        group={`harmony-${exercise}`}
        levels={levels}
        accuracyFilter={(level) => harmonyFilter(harmonySpec(level.settings), exerciseId)}
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
    const onChange = (patch: Partial<HarmonySettings>) => {
      const next = { ...settings, ...patch }
      setDraft(next)
      writeSettings(next)
    }
    return (
      <SetupScreen
        settings={settings}
        titleKey={titleKey}
        blurbKey={blurbKey}
        onChange={onChange}
        onStart={() => {
          void unlockAudio()
          round.start()
        }}
        onBack={round.toLevels}
      >
        {setup?.(settings, onChange)}
      </SetupScreen>
    )
  }

  if (round.phase.name === 'summary') {
    return renderSummary({
      answers: round.answers,
      onPlayAgain: () => round.start(),
      changeSettings: round.changeSettings,
    })
  }

  if (current === undefined) return null

  return (
    // Keyed by question, so the round screen remounts — and its draft empties —
    // for every question.
    <Fragment key={round.phase.index}>
      {renderRound({
        phase: round.phase,
        total: round.questions.length,
        question: current,
        settings,
        onPlay: play,
        playStatus: status,
        onAnswer: round.answer,
        onNext: round.next,
        onQuit: round.toLevels,
      })}
    </Fragment>
  )
}
