import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { intervalKey, type Interval } from '@/lib/music/interval'

import type { IntervalQuestion } from './generate'

export interface IntervalSummaryProps {
  answers: readonly Answered<IntervalQuestion, Interval>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/** The shared summary, naming intervals. */
export function IntervalSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: IntervalSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => intervalKey(question.interval)}
      subjectName={({ question }) => names.interval(question.interval)}
      answerName={({ chosen }) => names.interval(chosen)}
      chipTitle={({ question }) =>
        t('summary.questionLabel', {
          subject: names.interval(question.interval),
          clef: names.clef(question.clef),
        })
      }
      allCorrect={t('summary.allCorrect.intervals')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
