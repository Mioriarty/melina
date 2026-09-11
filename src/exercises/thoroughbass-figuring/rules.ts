import type { RoundRules } from '@/exercises/shared/useRound'
import { thoroughbassAttempt } from '@/exercises/thoroughbass-shared/attempt'
import {
  acceptsFigure,
  generateRound,
  type ThoroughbassQuestion,
  type ThoroughbassRoundSpec,
} from '@/exercises/thoroughbass-shared/generate'
import { figureKey, type Figure } from '@/lib/music/figuredBass'

/** One list of figures per bass note — a suspension is two under one note. */
export type FiguringAnswer = readonly (readonly Figure[])[]

export function figuringAnswerKey(answer: FiguringAnswer): string {
  return answer.map((figures) => figures.map(figureKey).join('-')).join(',')
}

/**
 * What the round machinery needs to know about figuring a bass.
 *
 * **Grading is canonical, not merely correct.** A figure that resolves to the
 * right notes is not enough: writing `6/3` under a plain first inversion is
 * exactly what "a wholesome rule forbids … any Figure not absolutely necessary
 * for the expression of the Composer's intention" is about, and learning the
 * omissions is most of learning to figure at all.
 *
 * `acceptsFigure` is where that lives, and it accepts a *set* rather than one
 * string, because two forms are genuinely current for the third inversion. It
 * also knows that the full form becomes legitimate for a figure following
 * another on the same bass note — which is a fact about the question rather
 * than a setting anyone has to choose.
 */
export const FIGURING_RULES: RoundRules<
  ThoroughbassRoundSpec,
  ThoroughbassQuestion,
  FiguringAnswer
> = {
  generate: generateRound,
  isCorrect: (chosen, question) =>
    chosen.length === question.events.length &&
    chosen.every((figures, index) => {
      const event = question.events[index]
      return (
        event !== undefined &&
        figures.length === event.figures.length &&
        figures.every((figure, position) =>
          acceptsFigure(question, index, position, figure),
        )
      )
    }),
  attempt: thoroughbassAttempt,
  answerKey: figuringAnswerKey,
}
