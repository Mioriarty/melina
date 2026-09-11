import type { ChordAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import {
  chordPitches,
  closePosition,
  isChordQuality,
  type Chord,
} from '@/lib/music/chord'
import { parseTonicKey, tonicKey } from '@/lib/music/scale'

import { asksFor, type ChordQuestion, type ChordRoundSpec } from './generate'

/**
 * A chord question, to and from the attempt log.
 *
 * What is written down is the root, the quality and where the members stand,
 * because those four *are* the question: the notes, their places on the staff
 * and the answer that would have been right are all `chord.ts` applied to
 * them, and storing any of it would be a second copy that could disagree.
 *
 * Nothing about the level is recorded. Whether the Lage was asked shaped the
 * question; whether this chord ended up stacked straight up from its bass is a
 * fact about the chord, and `attemptFacets` works it out again.
 */
export function chordAttempt(question: ChordQuestion): ChordAttempt {
  return {
    kind: 'chord',
    root: tonicKey(question.chord.root),
    quality: question.chord.quality,
    inversion: question.chord.inversion,
    top: question.chord.top,
    clef: question.clef,
    direction: question.direction,
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be spelled — hand-edited, or written
 * by a version that spelled differently. Callers show what they can rather than
 * failing a whole screen over one row.
 *
 * The `asks` are rebuilt from the spec rather than read back, because they were
 * never stored: a row says what the chord was, and what a *round* chose to ask
 * about it is a property of the round.
 */
export function chordQuestion(
  attempt: ChordAttempt,
  spec: ChordRoundSpec,
): ChordQuestion | undefined {
  const root = parseTonicKey(attempt.root)
  if (root === undefined || !isChordQuality(attempt.quality)) return undefined

  const chord: Chord = {
    root,
    quality: attempt.quality,
    inversion: attempt.inversion,
    top: attempt.top,
  }
  const pitches = chordPitches(chord, attempt.clef)
  if (pitches === undefined) return undefined

  return {
    chord,
    clef: attempt.clef,
    direction: attempt.direction,
    pitches,
    asks: asksFor(spec, chord),
  }
}

/**
 * Which past answers a set of chord settings could have asked for.
 *
 * A level's settings *are* a filter — each list is the set of values that
 * dimension was allowed to take — which is why measuring a level needs no
 * machinery of its own. `questionsPerRound` says how many questions a round
 * holds rather than which ones, so it plays no part.
 *
 * `lage` is the one that needs thought, and it narrows the same way `staffOnly`
 * does: a level with the Lage switched **off** could only ever have produced
 * chords stacked straight up from the bass, so it counts only those. A level
 * with it on is unconstrained and counts both, because it can still draw the
 * close-position one.
 */
export function chordFilter(spec: ChordRoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'chord',
    quality: [...spec.qualities],
    inversion: spec.inversions.map(String),
    root: [...spec.roots],
    clef: [...spec.clefs],
    direction: [...spec.directions],
    ...(spec.lage ? {} : { close: true }),
  }
}

/** Whether a chord stands straight up from its bass — the default Lage. */
export function isClosePosition(chord: Chord): boolean {
  return chord.top === closePosition(chord.quality, chord.inversion)
}
