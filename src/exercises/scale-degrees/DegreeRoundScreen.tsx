import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DegreeKeyboard } from '@/components/input/DegreeKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { degreePitch, type Degree } from '@/lib/music/degree'
import type { Pitch } from '@/lib/music/pitch'

import { append, emptyDraft, isFull, removeLast, type DegreeDraft } from './draft'
import type { DegreeQuestion } from './generate'
import { DegreeScore } from './DegreeScore'

export interface DegreeRoundScreenProps {
  phase: ActivePhase<DegreeQuestion, readonly Degree[]>
  total: number
  question: DegreeQuestion
  /** The degree numbers this level offers. */
  numbers: readonly number[]
  alterations: boolean
  onPlay: () => void
  playStatus: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: readonly Degree[], ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * The shared round screen, answered by writing a melody down in degrees.
 *
 * The draft lives here because both halves of the screen need it: the staff
 * draws it, and the keyboard has to know when the melody is finished. The
 * screen is keyed by question index by its caller, so it remounts — and the
 * draft empties — for every question.
 *
 * **The melody answers itself on its last note**, the same way a bar of rhythm
 * does. There is no confirm key: every key goes dead once the melody is as long
 * as the one that was played, and backspace covers everything before that.
 */
export function DegreeRoundScreen({
  phase,
  total,
  question,
  numbers,
  alterations,
  onPlay,
  playStatus,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: DegreeRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<DegreeDraft>(() =>
    emptyDraft(question.degrees.length),
  )

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  const written = draft.degrees
    .map((degree) => degreePitch(question.tonic, question.mode, degree))
    .filter((pitch): pitch is Pitch => pitch !== undefined)

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.degree')}
      correct={question.degrees}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <DegreeScore
          tonic={question.tonic}
          mode={question.mode}
          clef={question.clef}
          keySignature={question.keySignature}
          slots={question.degrees.length}
          pitches={written}
          {...(wrong ? { answer: question.pitches } : {})}
          onPlay={onPlay}
          status={playStatus}
        />
      }
      keyboard={(binding) => (
        <DegreeKeyboard
          draft={draft}
          numbers={numbers}
          tonic={question.tonic}
          mode={question.mode}
          clef={question.clef}
          keySignature={question.keySignature}
          alterations={alterations}
          state={binding.state}
          onAppend={(degree) => {
            // Computed here rather than inside the updater: a state updater has
            // to be pure, and React runs it twice in development — which would
            // answer the question twice.
            const next = append(draft, degree)
            setDraft(next)
            if (isFull(next)) binding.onAnswer(next.degrees)
          }}
          onRemove={() => setDraft(removeLast)}
        />
      )}
    />
  )
}
