import type { StruckNote } from '@/lib/audio/engine'

import type { ThoroughbassQuestion } from './generate'

/**
 * When everything in a thoroughbass question sounds.
 *
 * Pure arithmetic, kept out of `engine.ts` so it can be checked without a
 * network or an AudioContext — the same reason `rhythmSchedule.ts` exists.
 * Playback is otherwise the one part of this exercise nothing could test, and
 * it is not a small part: a question can carry several chords, and sounding
 * them all at once is a cluster rather than a reading.
 */

/** Seconds between one chord being struck and the next. */
const CHORD_GAP = 1.25

/**
 * How long a chord rings.
 *
 * A little past the next one's onset, so a succession sounds joined rather
 * than chopped — which is what a continuo player's hands do anyway.
 */
const CHORD_RING = 1.6

/** A chord standing on its own rings longer, because nothing follows it. */
const ALONE_RING = 2.4

/**
 * Every note a question sounds, and when. Times are measured from zero; the
 * lead-in that keeps the first note off the edge of the scheduler is the
 * engine's business.
 *
 * Two things it gets right that sounding the lot at once did not:
 *
 * - **Chords follow one another.** A bass line is a succession and a
 *   suspension is a held chord and its resolution; struck together they are
 *   neither, and what a player hears is a single unreadable pile.
 * - **A held bass is struck once.** The bass of a suspension does not move, so
 *   it sounds once and rings under both chords — which is the whole of what
 *   makes it a suspension, and re-striking it would say the opposite. A bass
 *   *line* strikes each of its notes, because there each one is new.
 */
export function chordSchedule(question: ThoroughbassQuestion): readonly StruckNote[] {
  const notes: StruckNote[] = []
  const total = question.events.reduce(
    (count, event) => count + Math.max(1, event.chords.length),
    0,
  )
  const ring = total === 1 ? ALONE_RING : CHORD_RING

  let slot = 0
  for (const event of question.events) {
    const parts = Math.max(1, event.chords.length)
    const startsAt = slot * CHORD_GAP

    // The bass, once, ringing until the last of its own chords has gone.
    notes.push({
      pitch: event.bass,
      at: startsAt,
      duration: (parts - 1) * CHORD_GAP + ring,
    })

    for (const chord of event.chords) {
      for (const pitch of chord) {
        notes.push({ pitch, at: slot * CHORD_GAP, duration: ring })
      }
      slot += 1
    }
    // An event with no chords drawn yet still takes its place in time.
    if (event.chords.length === 0) slot += 1
  }

  return notes
}
