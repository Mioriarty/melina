import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { chordSize, memberAt } from '@/lib/music/chord'
import { tonicKey } from '@/lib/music/scale'
import { useTranslation } from 'react-i18next'

import type { ChordQuestion } from './generate'
import type { ChordAnswer } from './rules'

export interface ChordSummaryProps {
  answers: readonly Answered<ChordQuestion, ChordAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * What just happened, grouped by chord quality.
 *
 * **The quality is what a miss is worth grouping by**, not the whole chord: "you
 * keep missing the half-diminished seventh" is a practice instruction, and "you
 * missed the E♭ half-diminished seventh in second inversion once" is a fact
 * about one question. The inversion and the Lage go in the tooltip, where they
 * are available without crowding the list.
 *
 * What the player said instead names only the rows the question actually asked,
 * for the same reason grading only reads those: a row that was never on the
 * screen is not something they got wrong.
 */
export function ChordSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: ChordSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const said = (answer: Answered<ChordQuestion, ChordAnswer>) => {
    const { chosen, question } = answer
    const size = chordSize(chosen.quality)
    const parts = [
      ...(chosen.root === undefined ? [] : [names.tonic(chosen.root)]),
      names.chordQuality(chosen.quality),
      ...(chosen.inversion === undefined
        ? []
        : [names.inversionName(chosen.inversion, size)]),
      ...(chosen.top === undefined ? [] : [names.lage(memberAt(chosen.top))]),
    ]
    return question.asks.root || parts.length > 1
      ? parts.join(t('chord.summary.join'))
      : parts.join('')
  }

  const wanted = (answer: Answered<ChordQuestion, ChordAnswer>) => {
    const { chord, asks } = answer.question
    const size = chordSize(chord.quality)
    return [
      ...(asks.root ? [names.tonic(tonicKey(chord.root))] : []),
      names.chordQuality(chord.quality),
      ...(asks.inversion ? [names.inversionName(chord.inversion, size)] : []),
      ...(asks.lage ? [names.lage(memberAt(chord.top))] : []),
    ].join(t('chord.summary.join'))
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => answer.question.chord.quality}
      subjectName={(answer) => names.chordQuality(answer.question.chord.quality)}
      answerName={said}
      chipTitle={wanted}
      allCorrect={t('chord.summary.allCorrect')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
