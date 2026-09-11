import { ChordNameKeyboard } from '@/components/input/ChordNameKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import type { ChordQuality } from '@/lib/music/chord'

import { ChordScore } from './ChordScore'
import {
  availableInversions,
  keyboardRows,
  type ChordQuestion,
  type ChordRoundSpec,
} from './generate'
import type { ChordAnswer } from './rules'

export interface NamingRoundScreenProps {
  phase: ActivePhase<ChordQuestion, ChordAnswer>
  total: number
  question: ChordQuestion
  spec: ChordRoundSpec
  /** `chord.prompt.reading` or `chord.prompt.hearing`. */
  prompt: string
  reducedMotion: boolean
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: ChordAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * One question of naming a chord, read or heard.
 *
 * The two exercises differ in exactly two things and this is where both of
 * them live: whether the notation is drawn before the answer, and whether the
 * staff can be pressed to sound it. Everything else — the rows, the grading,
 * the summary — is the same question asked of the same model, which is why
 * there is one screen rather than two.
 *
 * **Hearing shows the staff empty and fills it with the answer.** The chord is
 * engraved either way, so the box and the staff are the same size before and
 * after; it is `@visible` that changes, not what is on the page.
 */
export function NamingRoundScreen({
  phase,
  total,
  question,
  spec,
  prompt,
  reducedMotion,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: NamingRoundScreenProps) {
  const revealed = phase.name === 'revealed'

  // A reading question is playable only once its answer is out, since before
  // that the sound would answer it. A hearing question is playable always,
  // because sounding it *is* the question.
  const playable = spec.byEar || revealed
  const hidden = spec.byEar && !revealed

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={prompt}
      correct={{
        root: undefined,
        quality: question.chord.quality,
        inversion: question.chord.inversion,
        top: question.chord.top,
      }}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <ChordScore
          question={question}
          hidden={hidden}
          {...(playable ? { onPlay, status: playStatus } : {})}
        />
      }
      keyboard={(binding) => (
        <ChordNameKeyboard
          rows={keyboardRows(spec)}
          roots={spec.roots}
          qualities={spec.qualities}
          inversionsFor={(quality: ChordQuality) => availableInversions(spec, quality)}
          state={binding.state}
          correct={binding.state === 'revealed' ? question.chord : undefined}
          onAnswer={binding.onAnswer}
        />
      )}
    />
  )
}
