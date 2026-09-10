import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { samePhrase } from '@/lib/music/phrase'
import { sameSounds } from '@/lib/music/pitch'
import { rhythmDivision } from '@/lib/music/rhythm'
import { barRhythm } from '@/lib/music/phrase'
import { tonicKey } from '@/lib/music/scale'

import type { MelodyQuestion } from './generate'
import type { MelodyAnswer } from './rules'

export interface MelodySummaryProps {
  answers: readonly Answered<MelodyQuestion, MelodyAnswer>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/** The finest division anywhere in the phrase, which is what it asked for. */
function division(question: MelodyQuestion) {
  const found = question.phrase.bars.map((_, index) =>
    rhythmDivision(barRhythm(question.phrase, index)),
  )
  const order = ['quarter', 'eighth', 'sixteenth', 'triplet', 'quintuplet']
  return found.reduce((finest, id) =>
    order.indexOf(id) > order.indexOf(finest) ? id : finest,
  )
}

/**
 * The shared summary, grouped by the key a melody was in.
 *
 * Like a bar of rhythm, a melody has no name of its own to group by — every
 * one is different — so what is worth knowing is what *kind* keeps going
 * wrong. The key is the grouping, because it is the thing a player builds a
 * sense of one at a time, and the subject line adds the metre and the
 * subdivision so a row says which half of the exercise it was.
 *
 * **What was answered says which half went wrong**, which no other exercise
 * here can say: a melody can be right in its rhythm and wrong in its notes, or
 * the reverse, and "you had the rhythm" is the single most useful thing to read
 * back. Grading is one verdict; the summary is where the two halves separate
 * again.
 */
export function MelodySummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: MelodySummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <RoundSummary
      answers={answers}
      subjectKey={({ question }) =>
        names.scaleName(tonicKey(question.tonic), question.mode)
      }
      subjectName={({ question }) =>
        t('melody.summary.subject', {
          key: names.scaleName(tonicKey(question.tonic), question.mode),
          meter: names.meter(question.phrase.meter),
          division: names.division(
            division(question) as Parameters<typeof names.division>[0],
          ),
        })
      }
      answerName={({ chosen, question }) => {
        const rhythm = samePhrase(chosen.phrase, question.phrase)
        const notes = sameSounds(chosen.pitches, question.pitches)
        if (rhythm) return t('melody.summary.notesWrong')
        if (notes) return t('melody.summary.rhythmWrong')
        return t('melody.summary.bothWrong')
      }}
      chipTitle={({ question }) =>
        `${names.scaleName(tonicKey(question.tonic), question.mode)} ${names.meter(question.phrase.meter)}`
      }
      allCorrect={t('summary.allCorrect.melody')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
