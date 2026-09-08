import { useTranslation } from 'react-i18next'

import { ScaleKeyboard } from '@/components/input/ScaleKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import type { ModeId } from '@/lib/music/scale'
import { SCALE_NOTE_SPACING } from '@/lib/notation/verovio'

import type { ScaleQuestion } from './generate'

export interface ScaleRoundScreenProps {
  phase: ActivePhase<ScaleQuestion, ModeId>
  total: number
  /** Exactly the modes that may be answered. */
  options: readonly ModeId[]
  /** This question's mode, revealed on the keyboard once answered. */
  correct: ModeId
  mei: string
  scoreLabel: string
  /** Sound the question — only once every note is on screen. */
  onPlay?: (() => void) | undefined
  playStatus?: PlaybackStatus
  reducedMotion: boolean
  onAnswer: (chosen: ModeId, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * The shared round screen, answered on the scale keyboard.
 *
 * Reading and hearing differ only in how much of the scale is on the staff
 * and whether there is a play button beside it, so both come through here.
 */
export function ScaleRoundScreen({ options, ...props }: ScaleRoundScreenProps) {
  const { t } = useTranslation('exercise')

  return (
    <RoundScreen
      {...props}
      prompt={t('round.prompt.scale')}
      noteSpacing={SCALE_NOTE_SPACING}
      keyboard={(binding) => (
        <ScaleKeyboard
          options={options}
          onAnswer={binding.onAnswer}
          state={binding.state}
          chosen={binding.chosen}
          correct={binding.correct}
        />
      )}
    />
  )
}
