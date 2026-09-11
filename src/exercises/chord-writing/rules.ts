import { chordAttempt } from '@/exercises/chord-shared/attempt'
import {
  generateRound,
  type ChordQuestion,
  type ChordRoundSpec,
} from '@/exercises/chord-shared/generate'
import type { RoundRules } from '@/exercises/shared/useRound'
import { chordNotes } from '@/lib/music/chord'
import { sameNotes, tonicKey, type PitchClass } from '@/lib/music/scale'

/**
 * The notes written onto the staff, **from the bass up**.
 *
 * A sequence rather than a set, unlike realising a figured bass, and the
 * difference is what the question asked. A figure says which notes and never
 * where they sit, so any order is the same answer; a chord named with an
 * inversion has said which member goes at the bottom, and one named with a
 * Lage has said which goes on top.
 */
export type WritingAnswer = readonly PitchClass[]

export function writingAnswerKey(answer: WritingAnswer): string {
  return answer.map(tonicKey).join('+')
}

/**
 * Whether the chord written down is the chord that was named.
 *
 * Three things, and the third only sometimes:
 *
 * - **The notes**, as a set. Which octave they landed in is the app's business
 *   rather than the player's — `voiceChord` decides that — so it cannot be
 *   part of the verdict.
 * - **The bass.** The prompt named an inversion, which is exactly a statement
 *   about which member is lowest, so writing the right notes over the wrong one
 *   is writing a different chord from the one asked for.
 * - **The top, only where a Lage was named.** Where it was not, the prompt
 *   never said what belongs on top, and failing someone for C–G–E′ when it
 *   asked for "root position" would be failing them for something that was
 *   never asked. The same principle as grading a melody by sound.
 */
export function isWritingCorrect(
  chosen: WritingAnswer,
  question: ChordQuestion,
): boolean {
  const { chord, asks } = question
  const notes = chordNotes(chord.root, chord.quality)
  if (notes === undefined || !sameNotes(chosen, notes)) return false

  const bass = notes[chord.inversion]
  const first = chosen[0]
  if (bass === undefined || first === undefined) return false
  if (tonicKey(first) !== tonicKey(bass)) return false

  if (!asks.lage) return true
  const top = notes[chord.top]
  const last = chosen[chosen.length - 1]
  return top !== undefined && last !== undefined && tonicKey(last) === tonicKey(top)
}

export const WRITING_RULES: RoundRules<ChordRoundSpec, ChordQuestion, WritingAnswer> = {
  generate: generateRound,
  isCorrect: isWritingCorrect,
  attempt: chordAttempt,
  answerKey: writingAnswerKey,
}
