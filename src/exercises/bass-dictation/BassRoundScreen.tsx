import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DegreeKeyboard } from '@/components/input/DegreeKeyboard'
import {
  append,
  emptyDraft,
  isFull,
  removeLast,
  type DegreeDraft,
} from '@/exercises/dictation-shared/degreeDraft'
import { SatbScore } from '@/exercises/harmony-shared/SatbScore'
import {
  bassDegrees,
  bassLength,
  bassTonic,
  type HarmonyQuestion,
} from '@/exercises/harmony-shared/generate'
import type { BassAnswer } from '@/exercises/harmony-shared/rules'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { DEGREE_NUMBERS, degreePitch, type Degree } from '@/lib/music/degree'
import { keySignatureOf } from '@/lib/music/key'
import type { Pitch } from '@/lib/music/pitch'

/**
 * Hear a progression, write down its bass.
 *
 * **The bass line answers itself on its last note**, the way a bar of rhythm
 * and a melody do: there is no confirm key, every key goes dead once the line
 * is as long as the one that was played, and backspace covers everything
 * before that.
 *
 * The degrees are drawn in the **bass clef** and in the octave a bass actually
 * sings in — see `bassTonic`, which picks it per key so the seven of them stay
 * inside the staff. Which octave the real bass took is not part of the answer,
 * so the keys only have to say which note, not where.
 */

export interface BassRoundScreenProps {
  phase: ActivePhase<HarmonyQuestion, BassAnswer>
  total: number
  question: HarmonyQuestion
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: BassAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export function BassRoundScreen({
  phase,
  total,
  question,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: BassRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<DegreeDraft>(() =>
    emptyDraft(bassLength(question.progression)),
  )

  const revealed = phase.name === 'revealed'
  const { key } = question.progression
  const tonic = bassTonic(key)

  const written = draft.degrees
    .map((degree) => degreePitch(tonic, key.mode, degree))
    .filter((pitch): pitch is Pitch => pitch !== undefined)

  const correct: readonly Degree[] = bassDegrees(question.progression) ?? []

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.bass')}
      correct={correct}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <SatbScore
          question={question}
          written={written}
          revealed={revealed}
          onPlay={onPlay}
          status={playStatus}
        />
      }
      keyboard={(binding) => (
        <DegreeKeyboard
          draft={draft}
          numbers={DEGREE_NUMBERS}
          tonic={tonic}
          mode={key.mode}
          clef="bass"
          keySignature={keySignatureOf(key) ?? '0'}
          alterations
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
