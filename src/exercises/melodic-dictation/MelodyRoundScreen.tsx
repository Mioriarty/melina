import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MelodyKeyboard } from '@/components/input/MelodyKeyboard'
import {
  append,
  arm,
  draftNodes,
  draftPhrase,
  draftPitches,
  isFull,
  leadingEntries,
  removeLast,
  seededDraft,
  type BarDraft,
} from '@/exercises/dictation-shared/draft'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import type { Degree } from '@/lib/music/degree'
import { barRhythm } from '@/lib/music/phrase'
import { notateRhythm } from '@/lib/notation/rhythmNotation'

import type { MelodyQuestion } from './generate'
import { MelodyScore } from './MelodyScore'
import type { MelodyAnswer } from './rules'

export interface MelodyRoundScreenProps {
  phase: ActivePhase<MelodyQuestion, MelodyAnswer>
  total: number
  question: MelodyQuestion
  /** The steps this level offers, for the keyboard's note keys. */
  steps: readonly Degree[]
  alterations: boolean
  /** Tuplet divisions this level offers, for the keyboard's switches. */
  tuplets: readonly number[]
  onPlay: () => void
  playStatus: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: MelodyAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * The shared round screen, answered by writing a melody down.
 *
 * The draft lives here rather than in the keyboard because both halves of the
 * screen need it: the staff draws it, and the keyboard has to know what is
 * still pressable. This screen is keyed by question index by its caller, so it
 * remounts — and the draft resets — for every question.
 *
 * **The first note is already written, and locked.** It is the leading symbol
 * of the correct answer's own spelling, carrying the first pitch, so the hint
 * can never disagree with what is being marked. Backspace stops above it: a
 * hint that can be deleted is not a hint, and the phrase would then have
 * nothing to say where it starts.
 *
 * **The phrase answers itself when the last bar is exactly full**, the same way
 * a bar of rhythm does. There is no confirm key: every key that would overflow
 * is disabled instead, so the only press left is the one that completes it.
 */
export function MelodyRoundScreen({
  phase,
  total,
  question,
  steps,
  alterations,
  tuplets,
  onPlay,
  playStatus,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: MelodyRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<BarDraft>(() =>
    seededDraft(
      question.phrase.meter,
      question.phrase.bars.length,
      // Taken from the spelling of the answer rather than worked out again, so
      // the note that is given is exactly the note that will be marked.
      leadingEntries(notateRhythm(barRhythm(question.phrase, 0)), question.pitches[0]),
    ),
  )

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  const answer = {
    bars: question.phrase.bars.map((_, index) =>
      notateRhythm(barRhythm(question.phrase, index)),
    ),
    pitches: question.pitches,
  }

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.melody')}
      correct={{ phrase: question.phrase, pitches: question.pitches }}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <MelodyScore
          meter={question.phrase.meter}
          clef={question.clef}
          keySignature={question.keySignature}
          tonic={question.tonic}
          mode={question.mode}
          barsPerSystem={question.barsPerSystem}
          // What the player wrote, spelled the way they wrote it — never a
          // tidied-up version, which would look like being corrected for
          // something that was not wrong.
          bars={draftNodes(draft)}
          pitches={draftPitches(draft)}
          {...(wrong ? { answer } : {})}
          onPlay={onPlay}
          status={playStatus}
        />
      }
      keyboard={(binding) => (
        <MelodyKeyboard
          draft={draft}
          steps={steps}
          tonic={question.tonic}
          mode={question.mode}
          clef={question.clef}
          keySignature={question.keySignature}
          alterations={alterations}
          tuplets={tuplets}
          state={binding.state}
          onAppend={(value) => {
            // Computed here rather than inside the updater: a state updater
            // has to be pure, and React runs it twice in development — which
            // would answer the question twice.
            const next = append(draft, value)
            setDraft(next)
            if (isFull(next)) {
              binding.onAnswer({
                phrase: draftPhrase(next),
                pitches: draftPitches(next),
              })
            }
          }}
          onRemove={() => setDraft(removeLast)}
          onArm={(division) => setDraft((current) => arm(current, division))}
        />
      )}
    />
  )
}
