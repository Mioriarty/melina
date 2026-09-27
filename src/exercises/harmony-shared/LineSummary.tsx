import { useTranslation } from 'react-i18next'

import { keyChip } from '@/exercises/shared/keyChip'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered, ChangeSettings } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { Degree } from '@/lib/music/degree'
import { keyPitch } from '@/lib/music/key'
import { cadenceOf } from '@/lib/music/progression'

import type { HarmonyQuestion } from './generate'
import type { LineDef } from './lines'
import type { LineAnswer } from './rules'

/**
 * What was missed, grouped by the Satztechnik it was missed in.
 *
 * **This is the payoff of storing the analysis.** Grouping by the cadence a
 * progression closed with turns a round into a finding a player can act on —
 * "you keep missing the Trugschluss" — where grouping by anything derivable
 * from the notes alone could only have said "you keep missing the third
 * chord", which is no use to anybody.
 */

export interface LineSummaryProps {
  line: LineDef
  answers: readonly Answered<HarmonyQuestion, LineAnswer>[]
  onPlayAgain: () => void
  changeSettings: ChangeSettings
}

export function LineSummary({
  line,
  answers,
  onPlayAgain,
  changeSettings,
}: LineSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const written = (degrees: readonly Degree[]) =>
    degrees.map((degree) => names.degreeShort(degree)).join(' ')

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => cadenceOf(answer.question.progression) ?? 'frei'}
      subjectName={(answer) =>
        names.technique(cadenceOf(answer.question.progression) ?? 'frei')
      }
      answerName={(answer) => written(answer.chosen)}
      chipLabel={({ question }) => {
        const { key } = question.progression
        return {
          main: names.techniqueSymbol(cadenceOf(question.progression) ?? 'frei'),
          sub: keyChip(names, keyPitch(key), key.mode).main,
        }
      }}
      chipTitle={(answer) => written(line.answer(answer.question) ?? [])}
      allCorrect={t(`harmony.summary.allCorrect.${line.voice}`)}
      onPlayAgain={onPlayAgain}
      changeSettings={changeSettings}
    />
  )
}
