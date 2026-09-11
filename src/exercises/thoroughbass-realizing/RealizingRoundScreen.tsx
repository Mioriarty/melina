import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ChordKeyboard } from '@/components/input/ChordKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { GrandStaffScore } from '@/exercises/thoroughbass-shared/GrandStaffScore'
import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'

import {
  chordPitches,
  draftAnswer,
  emptyChordDraft,
  isFull,
  removeLast,
  type ChordDraft,
} from './draft'
import type { RealizingAnswer } from './rules'

export interface RealizingRoundScreenProps {
  phase: ActivePhase<ThoroughbassQuestion, RealizingAnswer>
  total: number
  question: ThoroughbassQuestion
  /** Whether the level's figures can take a note out of the key. */
  alterations: boolean
  onPlay: () => void
  playStatus: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: RealizingAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * One question of realising a figured bass.
 *
 * The bass and its figures are the question; the treble staff is where the
 * answer goes, and it fills as the player presses. There is no confirm key —
 * the chord is exactly as full as the figure says, so the last press left is
 * the one that completes it.
 *
 * The staff is not pressable until the answer is in. Before that it would
 * sound the chord being asked for, which is the answer.
 */
export function RealizingRoundScreen({
  phase,
  total,
  question,
  alterations,
  onPlay,
  playStatus,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: RealizingRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<ChordDraft>(() =>
    emptyChordDraft(question.events.map((event) => event.notes[0]?.length ?? 0)),
  )

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  const events = question.events.map((event, index) => ({
    bass: event.bass,
    figures: event.figures,
    // Once it is answered and wrong, the staff shows the chord that was wanted.
    chord: wrong ? event.chord : chordPitches(draft, index),
  }))

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.realizing')}
      correct={question.events.map((event) => event.notes[0] ?? [])}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <GrandStaffScore
          keySignature={question.keySignature}
          events={events}
          {...(revealed ? { onPlay, status: playStatus } : {})}
        />
      }
      keyboard={(binding) => (
        <ChordKeyboard
          draft={draft}
          keySignature={question.keySignature}
          alterations={alterations}
          state={binding.state}
          onChange={(next) => {
            setDraft(next)
            if (isFull(next)) binding.onAnswer(draftAnswer(next))
          }}
          onRemove={() => setDraft(removeLast)}
        />
      )}
    />
  )
}
