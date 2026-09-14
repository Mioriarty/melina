import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SatbKeyboard } from '@/components/input/SatbKeyboard'
import { FindingList } from '@/exercises/harmony-shared/FindingList'
import { SatzScore } from '@/exercises/harmony-shared/SatzScore'
import { givenBass, type CadenceQuestion } from '@/exercises/harmony-shared/generate'
import {
  cursorOf,
  emptySatzDraft,
  isFull,
  removeLast,
  satzVoicings,
  type SatzDraft,
} from '@/exercises/satb-entry/draft'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { keySignatureOf } from '@/lib/music/key'
import type { VoiceId } from '@/lib/music/satbVoicing'

import { cadenceReport, type CadenceAnswer } from './rules'

/**
 * One question of writing a cadence out in four parts.
 *
 * The bass and its figures are the question; the three voices above them are
 * where the answer goes, and they fill chord by chord from the bottom up. There
 * is no confirm key — a setting is exactly fillable, so the press that completes
 * the last chord is the press that answers.
 *
 * **The staff is not pressable until the answer is in**, and then it sounds
 * what the player wrote rather than what the app would have written. There is
 * no model answer on the page at all: a cadence can be set a dozen ways, all of
 * them right, and printing one beside a wrong answer would claim otherwise.
 * What is printed instead is which rules the setting broke.
 */

/** The bass is given; these are written, bottom up, as a chorale is built. */
const WRITTEN: readonly VoiceId[] = ['tenor', 'alto', 'soprano']

export interface CadenceRoundScreenProps {
  phase: ActivePhase<CadenceQuestion, CadenceAnswer>
  total: number
  question: CadenceQuestion
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: CadenceAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

export function CadenceRoundScreen({
  phase,
  total,
  question,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: CadenceRoundScreenProps) {
  const { t } = useTranslation('exercise')

  const [draft, setDraft] = useState<SatzDraft>(() =>
    emptySatzDraft(
      givenBass(question).map((bass) => ({ bass })),
      WRITTEN,
    ),
  )

  const revealed = phase.name === 'revealed'
  const cursor = revealed ? undefined : cursorOf(draft)

  // Only worth computing once there is a finished setting to report on.
  const written = satzVoicings(draft)
  const report =
    revealed && written !== undefined ? cadenceReport(question, written) : undefined

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.cadence')}
      correct={question.model.voicings}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <>
          <SatzScore
            question={question}
            draft={draft}
            revealed={revealed}
            cursor={cursor}
            {...(revealed ? { onPlay, status: playStatus } : {})}
          />
          {/* Drawn empty while the question is open, because the room it
              takes is reserved either way — see `FindingList`. */}
          <FindingList
            findings={report?.findings ?? []}
            {...(report === undefined || report.lage
              ? {}
              : { missedLage: question.lage })}
          />
        </>
      }
      keyboard={(binding) => (
        <SatbKeyboard
          draft={draft}
          keySignature={keySignatureOf(question.progression.key) ?? '0'}
          // **Always offered, never per question.** Whether a particular
          // cadence wants a note from outside the key is exactly the sort of
          // thing a keyboard must not give away — switches that appeared only
          // where one was needed would announce the borrowed chord before the
          // player had written a note. A player who arms one where nothing
          // needs it has simply written a wrong note, which is theirs to make.
          alterations
          state={binding.state}
          onChange={(next) => {
            setDraft(next)
            if (!isFull(next)) return
            const answer = satzVoicings(next)
            if (answer !== undefined) binding.onAnswer(answer)
          }}
          onRemove={() => setDraft(removeLast)}
        />
      )}
    />
  )
}
