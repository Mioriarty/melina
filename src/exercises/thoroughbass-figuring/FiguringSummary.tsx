import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'
import { useMusicNames } from '@/hooks/useMusicNames'
import { figureText } from '@/lib/notation/figureNotation'

import type { FiguringAnswer } from './rules'

export interface FiguringSummaryProps {
  answers: readonly Answered<ThoroughbassQuestion, FiguringAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

const printed = (question: ThoroughbassQuestion) =>
  question.events.map((event) => event.figures.map(figureText).join(' – ')).join(', ')

/**
 * The shared summary, grouped by the figure that was asked for.
 *
 * Which is the useful grouping here in a way it is not for a rhythm: a figure
 * *is* a name, so "you keep missing 4/3" is a finding a player can act on, and
 * the plain triad — which is figured by writing nothing — needs words rather
 * than an empty chip.
 */
export function FiguringSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: FiguringSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const label = (question: ThoroughbassQuestion) => {
    const text = printed(question)
    return text === '' ? t('thoroughbass.plain') : text
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => label(question)}
      subjectName={({ question }) =>
        t('figuring.summary.subject', {
          figure: label(question),
          key: names.keyName(question.keySignature),
        })
      }
      answerName={({ chosen }) => {
        const wrote = chosen
          .map((figures) => figures.map(figureText).join(' – '))
          .join(', ')
        return wrote === '' ? t('thoroughbass.plain') : wrote
      }}
      chipTitle={({ question }) =>
        `${label(question)} · ${names.keyName(question.keySignature)}`
      }
      allCorrect={t('summary.allCorrect.figuring')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
