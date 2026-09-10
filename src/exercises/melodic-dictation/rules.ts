import type { RoundRules } from '@/exercises/shared/useRound'
import { samePhrase, phraseKey, type Phrase } from '@/lib/music/phrase'
import { pitchKey, sameSounds, type Pitch } from '@/lib/music/pitch'

import { melodyAttempt } from './attempt'
import { generateRound, type MelodyQuestion, type MelodyRoundSpec } from './generate'

/**
 * What the player wrote: when the notes fall, and which notes they are.
 *
 * Two lists rather than one of pairs, because they are graded separately and
 * the two halves of the exercise are exactly these. The pitches are in the
 * order they sound, one per impact, so the pairing is positional and nothing
 * has to carry it.
 */
export interface MelodyAnswer {
  phrase: Phrase
  pitches: readonly Pitch[]
}

/**
 * Whether an answer is right.
 *
 * **Two independent facts, and the whole of the grading.**
 *
 * - The impacts are in the right places, bar by bar — `samePhrase`, which is
 *   `sameRhythm` once per bar. Note values and rests never enter into it,
 *   because a held note and a note followed by a rest sound identical: every
 *   note rings until the next one begins, which is what makes that true rather
 *   than merely claimed.
 * - The notes are the right notes **by sound** — `sameSounds`. ♯4 and ♭5 are
 *   one note under two names, and no amount of listening separates them, so
 *   refusing the name the question did not happen to print would be marking a
 *   listener wrong for something there was nothing to hear.
 *
 * Nothing else is graded. Which is to say: everything the player had to decide
 * that could not be heard — the spelling of a rhythm, the spelling of a note —
 * is a decision that cannot cost them the answer.
 */
export const MELODY_RULES: RoundRules<MelodyRoundSpec, MelodyQuestion, MelodyAnswer> = {
  generate: generateRound,
  isCorrect: (chosen, question) =>
    samePhrase(chosen.phrase, question.phrase) &&
    sameSounds(chosen.pitches, question.pitches),
  attempt: melodyAttempt,
  answerKey: (chosen) => melodyAnswerKey(chosen),
}

/**
 * What the player answered, in one string.
 *
 * The impacts and the notes, separated by a space. Pitches rather than degrees
 * here, unlike the question: this records what was *typed*, and what was typed
 * was notes on a keyboard. A reading of it as degrees would need the key, which
 * the row beside it already has.
 */
export function melodyAnswerKey(answer: MelodyAnswer): string {
  return `${phraseKey(answer.phrase)} ${answer.pitches.map(pitchKey).join(',')}`
}
