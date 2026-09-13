import { useTranslation } from 'react-i18next'

import { bassDegrees, type HarmonyQuestion } from '@/exercises/harmony-shared/generate'
import type { BassAnswer } from '@/exercises/harmony-shared/rules'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { Degree } from '@/lib/music/degree'
import { cadenceOf } from '@/lib/music/progression'

/**
 * What was missed, grouped by the Satztechnik it was missed in.
 *
 * **This is the payoff of storing the analysis.** Grouping by the cadence a
 * progression closed with turns a round into a finding a player can act on —
 * "you keep missing the Trugschluss" — where grouping by anything derivable
 * from the notes alone could only have said "you keep missing the third
 * chord", which is no use to anybody.
 */

export interface BassSummaryProps {
  answers: readonly Answered<HarmonyQuestion, BassAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

export function BassSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: BassSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const line = (degrees: readonly Degree[]) =>
    degrees.map((degree) => names.degreeShort(degree)).join(' ')

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => cadenceOf(answer.question.progression) ?? 'frei'}
      subjectName={(answer) =>
        names.technique(cadenceOf(answer.question.progression) ?? 'frei')
      }
      answerName={(answer) => line(answer.chosen)}
      chipTitle={(answer) => line(bassDegrees(answer.question.progression) ?? [])}
      allCorrect={t('harmony.summary.allCorrect')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
