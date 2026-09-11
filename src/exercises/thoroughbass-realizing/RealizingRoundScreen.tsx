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
  currentSlot,
  draftAnswer,
  emptyChordDraft,
  isFull,
  removeLast,
  type ChordDraft,
} from '@/exercises/chord-entry/draft'
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
  // One slot per **figure**, flattened across the bass notes: a suspension is
  // two chords under one bass, so the slots cannot be counted per event.
  const [draft, setDraft] = useState<ChordDraft>(() =>
    emptyChordDraft(question.events.flatMap((event) => event.notes.map((n) => n.length))),
  )

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  // What the player wrote, which stays on the page whatever the verdict was.
  // The draft's slots are flat, so they are handed back out in the same order
  // they were counted in.
  let slot = 0
  const events = question.events.map((event) => ({
    bass: event.bass,
    figures: event.figures,
    chords: event.figures.map(() => chordPitches(draft, slot++)),
  }))

  // The chord the next press goes into, banded behind the music. One chord is
  // one figure, which is the same grouping the slots were counted in.
  const cursor = currentSlot(
    draft,
    question.events.map((event) => event.figures.length),
  )

  // **A wrong chord is not replaced by the right one; the two are shown side by
  // side.** Swapping one for the other says you were wrong and nothing else,
  // and what is worth seeing is which note moved.
  const answer = question.events.map((event) => ({
    bass: event.bass,
    figures: event.figures,
    chords: event.chords,
  }))

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.realizing')}
      correct={question.events.flatMap((event) => event.notes)}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <GrandStaffScore
          keySignature={question.keySignature}
          events={events}
          {...(wrong ? { answer } : {})}
          {...(revealed || cursor === undefined ? {} : { cursor })}
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
