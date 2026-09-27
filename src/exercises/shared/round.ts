/**
 * The shape of a round, whatever it is asking about.
 *
 * Deliberately generic in both the question and the answer: an interval
 * round asks about a pair of pitches and is answered with an interval, a
 * scale round asks about a run of them and is answered with a mode, and the
 * machinery around them — progress, reveal, summary — is identical. Keeping
 * one copy of it is what stopped the second exercise pair from being the
 * first one retyped.
 */

export interface Answered<TQuestion, TAnswer> {
  question: TQuestion
  chosen: TAnswer
  correct: boolean
  /** Time from the question appearing to the answer, in milliseconds. */
  ms: number
}

export type Phase<TQuestion, TAnswer> =
  /** Choosing a level — the landing screen. */
  | { name: 'levels' }
  /** The full settings screen, reached from Custom. */
  | { name: 'setup' }
  /** Mid-round, waiting for an answer. */
  | { name: 'asking'; index: number }
  /** Answered; the keyboard shows the result. */
  | { name: 'revealed'; index: number; answer: Answered<TQuestion, TAnswer> }
  | { name: 'summary' }

/**
 * The summary's way back to choosing what to practise.
 *
 * One value rather than a callback and a flag, so the button's label and
 * where it goes cannot disagree: a round a level started says "Change
 * difficulty" and returns to the levels, one started from Custom says "Change
 * settings" and returns to the Custom screen.
 */
export interface ChangeSettings {
  /** Whether the round was started from the Custom screen. */
  custom: boolean
  onPress: () => void
}

/** Mid-round phases, which are the ones a round screen ever sees. */
export type ActivePhase<TQuestion, TAnswer> = Extract<
  Phase<TQuestion, TAnswer>,
  { name: 'asking' | 'revealed' }
>
