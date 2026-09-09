import { useTranslation } from 'react-i18next'

import { RoundSummary } from '@/exercises/shared/RoundSummary'
import type { Answered } from '@/exercises/shared/round'
import { useMusicNames } from '@/hooks/useMusicNames'
import { degreePitch, degreesKey, type Degree } from '@/lib/music/degree'
import { chromaticValue } from '@/lib/music/pitch'
import { tonicKey } from '@/lib/music/scale'

import type { DegreeQuestion } from './generate'

export interface DegreeSummaryProps {
  answers: readonly Answered<DegreeQuestion, readonly Degree[]>[]
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * The degree an answer first parted company with the question.
 *
 * A melody has no name to group misses by the way an interval or a mode does,
 * and grouping by the whole melody would list every one separately and say
 * nothing. Where the answer first went wrong is the useful thing — that is the
 * note that was not heard, and everything after it may just be the player
 * having lost their place.
 */
function firstMiss({
  question,
  chosen,
}: Answered<DegreeQuestion, readonly Degree[]>): Degree {
  // By sound, like the grading: a note named ♭2 where the question printed ♯1
  // was heard correctly, and calling it the place the answer went wrong would
  // send the player off to practise a degree they already have.
  const sounding = (degree: Degree | undefined): number | undefined => {
    if (degree === undefined) return undefined
    const pitch = degreePitch(question.tonic, question.mode, degree)
    return pitch === undefined ? undefined : chromaticValue(pitch)
  }

  const parted = question.degrees.findIndex(
    (degree, index) => sounding(degree) !== sounding(chosen[index]),
  )
  return (parted === -1 ? question.degrees[0] : question.degrees[parted]) as Degree
}

/**
 * The shared summary, grouped by the degree that went wrong.
 *
 * "You keep missing the sixth" is a practice instruction, and it is the finding
 * the attempt log cannot make on its own — a row holds a whole melody, so this
 * screen, which still has every answer in hand, is where it gets made.
 */
export function DegreeSummary({
  answers,
  onPlayAgain,
  onChangeSettings,
}: DegreeSummaryProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <RoundSummary
      answers={answers}
      subjectKey={(answer) => names.degreeShort(firstMiss(answer))}
      subjectName={(answer) => names.degree(firstMiss(answer))}
      answerName={(chosen) => degreesKey(chosen)}
      chipTitle={({ question }) =>
        t('degrees.summary.questionLabel', {
          key: names.scaleName(tonicKey(question.tonic), question.mode),
          degrees: degreesKey(question.degrees),
        })
      }
      allCorrect={t('summary.allCorrect.degrees')}
      onPlayAgain={onPlayAgain}
      onChangeSettings={onChangeSettings}
    />
  )
}
