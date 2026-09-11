import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FigureKeyboard } from '@/components/input/FigureKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { GrandStaffScore } from '@/exercises/thoroughbass-shared/GrandStaffScore'
import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'

import {
  draftAnswer,
  draftEvents,
  emptyFigureDraft,
  finish,
  isComplete,
  removeLast,
  type FigureDraft,
} from './draft'
import { FigureVerdict } from './FigureVerdict'
import type { FiguringAnswer } from './rules'

export interface FiguringRoundScreenProps {
  phase: ActivePhase<ThoroughbassQuestion, FiguringAnswer>
  total: number
  question: ThoroughbassQuestion
  onPlay: () => void
  playStatus: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: FiguringAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * One question of figuring a bass.
 *
 * The chord is on the staff from the start — it *is* the question — so it can
 * be sounded at any time, unlike a reading exercise whose play button waits
 * for the answer. What appears under the bass as the player types is their own
 * figure; once the answer is in, the staff shows the conventional one instead,
 * with the verdict line underneath saying which kind of wrong it was.
 */
export function FiguringRoundScreen({
  phase,
  total,
  question,
  onPlay,
  playStatus,
  reducedMotion,
  onAnswer,
  onNext,
  onQuit,
}: FiguringRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const [draft, setDraft] = useState<FigureDraft>(() =>
    emptyFigureDraft(question.events.length),
  )

  const revealed = phase.name === 'revealed'
  const chosen = revealed ? phase.answer.chosen : undefined
  const wrong = revealed && !phase.answer.correct

  const written = draftEvents(draft)
  const events = question.events.map((event, index) => ({
    bass: event.bass,
    chord: event.chord,
    // Once it is answered, the staff carries the answer rather than the draft.
    figures: revealed ? event.figures : (written[index] ?? []),
  }))

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.figuring')}
      correct={question.events.map((event) => event.figures)}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <>
          <GrandStaffScore
            keySignature={question.keySignature}
            events={events}
            onPlay={onPlay}
            status={playStatus}
          />
          {wrong && <FigureVerdict question={question} chosen={chosen} />}
        </>
      }
      keyboard={(binding) => (
        <FigureKeyboard
          draft={draft}
          state={binding.state}
          onChange={setDraft}
          onRemove={() => setDraft(removeLast)}
          onFinish={() => {
            // Computed outside the updater: React runs updaters twice in dev,
            // and answering from inside one would fire the answer twice.
            const next = finish(draft)
            setDraft(next)
            if (isComplete(next)) binding.onAnswer(draftAnswer(next))
          }}
        />
      )}
    />
  )
}
