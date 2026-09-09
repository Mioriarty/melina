import type { RoundRules } from '@/exercises/shared/useRound'
import { onsetsKey, sameRhythm, type Rhythm } from '@/lib/music/rhythm'

import { rhythmAttempt } from './attempt'
import { generateRound, type RhythmQuestion, type RhythmRoundSpec } from './generate'

/**
 * What the generic round machinery needs to know about rhythms.
 *
 * `isCorrect` is the whole grading rule, and it is one line because the model
 * carries it: a rhythm is its impacts, so two answers that put the impacts in
 * the same places *are* the same answer however they were written down. Note
 * values and rests never enter into it, because nothing about them can be
 * heard on a drum.
 */
export const RHYTHM_RULES: RoundRules<RhythmRoundSpec, RhythmQuestion, Rhythm> = {
  generate: generateRound,
  isCorrect: (chosen, question) => sameRhythm(chosen, question.rhythm),
  attempt: rhythmAttempt,
  answerKey: (chosen) => onsetsKey(chosen.onsets),
}
