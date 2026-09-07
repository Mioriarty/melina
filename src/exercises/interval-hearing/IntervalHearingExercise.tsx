import { useCallback, useEffect, useMemo, useState } from 'react'

import { IntervalRoundScreen } from '@/exercises/shared/IntervalRoundScreen'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import {
  allowedIntervals,
  firstNote,
  playOrder,
  secondNote,
  type IntervalQuestion,
  type RoundSpec,
} from '@/exercises/shared/generate'
import { useIntervalRound } from '@/exercises/shared/useIntervalRound'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { loadInstrument, playInterval, unlockAudio } from '@/lib/audio/engine'
import type { InstrumentId } from '@/lib/audio/instruments'
import { useSetting, useSettingWriter } from '@/lib/db/settings'
import { getClef } from '@/lib/music/clef'
import { isMelodic } from '@/lib/music/direction'
import { getKeySignature } from '@/lib/music/keySignature'
import { pitchSpokenName } from '@/lib/music/pitch'
import {
  harmonicIntervalMei,
  melodicIntervalMei,
  singleNoteMei,
} from '@/lib/notation/mei'
import { preloadEngraver } from '@/lib/notation/verovio'

import { PlayButton } from './PlayButton'
import { SetupScreen } from './SetupScreen'
import { INTERVAL_HEARING_SETTINGS, type IntervalHearingSettings } from './settings'

const EXERCISE_ID = 'intervals/hearing'

/**
 * Interval Hearing.
 *
 * The same round as Interval Reading, with the answer taken away from the
 * eye: only the note the interval starts from is on the staff, and its
 * partner appears when the answer is in. Which note that is follows the
 * direction — a descending interval starts from its upper note.
 */
export default function IntervalHearingExercise() {
  const stored = useSetting(INTERVAL_HEARING_SETTINGS)
  const writeSettings = useSettingWriter(INTERVAL_HEARING_SETTINGS)
  const reducedMotion = useReducedMotion()

  const [draft, setDraft] = useState<IntervalHearingSettings>()
  const settings = draft ?? stored

  const spec = useMemo<RoundSpec | undefined>(
    () => (settings === undefined ? undefined : settings),
    [settings],
  )

  const round = useIntervalRound(spec, EXERCISE_ID)
  const options = useMemo(
    () => (spec === undefined ? [] : allowedIntervals(spec)),
    [spec],
  )

  const instrument = settings?.instrument

  // Tagged with the instrument it describes, so switching instrument reads as
  // "not loaded yet" during render rather than needing an effect to reset it.
  const [audio, setAudio] = useState<{
    instrument: InstrumentId
    status: 'ready' | 'failed'
  }>()

  const settled = audio !== undefined && audio.instrument === instrument
  const instrumentReady = settled && audio.status === 'ready'
  const audioFailed = settled && audio.status === 'failed'

  useEffect(preloadEngraver, [])

  // Fetch the samples while the setup screen is being read, so the first
  // question is not waiting on a download. The AudioContext itself is only
  // unlocked by the "Start round" tap — browsers refuse to start one without
  // a user gesture.
  useEffect(() => {
    if (instrument === undefined) return

    let active = true
    loadInstrument(instrument)
      .then(() => {
        if (active) setAudio({ instrument, status: 'ready' })
      })
      .catch(() => {
        if (active) setAudio({ instrument, status: 'failed' })
      })

    return () => {
      active = false
    }
  }, [instrument])

  const play = useCallback(
    async (question: IntervalQuestion) => {
      if (instrument === undefined) return
      try {
        await playInterval(playOrder(question), question.direction, instrument)
        setAudio({ instrument, status: 'ready' })
      } catch {
        // A failed load or a blocked context must not strand the round: the
        // button goes quiet and the player can still answer from the staff.
        setAudio({ instrument, status: 'failed' })
      }
    },
    [instrument],
  )

  const current =
    round.phase.name === 'asking' || round.phase.name === 'revealed'
      ? round.questions[round.phase.index]
      : undefined

  // Sound each question once as it appears. `current` is the question object
  // itself, which does not change when the phase moves from asking to
  // revealed, so answering does not replay it.
  //
  useEffect(() => {
    if (current === undefined) return
    // Playing audio is exactly what an effect is for — synchronising with an
    // external system. `play` is async and records its outcome only after the
    // await, so nothing is set synchronously during this render.
    // oxlint-disable-next-line react/set-state-in-effect
    void play(current)
  }, [current, play])

  if (settings === undefined) {
    return (
      <div className="grid h-full place-items-center">
        <p className="text-sm text-ink-faint">Loading…</p>
      </div>
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
          // Unlock audio inside the tap itself, then start.
          void unlockAudio()
          round.start()
        }}
      />
    )
  }

  if (round.phase.name === 'summary') {
    return (
      <RoundSummary
        answers={round.answers}
        onPlayAgain={round.start}
        onChangeSettings={round.toSetup}
      />
    )
  }

  const question = current
  if (question === undefined) return null

  const revealed = round.phase.name === 'revealed'
  const clef = getClef(question.clef)
  const signature = getKeySignature(question.keySignature)

  // Before the answer, only the note the interval starts from. After it,
  // the pair — as a chord when they sounded together, and left to right in
  // the order they were played when they did not.
  const mei = !revealed
    ? singleNoteMei({
        pitch: firstNote(question),
        clef: question.clef,
        keySignature: question.keySignature,
      })
    : isMelodic(question.direction)
      ? melodicIntervalMei({
          first: firstNote(question),
          second: secondNote(question),
          clef: question.clef,
          keySignature: question.keySignature,
        })
      : harmonicIntervalMei(question)

  const scoreLabel = revealed
    ? `${clef.label} clef, key signature of ${signature.major} major: ${pitchSpokenName(firstNote(question))} and ${pitchSpokenName(secondNote(question))}`
    : `${clef.label} clef, key signature of ${signature.major} major: ${pitchSpokenName(firstNote(question))}`

  return (
    <IntervalRoundScreen
      key={round.phase.index}
      phase={round.phase}
      questions={round.questions}
      options={options}
      mei={mei}
      scoreLabel={scoreLabel}
      aside={
        <PlayButton
          onPlay={() => play(question)}
          loading={!instrumentReady}
          failed={audioFailed}
        />
      }
      reducedMotion={reducedMotion}
      onAnswer={round.answer}
      onNext={round.next}
      onQuit={round.toSetup}
    />
  )
}
