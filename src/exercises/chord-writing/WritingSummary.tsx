import type { ChordQuestion } from '@/exercises/chord-shared/generate'
import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { chordSize, memberAt } from '@/lib/music/chord'
import { tonicKey } from '@/lib/music/scale'
import { useTranslation } from 'react-i18next'

import type { WritingAnswer } from './rules'

export interface WritingSummaryProps {
  answers: readonly Answered<ChordQuestion, WritingAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * What just happened, grouped by chord quality.
 *
 * What the player wrote is read back as **notes**, because notes are what they
 * wrote — naming it would be naming a chord they may not have written at all,
 * and a wrong answer here is frequently not a chord with a name. The chip's
 * tooltip carries what was asked for, in words.
 */
export function WritingSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: WritingSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const asked = (answer: Answered<ChordQuestion, WritingAnswer>) => {
    const { chord, asks } = answer.question
    return [
      names.chordName(tonicKey(chord.root), chord.quality),
      names.inversionName(chord.inversion, chordSize(chord.quality)),
      ...(asks.lage ? [names.lage(memberAt(chord.top))] : []),
    ].join(t('chord.summary.join'))
  }

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => answer.question.chord.quality}
      subjectName={(answer) => names.chordQuality(answer.question.chord.quality)}
      answerName={(answer) =>
        answer.chosen.map((note) => names.tonic(tonicKey(note))).join(' ')
      }
      chipTitle={asked}
      allCorrect={t('chord.summary.allCorrect')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
