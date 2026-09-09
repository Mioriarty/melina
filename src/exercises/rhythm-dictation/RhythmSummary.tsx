import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { meterKey } from '@/lib/music/meter'
import { rhythmDivision, type Rhythm } from '@/lib/music/rhythm'

import type { RhythmQuestion } from './generate'

export interface RhythmSummaryProps {
  answers: readonly Answered<RhythmQuestion, Rhythm>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * The shared summary, grouped by what a bar was divided into.
 *
 * A rhythm has no name to group by the way an interval or a mode does — every
 * bar is its own — so grouping by the exact bar would list every miss
 * separately and say nothing. What is actually worth knowing is *what kind* of
 * bar keeps going wrong, which is the subdivision and the metre.
 */
export function RhythmSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: RhythmSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const kindOf = (question: RhythmQuestion) =>
    `${meterKey(question.rhythm.meter)} ${rhythmDivision(question.rhythm)}`

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) => names.meter(question.rhythm.meter)}
      subjectName={({ question }) =>
        t('rhythm.summary.subject', {
          meter: names.meter(question.rhythm.meter),
          division: names.division(rhythmDivision(question.rhythm)),
        })
      }
      // Every wrong bar is its own bar, so naming what was pressed would be a
      // list of tick offsets. How many impacts it had is the useful shape.
      answerName={(chosen) =>
        t('rhythm.summary.impacts', { count: chosen.onsets.length })
      }
      chipTitle={({ question }) => kindOf(question)}
      allCorrect={t('summary.allCorrect.rhythm')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
