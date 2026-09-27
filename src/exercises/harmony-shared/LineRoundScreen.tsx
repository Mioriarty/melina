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
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { degreePitch, type Degree } from '@/lib/music/degree'
import { keySignatureOf } from '@/lib/music/key'
import type { Pitch } from '@/lib/music/pitch'

import type { HarmonyQuestion } from './generate'
import type { LineDef } from './lines'
import type { LineAnswer } from './rules'
import { SatbScore } from './SatbScore'

/**
 * Hear a progression, write down one of its voices.
 *
 * **The line answers itself on its last note**, the way a bar of rhythm and a
 * melody do: there is no confirm key, every key goes dead once the line is as
 * long as the one that was played, and backspace covers everything before
 * that.
 *
 * The keys are drawn in the voice's own clef and register — `LineDef.tonic`
 * picks the octave per key so every step the keyboard offers stays readable.
 */

export interface LineRoundScreenProps {
  line: LineDef
  phase: ActivePhase<HarmonyQuestion, LineAnswer>
  total: number
  question: HarmonyQuestion
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: LineAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export function LineRoundScreen({
  line,
  phase,
  total,
  question,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: LineRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<DegreeDraft>(() => emptyDraft(line.length(question)))

  const revealed = phase.name === 'revealed'
  const { key } = question.progression
  const tonic = line.tonic(key)

  const written = draft.degrees
    .map((degree) => degreePitch(tonic, key.mode, degree))
    .filter((pitch): pitch is Pitch => pitch !== undefined)

  const correct: readonly Degree[] = line.answer(question) ?? []

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t(`round.prompt.${line.voice}`)}
      correct={correct}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <SatbScore
          question={question}
          written={{
            voice: line.voice,
            pitches: written,
            slots: line.slots(question.satz.events),
          }}
          revealed={revealed}
          onPlay={onPlay}
          status={playStatus}
        />
      }
      keyboard={(binding) => (
        <DegreeKeyboard
          draft={draft}
          steps={line.steps(key)}
          tonic={tonic}
          mode={key.mode}
          clef={line.clef}
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
