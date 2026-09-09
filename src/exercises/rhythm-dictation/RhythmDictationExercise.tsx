import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { loadDrums, playRhythm, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { rhythmFilter } from './attempt'
import { RHYTHM_DIFFICULTIES } from './difficulties'
import type { RhythmRoundSpec } from './generate'
import { RhythmRoundScreen } from './RhythmRoundScreen'
import { RhythmSummary } from './RhythmSummary'
import { SetupScreen } from './SetupScreen'
import { RHYTHM_SETTINGS, type RhythmSettings } from './settings'
import { useRhythmRound } from './useRhythmRound'

const EXERCISE_ID = 'dictation/rhythm'

/** Which tuplets a level offers, which is what the keyboard shows switches for. */
function tupletsOf(settings: RhythmSettings): number[] {
  return [
    ...((settings.cellWeights.triplet ?? 0) > 0 ? [3] : []),
    ...((settings.cellWeights.quintuplet ?? 0) > 0 ? [5] : []),
  ]
}

/**
 * Rhythmic Dictation.
 *
 * A bar of metronome, then a bar on a snare drum, and the player writes down
 * what they heard. The first exercise where the staff is the answer rather
 * than the question — and the first that has no fixed set of answers at all,
 * since a rhythm is written rather than chosen.
 */
export default function RhythmDictationExercise() {
  const stored = useSetting(RHYTHM_SETTINGS)
  const writeSettings = useSettingWriter(RHYTHM_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<RhythmSettings>()
  const settings = draft ?? stored

  const spec = useMemo<RhythmRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useRhythmRound(spec, EXERCISE_ID)

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Bound to the question on screen, so the hook itself knows nothing about
  // rhythms.
  const sound = useCallback(
    () =>
      current === undefined
        ? Promise.resolve()
        : playRhythm(current.rhythm, {
            tempo: current.tempo,
            metronome: current.metronome,
          }),
    [current],
  )

  // The drum kit, not the piano: this exercise never plays a pitch, and the
  // piano is tens of megabytes.
  const audio = usePlayback(sound, loadDrums)
  const { play, preload } = audio

  useEffect(preloadEngraver, [])

  // A few hundred kilobytes rather than the piano's tens of megabytes, and
  // this exercise plays by itself, so it is fetched while the level screen is
  // being read.
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
        titleKey="curriculum:categories.dictation.exercises.rhythm.title"
        blurbKey="exercise:rhythm.levelsBlurb"
        group="rhythm-dictation"
        levels={RHYTHM_DIFFICULTIES}
        accuracyFilter={(level) => rhythmFilter(level.settings, EXERCISE_ID)}
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
      <RhythmSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <RhythmRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      tuplets={tupletsOf(settings)}
      onPlay={play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
