import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { RhythmKeyboard } from '@/components/input/RhythmKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import type { Rhythm } from '@/lib/music/rhythm'
import { notateRhythm } from '@/lib/notation/rhythmNotation'

import {
  append,
  arm,
  draftNodes,
  draftRhythm,
  emptyDraft,
  isFull,
  removeLast,
  type RhythmDraft,
} from './draft'
import type { RhythmQuestion } from './generate'
import { RhythmScore } from './RhythmScore'

export interface RhythmRoundScreenProps {
  phase: ActivePhase<RhythmQuestion, Rhythm>
  total: number
  question: RhythmQuestion
  /** Tuplet divisions this level offers, for the keyboard's switches. */
  tuplets: readonly number[]
  onPlay: () => void
  playStatus: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: Rhythm, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * The shared round screen, answered by writing a bar.
 *
 * The draft lives here rather than in the keyboard because both halves of the
 * screen need it: the staff draws it, and the keyboard has to know what is
 * still pressable. This screen is keyed by question index by its caller, so it
 * remounts — and the draft empties — for every question.
 *
 * **The bar answers itself when it is exactly full.** There is no confirm key:
 * every key that would overflow the bar is disabled instead, so the only press
 * left is the one that completes it, and backspace covers everything before
 * that. The submit rides on `binding.onAnswer`, which is what carries the same
 * answer timing every other exercise is measured with.
 */
export function RhythmRoundScreen({
  phase,
  total,
  question,
  tuplets,
  onPlay,
  playStatus,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: RhythmRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<RhythmDraft>(() => emptyDraft(question.rhythm.meter))

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.rhythm')}
      correct={question.rhythm}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <RhythmScore
          meter={question.rhythm.meter}
          // What the player wrote, spelled the way they wrote it — never a
          // tidied-up version, which would look like being corrected for
          // something that was not wrong.
          nodes={draftNodes(draft)}
          {...(wrong ? { answer: notateRhythm(question.rhythm) } : {})}
          onPlay={onPlay}
          status={playStatus}
        />
      }
      keyboard={(binding) => (
        <RhythmKeyboard
          draft={draft}
          tuplets={tuplets}
          state={binding.state}
          onAppend={(value) => {
            // Computed here rather than inside the updater: a state updater
            // has to be pure, and React runs it twice in development — which
            // would answer the question twice.
            const next = append(draft, value)
            setDraft(next)
            if (isFull(next)) binding.onAnswer(draftRhythm(next))
          }}
          onRemove={() => setDraft(removeLast)}
          onArm={(division) => setDraft((current) => arm(current, division))}
        />
      )}
    />
  )
}
