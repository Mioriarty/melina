import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { exerciseTitleKey } from '@/config/curriculum'
import { chordFilter } from '@/exercises/chord-shared/attempt'
import { CHORD_DIFFICULTIES } from '@/exercises/chord-shared/difficulties'
import type { ChordRoundSpec } from '@/exercises/chord-shared/generate'
import { chordSchedule } from '@/exercises/chord-shared/schedule'
import { SetupScreen } from '@/exercises/chord-shared/SetupScreen'
import type { ChordSettings } from '@/exercises/chord-shared/settings'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playStruck, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { CHORD_WRITING_SETTINGS } from './settings'
import { useWritingRound } from './useWritingRound'
import { WritingRoundScreen } from './WritingRoundScreen'
import { WritingSummary } from './WritingSummary'

const EXERCISE_ID = 'chords/writing'

/**
 * Writing chords — put a named one on the staff.
 *
 * Where the braid closes. Reading and hearing both end in a name; this one
 * starts from one, and the staff is where the answer goes rather than where
 * the question is — the same shape rhythmic dictation and realising a figured
 * bass have.
 *
 * The whole answer surface is thoroughbass's, unchanged: `ChordKeyboard` draws
 * each key as the note pressing it would write, `voiceChord` decides where that
 * note sits, and the chord answers itself when it is full. What it needed was a
 * double accidental — a diminished seventh above C is B double flat — and that
 * is one press more on a switch that was already there.
 */
export default function ChordWritingExercise() {
  const { t } = useTranslation(['exercise', 'common'])
  const stored = useSetting(CHORD_WRITING_SETTINGS)
  const writeSettings = useSettingWriter(CHORD_WRITING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<ChordSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ChordRoundSpec | undefined>(
    () =>
      settings === undefined
        ? undefined
        : { ...settings, byEar: false, namesRoot: false },
    [settings],
  )

  const round = useWritingRound(spec, EXERCISE_ID)

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

  useEffect(preloadEngraver, [])

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
        titleKey={exerciseTitleKey('chords', 'writing')}
        blurbKey="exercise:chord.writing.levelsBlurb"
        group="chord-writing"
        levels={CHORD_DIFFICULTIES}
        accuracyFilter={(level) =>
          chordFilter({ ...level.settings, byEar: false, namesRoot: false }, EXERCISE_ID)
        }
        onPick={(level) => {
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start({ ...level.settings, byEar: false, namesRoot: false })
        }}
        onCustom={round.toSetup}
      />
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        titleKey={exerciseTitleKey('chords', 'writing')}
        blurbKey="exercise:chord.writing.setupBlurb"
        direction="writing"
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
      <WritingSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <WritingRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      reducedMotion={reducedMotion}
      onPlay={audio.play}
      playStatus={audio.status}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
