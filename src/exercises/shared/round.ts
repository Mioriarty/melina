import type { Interval } from '@/lib/music/interval'

import type { IntervalQuestion } from './generate'

export interface Answered {
  question: IntervalQuestion
  chosen: Interval
  correct: boolean
  /** Time from the question appearing to the answer, in milliseconds. */
  ms: number
}

export type Phase =
  /** Choosing a level — the landing screen. */
  | { name: 'levels' }
  /** The full settings screen, reached from Custom. */
  | { name: 'setup' }
  /** Mid-round, waiting for an answer. */
  | { name: 'asking'; index: number }
  /** Answered; the keyboard shows the result. */
  | { name: 'revealed'; index: number; answer: Answered }
  | { name: 'summary' }

/** How long a correct answer stays on screen before the next question. */
export const CORRECT_DELAY_MS = 750
