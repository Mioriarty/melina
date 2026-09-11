import type { RoundRules } from '@/exercises/shared/useRound'
import { thoroughbassAttempt } from '@/exercises/thoroughbass-shared/attempt'
import {
  generateRound,
  type ThoroughbassQuestion,
  type ThoroughbassRoundSpec,
} from '@/exercises/thoroughbass-shared/generate'
import { sameNotes } from '@/lib/music/figuredBass'
import { tonicKey, type PitchClass } from '@/lib/music/scale'

/** The notes placed above each bass note. Octave and order are the player's. */
export type RealizingAnswer = readonly (readonly PitchClass[])[]

export function realizingAnswerKey(answer: RealizingAnswer): string {
  return answer.map((chord) => chord.map(tonicKey).join('+')).join(',')
}

/**
 * What the round machinery needs to know about realising a figure.
 *
 * **Correct is the set of notes above the bass, and nothing more.** A figure
 * says which notes, never where they sit, so an answer an octave up or entered
 * in another order is the same answer — grading it any other way would fail a
 * player for something the figure never asked. That is the same rule scale
 * degrees already follow in grading by sound rather than by spelling; here it
 * is voicing rather than spelling, and the reasoning is identical.
 *
 * Spelling still counts, and has to: `♯5` over C is G♯ and `♭6` is A♭, one
 * sound under two written notes, and which one the figure asked for is exactly
 * what is being read.
 */
export const REALIZING_RULES: RoundRules<
  ThoroughbassRoundSpec,
  ThoroughbassQuestion,
  RealizingAnswer
> = {
  generate: generateRound,
  isCorrect: (chosen, question) =>
    chosen.length === question.events.length &&
    chosen.every((chord, index) => {
      const wanted = question.events[index]?.notes[0]
      return wanted !== undefined && sameNotes(chord, wanted)
    }),
  attempt: thoroughbassAttempt,
  answerKey: realizingAnswerKey,
}
