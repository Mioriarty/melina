import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered, ChangeSettings } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { tonicKey, type ModeId } from '@/lib/music/scale'

import type { ScaleQuestion } from './generate'

export interface ScaleSummaryProps {
  answers: readonly Answered<ScaleQuestion, ModeId>[]
  onPlayAgain: () => void
  changeSettings: ChangeSettings
}

/** The shared summary, naming modes. */
export function ScaleSummary({
  answers,
  onPlayAgain,
  changeSettings,
}: ScaleSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => names.modeShort(question.mode)}
      subjectName={({ question }) => names.modeFull(question.mode)}
      answerName={({ chosen }) => names.mode(chosen)}
      chipLabel={({ question }) => ({
        main: names.modeShort(question.mode),
        sub: names.tonic(tonicKey(question.tonic)),
      })}
      chipTitle={({ question }) =>
        t('summary.questionLabel', {
          subject: names.mode(question.mode),
          clef: names.clef(question.clef),
        })
      }
      allCorrect={t('summary.allCorrect.scales')}
      onPlayAgain={onPlayAgain}
      changeSettings={changeSettings}
    />
  )
}
