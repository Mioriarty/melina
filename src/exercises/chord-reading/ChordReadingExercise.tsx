import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { exerciseTitleKey } from '@/config/curriculum'
import { chordFilter } from '@/exercises/chord-shared/attempt'
import { ChordSummary } from '@/exercises/chord-shared/ChordSummary'
import { CHORD_DIFFICULTIES } from '@/exercises/chord-shared/difficulties'
import type { ChordRoundSpec } from '@/exercises/chord-shared/generate'
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

import { CHORD_READING_SETTINGS } from './settings'

const EXERCISE_ID = 'chords/reading'

/**
 * Reading chords — name what is on the staff.
 *
 * The eye's half of the braid. The chord is drawn from the start and the
 * player names it: its root, its quality, and where its members stand. The
 * root is asked here and nowhere else, because here it can be seen — a chord
 * in isolation has no audible absolute root, which is why hearing does not
 * ask for one.
 *
 * Samples are fetched on the first press rather than up front: the piano is
 * tens of megabytes and most reading rounds never ask for it.
 */
export default function ChordReadingExercise() {
  const { t } = useTranslation(['exercise', 'common'])
  const stored = useSetting(CHORD_READING_SETTINGS)
  const writeSettings = useSettingWriter(CHORD_READING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<ChordSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ChordRoundSpec | undefined>(
    () =>
      settings === undefined ? undefined : { ...settings, byEar: false, namesRoot: true },
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
        titleKey={exerciseTitleKey('chords', 'reading')}
        blurbKey="exercise:chord.reading.levelsBlurb"
        group="chord-reading"
        levels={CHORD_DIFFICULTIES}
        accuracyFilter={(level) =>
          chordFilter({ ...level.settings, byEar: false, namesRoot: true }, EXERCISE_ID)
        }
        onPick={(level) => {
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start({ ...level.settings, byEar: false, namesRoot: true })
        }}
        onCustom={round.toSetup}
      />
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        titleKey={exerciseTitleKey('chords', 'reading')}
        blurbKey="exercise:chord.reading.setupBlurb"
        direction="reading"
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
      prompt={t('exercise:chord.prompt.reading')}
      reducedMotion={reducedMotion}
      onPlay={audio.play}
      playStatus={audio.status}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
