import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'
import { useMusicNames } from '@/hooks/useMusicNames'
import { figureText } from '@/lib/notation/figureNotation'
import { tonicKey } from '@/lib/music/scale'

import type { RealizingAnswer } from './rules'

export interface RealizingSummaryProps {
  answers: readonly Answered<ThoroughbassQuestion, RealizingAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * The shared summary, grouped by the figure that was read.
 *
 * The same grouping as the figuring direction, and deliberately so: what a
 * player wants to know from either is which figure keeps catching them out,
 * and a finding that reads the same in both is a finding they can carry
 * between them.
 */
export function RealizingSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: RealizingSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const label = (question: ThoroughbassQuestion) => {
    const text = question.events
      .map((event) => event.figures.map(figureText).join(' – '))
      .join(', ')
    return text === '' ? t('thoroughbass.plain') : text
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => label(question)}
      subjectName={({ question }) =>
        t('realizing.summary.subject', {
          figure: label(question),
          bass: names.pitchSpoken(
            question.events[0]?.bass ?? { letter: 'C', alteration: 0, octave: 3 },
          ),
        })
      }
      // The notes that were placed, named the way the keyboard named them.
      answerName={({ chosen }) =>
        chosen
          .map((chord) => chord.map((note) => names.tonic(tonicKey(note))).join(' '))
          .join(', ')
      }
      chipTitle={({ question }) =>
        `${label(question)} · ${names.keyName(question.keySignature)}`
      }
      allCorrect={t('summary.allCorrect.realizing')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
