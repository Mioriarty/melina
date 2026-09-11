import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { LevelsScreen } from '@/exercises/shared/LevelsScreen'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { thoroughbassFilter } from '@/exercises/thoroughbass-shared/attempt'
import { THOROUGHBASS_DIFFICULTIES } from '@/exercises/thoroughbass-shared/difficulties'
import type { ThoroughbassRoundSpec } from '@/exercises/thoroughbass-shared/generate'
import { SetupScreen } from '@/exercises/thoroughbass-shared/SetupScreen'
import type { ThoroughbassSettings } from '@/exercises/thoroughbass-shared/settings'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playChord, unlockAudio } from '@/lib/audio/engine'
import { useSetting, useSettingWriter } from '@/lib/db/settings'

import { RealizingRoundScreen } from './RealizingRoundScreen'
import { RealizingSummary } from './RealizingSummary'
import { REALIZING_SETTINGS } from './settings'
import { useRealizingRound } from './useRealizingRound'

const EXERCISE_ID = 'thoroughbass/realizing'
const TITLE_KEY = 'curriculum:categories.thoroughbass.exercises.realizing.title'

/** Whether any figure in the level can take a note out of the key. */
function altersOf(settings: ThoroughbassSettings): boolean {
  return settings.figures.some((figure) => /[#bn]/.test(figure))
}

/**
 * Realising a figured bass — *aussetzen*.
 *
 * A grand staff with the bass and its figures, and the player puts the chord
 * on the staff above. The continuo player's own job, which is what makes it
 * the half of thoroughbass that is actually a skill rather than a reading of
 * one.
 */
export default function ThoroughbassRealizingExercise() {
  const stored = useSetting(REALIZING_SETTINGS)
  const writeSettings = useSettingWriter(REALIZING_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<ThoroughbassSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ThoroughbassRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useRealizingRound(spec, EXERCISE_ID)

  // **Coming back from the guide lands where it was opened from.** The
  // settings are in Dexie and survive the trip, but which screen was showing is
  // React state and does not — so without this, reading the explainer costs the
  // player their place and drops them on the level list. Once only: it says
  // where to *start*, not where to stay.
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
      current === undefined
        ? Promise.resolve()
        : playChord(current.events.flatMap((event) => [event.bass, ...event.chord])),
    [current],
  )

  const audio = usePlayback(sound)

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
        titleKey={TITLE_KEY}
        blurbKey="exercise:realizing.levelsBlurb"
        group="thoroughbass-realizing"
        levels={THOROUGHBASS_DIFFICULTIES}
        accuracyFilter={(level) => thoroughbassFilter(level.settings, EXERCISE_ID)}
        onPick={(level) => {
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
        titleKey={TITLE_KEY}
        blurbKey="exercise:realizing.setupBlurb"
        direction="realizing"
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
      <RealizingSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <RealizingRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      alterations={altersOf(settings)}
      onPlay={audio.play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
