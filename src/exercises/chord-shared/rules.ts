import type { RoundRules } from '@/exercises/shared/useRound'
import type { ChordQuality } from '@/lib/music/chord'
import { tonicKey } from '@/lib/music/scale'

import { chordAttempt } from './attempt'
import { generateRound, type ChordQuestion, type ChordRoundSpec } from './generate'

/**
 * What the player names.
 *
 * Every axis is `undefined` where the question did not ask for it, rather than
 * absent: the keyboard fills exactly the rows `question.asks` names, and a row
 * that is not on the screen has no answer to give. Reading names the root;
 * hearing cannot, because a chord in isolation has no audible absolute root.
 */
export interface ChordAnswer {
  /** A tonic key — `Eb` — or `undefined` where the root was not asked. */
  root: string | undefined
  quality: ChordQuality
  inversion: number | undefined
  /** The Lage: which member stands on top. */
  top: number | undefined
}

export function chordAnswerKey(answer: ChordAnswer): string {
  return `${answer.root ?? ''}:${answer.quality}:${answer.inversion ?? ''}:${answer.top ?? ''}`
}

/**
 * Whether a named chord is the chord that was asked.
 *
 * **Only what was asked is graded.** A row the keyboard never showed is a
 * question that was never put, and marking a player wrong for it would be
 * marking them wrong for something there was no way to answer — which is the
 * same principle scale degrees follows in grading by sound rather than by
 * spelling. `question.asks` is the single place that says which rows those
 * are, so the keyboard and the verdict cannot disagree.
 */
export function isChordCorrect(chosen: ChordAnswer, question: ChordQuestion): boolean {
  const { chord, asks } = question
  if (chosen.quality !== chord.quality) return false
  if (asks.root && chosen.root !== tonicKey(chord.root)) return false
  if (asks.inversion && chosen.inversion !== chord.inversion) return false
  if (asks.lage && chosen.top !== chord.top) return false
  return true
}

export const CHORD_RULES: RoundRules<ChordRoundSpec, ChordQuestion, ChordAnswer> = {
  generate: generateRound,
  isCorrect: isChordCorrect,
  attempt: chordAttempt,
  answerKey: chordAnswerKey,
}
