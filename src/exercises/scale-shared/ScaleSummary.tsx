import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ModeId } from '@/lib/music/scale'

import type { ScaleQuestion } from './generate'

export interface ScaleSummaryProps {
  answers: readonly Answered<ScaleQuestion, ModeId>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/** The shared summary, naming modes. */
export function ScaleSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: ScaleSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => names.modeShort(question.mode)}
      subjectName={({ question }) => names.modeFull(question.mode)}
      answerName={({ chosen }) => names.mode(chosen)}
      chipTitle={({ question }) =>
        t('summary.questionLabel', {
          subject: names.mode(question.mode),
          clef: names.clef(question.clef),
        })
      }
      allCorrect={t('summary.allCorrect.scales')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
