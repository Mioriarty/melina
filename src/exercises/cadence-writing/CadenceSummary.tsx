import { useTranslation } from 'react-i18next'

import type { CadenceQuestion } from '@/exercises/harmony-shared/generate'
import { orderFindings } from '@/exercises/harmony-shared/findingText'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { getRule, type Finding } from '@/lib/music/voiceLeading'
import { tonicKey } from '@/lib/music/scale'

import { cadenceReport, type CadenceAnswer } from './rules'

/**
 * What just happened, grouped by **the rule that was broken**.
 *
 * This is the payoff of the rules being a registry rather than a wall of `if`s.
 * Every other summary here groups by what was asked — an interval, a mode, a
 * quality — because that is what a miss is about. A four-part setting is not
 * missed, it is *faulted*, and "you wrote parallel fifths four times" is a
 * practice instruction where "you missed the Ganzschluss twice" is barely one:
 * the cadence was never the hard part.
 *
 * The line underneath says **where**, not what was answered. There is no answer
 * to print back — a setting is twelve notes and none of them is the mistake.
 */

type CadenceAnswered = Answered<CadenceQuestion, CadenceAnswer>

/** The fault worth naming: the first error, or the Lage where that was missed. */
function principal(answer: CadenceAnswered): Finding | 'lage' | undefined {
  const report = cadenceReport(answer.question, answer.chosen)
  const first = orderFindings(report.findings).find(
    (finding) => finding.severity === 'error',
  )
  if (first !== undefined) return first
  return report.lage ? undefined : 'lage'
}

export interface CadenceSummaryProps {
  answers: readonly CadenceAnswered[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

export function CadenceSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: CadenceSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const where = (answer: CadenceAnswered): string => {
    const fault = principal(answer)
    if (fault === undefined || fault === 'lage') return t('satb.summary.opening')
    return getRule(fault.id)?.scope === 'move'
      ? t('satb.summary.chords', { from: fault.at, to: fault.at + 1 })
      : t('satb.summary.chord', { chord: fault.at + 1 })
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => {
        const fault = principal(answer)
        return fault === undefined ? 'lage' : fault === 'lage' ? 'lage' : fault.id
      }}
      subjectName={(answer) => {
        const fault = principal(answer)
        return fault === undefined || fault === 'lage'
          ? t('satb.summary.lage')
          : names.rule(fault.id)
      }}
      answerName={where}
      answerLabelKey="exercise:satb.summary.where"
      chipTitle={(answer) => {
        const { key } = answer.question.progression
        return t('satb.summary.chipTitle', {
          key: names.scaleName(tonicKey(key.tonic), key.mode),
          lage: names.lage(answer.question.lage),
        })
      }}
      allCorrect={t('summary.allCorrect.cadence')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
