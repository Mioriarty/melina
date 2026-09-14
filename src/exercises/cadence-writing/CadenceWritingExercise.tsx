import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { exerciseTitleKey } from '@/config/curriculum'
import { cadenceFilter } from '@/exercises/harmony-shared/attempt'
import { cadenceSpec, type CadenceRoundSpec } from '@/exercises/harmony-shared/generate'
import { satzSchedule } from '@/exercises/harmony-shared/schedule'
import type { CadenceSettings } from '@/exercises/harmony-shared/settings'
import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { playStruck, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { preloadEngraver } from '@/lib/notation/verovio'

import { CadenceRoundScreen } from './CadenceRoundScreen'
import { CadenceSummary } from './CadenceSummary'
import { CADENCE_DIFFICULTIES } from './difficulties'
import { satzOf } from './rules'
import { SetupScreen } from './SetupScreen'
import { CADENCE_WRITING_SETTINGS } from './settings'
import { useCadenceRound } from './useCadenceRound'

const EXERCISE_ID = 'harmony/cadence'

/**
 * Writing a cadence out in four parts — Karlsruhe's Aufgabe 6.
 *
 * The first exercise here whose answer is **not compared against anything**. A
 * cadence can be set a dozen ways, all of them correct, so what is checked is
 * which rules the setting broke — see `voiceLeading.ts`, which was built as a
 * grader from the start for exactly this.
 *
 * **Nothing sounds until the answer is in.** The bass and the figures are the
 * question and are read rather than heard; playing the setting beforehand would
 * be playing the answer. Afterwards the staff is pressable and sounds what the
 * player actually wrote, which is most of why anyone writes a chorale down.
 */
export default function CadenceWritingExercise() {
  const { t } = useTranslation(['exercise', 'common'])
  const stored = useSetting(CADENCE_WRITING_SETTINGS)
  const writeSettings = useSettingWriter(CADENCE_WRITING_SETTINGS)

  const [draft, setDraft] = useState<CadenceSettings>()
  const settings = draft ?? stored

  const spec = useMemo<CadenceRoundSpec | undefined>(
    () => (settings === undefined ? undefined : cadenceSpec(settings)),
    [settings],
  )

  const round = useCadenceRound(spec, EXERCISE_ID)

  // Coming back from the guide lands where it was opened from: the settings
  // survive the trip in Dexie but *which screen was showing* is React state
  // and does not.
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

  // What the player wrote, not what the search would have written: the play
  // button appears only once an answer is in, and that is the answer it sounds.
  const answered = round.phase.name === 'revealed' ? round.phase.answer : undefined

  const sound = useCallback(() => {
    if (current === undefined || answered === undefined) return Promise.resolve()
    return playStruck(satzSchedule(satzOf(current, answered.chosen), current.tempo))
  }, [answered, current])

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
        titleKey={exerciseTitleKey('harmony', 'cadence')}
        blurbKey="exercise:harmony.cadence.levelsBlurb"
        group="harmony-cadence"
        levels={CADENCE_DIFFICULTIES}
        accuracyFilter={(level) =>
          cadenceFilter(cadenceSpec(level.settings), EXERCISE_ID)
        }
        onPick={(level) => {
          void unlockAudio()
          setDraft(level.settings)
          writeSettings(level.settings)
          round.start(cadenceSpec(level.settings))
        }}
        onCustom={round.toSetup}
      />
    )
  }

  if (round.phase.name === 'setup') {
    return (
      <SetupScreen
        settings={settings}
        titleKey={exerciseTitleKey('harmony', 'cadence')}
        blurbKey="exercise:harmony.cadence.setupBlurb"
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
      <CadenceSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <CadenceRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      onPlay={audio.play}
      playStatus={audio.status}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
