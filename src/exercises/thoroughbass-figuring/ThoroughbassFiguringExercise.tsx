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

import { FiguringRoundScreen } from './FiguringRoundScreen'
import { FiguringSummary } from './FiguringSummary'
import { FIGURING_SETTINGS } from './settings'
import { useFiguringRound } from './useFiguringRound'

const EXERCISE_ID = 'thoroughbass/figuring'
const TITLE_KEY = 'curriculum:categories.thoroughbass.exercises.figuring.title'

/**
 * Figuring a bass — *beziffern*.
 *
 * A grand staff with the bass below and the chord above it, and the player
 * writes the figure that stands for them. The reading half of thoroughbass
 * turned round: everything is on the page, and what is being asked is what the
 * convention calls it.
 *
 * Nothing plays by itself. This is a reading exercise, the piano is tens of
 * megabytes, and most rounds never ask for it — so the samples are fetched on
 * the first press of the staff and not before.
 */
export default function ThoroughbassFiguringExercise() {
  const stored = useSetting(FIGURING_SETTINGS)
  const writeSettings = useSettingWriter(FIGURING_SETTINGS)
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<ThoroughbassSettings>()
  const settings = draft ?? stored

  const spec = useMemo<ThoroughbassRoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useFiguringRound(spec, EXERCISE_ID)

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

  // The bass under everything standing over it, all at once — which is what a
  // figure describes, and the only way to hear whether it is what you think.
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
        blurbKey="exercise:figuring.levelsBlurb"
        group="thoroughbass-figuring"
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
        blurbKey="exercise:figuring.setupBlurb"
        direction="figuring"
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
      <FiguringSummary
        answers={round.answers}
        onPlayAgain={() => round.start()}
        onChangeSettings={round.toLevels}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  return (
    <FiguringRoundScreen
      key={round.phase.index}
      phase={round.phase}
      total={round.questions.length}
      question={question}
      onPlay={audio.play}
      playStatus={audio.status}
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toLevels}
    />
  )
}
