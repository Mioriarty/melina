import type { StruckNote } from '@/lib/audio/engine'

import type { ChordQuestion } from './generate'

/**
 * When the notes of a chord sound.
 *
 * Pure arithmetic over the question, kept out of `engine.ts` so it can be
 * checked without a network or an AudioContext — the same split `playRhythm`
 * makes with `rhythmSchedule` and thoroughbass with its own `chordSchedule`.
 * Playback is otherwise the one part of a hearing exercise nothing could test,
 * and here it is not a small part: whether the notes arrive together or one at
 * a time is the difficulty axis the levels are built on.
 */

/** Seconds between one note of an arpeggio and the next. */
const ARPEGGIO_GAP = 0.42

/** How long the last note rings after everything is in. */
const TAIL = 1.7

/** A block chord rings longer, because there is nothing before it. */
const BLOCK_RING = 2.3

/**
 * Every note the question sounds, and when.
 *
 * Two rules, and the second is what makes an arpeggio worth offering at all:
 *
 * - **A block chord strikes everything at once**, which is what an examiner
 *   plays and what the hardest levels ask for.
 * - **An arpeggio accumulates.** Every note rings until the last one has
 *   arrived, so what is left standing at the end is the chord itself. Damping
 *   each note as the next one came would make it a melody of the chord's
 *   members rather than an easier way to hear the chord, which is the whole
 *   reason the option exists.
 *
 * `ascending` runs from the bass up and `descending` from the top down, which
 * is what those names already mean for an interval.
 */
export function chordSchedule(question: ChordQuestion): readonly StruckNote[] {
  const { pitches, direction } = question

  if (direction === 'harmonic') {
    return pitches.map((pitch) => ({ pitch, at: 0, duration: BLOCK_RING }))
  }

  const order = direction === 'descending' ? [...pitches].reverse() : [...pitches]

  return order.map((pitch, index) => ({
    pitch,
    at: index * ARPEGGIO_GAP,
    duration: (order.length - 1 - index) * ARPEGGIO_GAP + TAIL,
  }))
}
