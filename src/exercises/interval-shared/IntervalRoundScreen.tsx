import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { IntervalKeyboard } from '@/components/input/IntervalKeyboard'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { Interval } from '@/lib/music/interval'

import type { IntervalQuestion } from './generate'

export interface IntervalRoundScreenProps {
  phase: ActivePhase<IntervalQuestion, Interval>
  total: number
  /** Exactly the intervals that may be answered. */
  options: readonly Interval[]
  /** This question's interval, revealed on the keyboard once answered. */
  correct: Interval
  mei: string
  scoreLabel: string
  aside?: ReactNode
  reducedMotion: boolean
  onAnswer: (chosen: Interval, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * The shared round screen, answered on the interval keyboard.
 *
 * Reading and hearing differ only in what notation they show and whether
 * there is a play button beside it, so both come through here.
 */
export function IntervalRoundScreen({ options, ...props }: IntervalRoundScreenProps) {
  const { t } = useTranslation('exercise')

  return (
    <RoundScreen
      {...props}
      prompt={t('round.prompt.interval')}
      keyboard={(binding) => (
        <IntervalKeyboard
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
