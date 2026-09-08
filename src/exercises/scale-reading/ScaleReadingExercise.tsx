import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { allowedModes, type ScaleRoundSpec } from '@/exercises/scale-shared/generate'
import { ScaleRoundScreen } from '@/exercises/scale-shared/ScaleRoundScreen'
import { ScaleSummary } from '@/exercises/scale-shared/ScaleSummary'
import { useScaleRound } from '@/exercises/scale-shared/useScaleRound'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playScale } from '@/lib/audio/engine'
import { DEFAULT_INSTRUMENT, type InstrumentId } from '@/lib/audio/instruments'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { scaleMei } from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { SCALE_READING_DIFFICULTIES } from './difficulties'
import { SetupScreen } from './SetupScreen'
import {
  READING_DIRECTIONS,
  SCALE_READING_SETTINGS,
  type ScaleReadingSettings,
} from './settings'

const EXERCISE_ID = 'scales/reading'

/**
 * Scale Reading.
 *
 * The whole scale is on the staff from the start, written keyless, and the
 * question is which mode those eight notes spell. Setup, then a fixed round,
 * then a summary.
 */
export default function ScaleReadingExercise() {
  const stored = useSetting(SCALE_READING_SETTINGS)
  const writeSettings = useSettingWriter(SCALE_READING_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const [draft, setDraft] = useState<ScaleReadingSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ScaleRoundSpec | undefined>(
    () =>
      settings === undefined
        ? undefined
        : { ...settings, directions: READING_DIRECTIONS },
    [settings],
  )

  const round = useScaleRound(spec, EXERCISE_ID)
  const options = useMemo(() => (spec === undefined ? [] : allowedModes(spec)), [spec])

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Silent until the answer is out, and then the scale can be heard — the
  // point at which hearing what you just read is worth anything. The samples
  // are fetched on that first press rather than up front, since most reading
  // rounds never ask for them.
  const sound = useCallback(
    (id: InstrumentId) =>
      current === undefined ? Promise.resolve() : playScale(current.pitches, id),
    [current],
  )

  const audio = usePlayback(DEFAULT_INSTRUMENT, sound)

  // Start fetching the ~7 MB engraver while the levels screen is being read,
  // so the first question is not waiting on a download.
  useEffect(preloadEngraver, [])

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
        titleKey="curriculum:categories.scales.exercises.reading.title"
        blurbKey="exercise:scales.reading.levelsBlurb"
        group="scale-reading"
        levels={SCALE_READING_DIFFICULTIES}
        onPick={(level) => {
          // Persist the level so Custom opens where you just were, and start
          // from the level itself rather than waiting for state to settle.
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start({ ...level.settings, directions: READING_DIRECTIONS })
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
        onStart={() => round.start()}
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

  return (
    <ScaleRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      options={options}
      correct={question.mode}
      mei={scaleMei({ pitches: question.pitches, clef: question.clef })}
      onPlay={revealed ? audio.play : undefined}
      playStatus={audio.status}
      // The notes, never the mode: reading them off the staff is the exercise,
      // so a screen reader gets exactly what a sighted player sees.
      scoreLabel={t('score.notes', {
        clef: names.clefSpoken(question.clef),
        pitches: question.pitches.map((pitch) => names.pitchSpoken(pitch)).join(', '),
      })}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
