import { useTranslation } from 'react-i18next'

import type { HarmonySummaryProps } from '@/exercises/harmony-shared/HarmonyDictation'
import { keyChip } from '@/exercises/shared/keyChip'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { keyPitch, type Key } from '@/lib/music/key'
import { numeralKey, type Numeral } from '@/lib/music/numeral'
import { cadenceOf } from '@/lib/music/progression'
import { numeralText } from '@/lib/notation/harmonyNotation'
import type { HarmonyQuestion } from '@/exercises/harmony-shared/generate'

import { stufenAnswer, stufenVerdicts, type StufenAnswer } from './rules'

type StufenAnswered = Answered<HarmonyQuestion, StufenAnswer>

/** The first chord the answer named wrong, as the question wanted it. */
function firstMiss({ question, chosen }: StufenAnswered): Numeral | undefined {
  const wanted = stufenAnswer(question) ?? []
  const index = stufenVerdicts(question, chosen).findIndex((right) => !right)
  return wanted[index === -1 ? 0 : index]
}

function row(key: Key, numerals: readonly Numeral[]): string {
  return numerals.map((numeral) => numeralText(key, numeral).stufe).join(' ')
}

/**
 * What was missed, grouped by **the chord** that was missed.
 *
 * Where a line dictation groups by cadence, a chord has a name of its own, and
 * "you keep missing V7/V" is the most direct practice instruction there is —
 * so the first chord an answer got wrong is the finding, named in both
 * notations. What came after it may only be the player having lost their place.
 */
export function StufenSummary({
  answers,
  onPlayAgain,
  changeSettings,
}: HarmonySummaryProps<StufenAnswer>) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const named = (answer: StufenAnswered) => {
    const missed = firstMiss(answer)
    if (missed === undefined) return ''
    const text = numeralText(answer.question.progression.key, missed)
    return text.func === '' ? text.stufe : `${text.stufe} · ${text.func}`
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => {
        const missed = firstMiss(answer)
        return missed === undefined ? '' : named(answer) || numeralKey(missed)
      }}
      subjectName={named}
      answerName={({ question, chosen }) => row(question.progression.key, chosen)}
      chipLabel={({ question }) => {
        const { key } = question.progression
        return {
          main: names.techniqueSymbol(cadenceOf(question.progression) ?? 'frei'),
          sub: keyChip(names, keyPitch(key), key.mode).main,
        }
      }}
      chipTitle={({ question }) =>
        row(question.progression.key, stufenAnswer(question) ?? [])
      }
      allCorrect={t('harmony.summary.allCorrect.stufen')}
      onPlayAgain={onPlayAgain}
      changeSettings={changeSettings}
    />
  )
}
