import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { exerciseTitleKey } from '@/config/curriculum'
import { chordFilter } from '@/exercises/chord-shared/attempt'
import { ChordSummary } from '@/exercises/chord-shared/ChordSummary'
import { CHORD_DIFFICULTIES } from '@/exercises/chord-shared/difficulties'
import { chordSpec, type ChordRoundSpec } from '@/exercises/chord-shared/generate'
import { NamingRoundScreen } from '@/exercises/chord-shared/NamingRoundScreen'
import { chordSchedule } from '@/exercises/chord-shared/schedule'
import { SetupScreen } from '@/exercises/chord-shared/SetupScreen'
import type { ChordSettings } from '@/exercises/chord-shared/settings'
import { useChordRound } from '@/exercises/chord-shared/useChordRound'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playStruck, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { CHORD_HEARING_SETTINGS } from './settings'

const EXERCISE_ID = 'chords/hearing'

/**
 * Hearing chords — name what you cannot see.
 *
 * The ear's half of the braid, and the same round with the notation taken
 * away: the staff carries its clef and an empty stave until the answer is in,
 * and the chord appears with it. The notes are *engraved* the whole time and
 * simply not drawn, so the staff cannot resize at the moment of answering.
 *
 * **No root.** A chord sounding on its own says nothing about which absolute
 * note it is built on, so asking would be asking something there is nothing to
 * hear — the same rule `HEARABLE_INTERVAL_KEYS` states for intervals, and the
 * same rule that keeps a symmetric chord's inversion out of the question.
 *
 * It plays by itself, so the samples are fetched while the levels screen is
 * still being read.
 */
export default function ChordHearingExercise() {
  const { t } = useTranslation(['exercise', 'common'])
  const stored = useSetting(CHORD_HEARING_SETTINGS)
  const writeSettings = useSettingWriter(CHORD_HEARING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<ChordSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ChordRoundSpec | undefined>(
    () => (settings === undefined ? undefined : chordSpec(settings, 'hearing')),
    [settings],
  )

  const round = useChordRound(spec, EXERCISE_ID)

  // Coming back from the guide lands where it was opened from: the settings
  // survive the trip in Dexie but *which screen was showing* is React state
  // and does not. Once only — it says where to start, not where to stay.
  const [params] = useSearchParams()
  const returning = params.get('screen') === 'setup'
  const restored = useRef(false)
  const { toSetup } = round
  useEffect(() => {
    if (!returning || restored.current) return
    restored.current = true
    toSetup()
  }, [returning, toSetup])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  const sound = useCallback(
    () =>
      current === undefined ? Promise.resolve() : playStruck(chordSchedule(current)),
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

  if (settings === undefined || spec === undefined) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-ink-faint">{t('common:loading')}</p>
      </div>
    )
  }

  if (round.phase.name === 'levels') {
    return (
      <LevelsScreen
        titleKey={exerciseTitleKey('chords', 'hearing')}
        blurbKey="exercise:chord.hearing.levelsBlurb"
        group="chord-hearing"
        levels={CHORD_DIFFICULTIES}
        accuracyFilter={(level) =>
          chordFilter(chordSpec(level.settings, 'hearing'), EXERCISE_ID)
        }
        onPick={(level) => {
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start(chordSpec(level.settings, 'hearing'))
        }}
        onCustom={round.toSetup}
      />
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        titleKey={exerciseTitleKey('chords', 'hearing')}
        blurbKey="exercise:chord.hearing.setupBlurb"
        direction="hearing"
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
      <ChordSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <NamingRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      spec={spec}
      prompt={t('exercise:chord.prompt.hearing')}
      reducedMotion={reducedMotion}
      onPlay={audio.play}
      playStatus={audio.status}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
