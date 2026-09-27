import { stepRange, type Degree } from '@/lib/music/degree'
import type { ClefId } from '@/lib/music/clef'
import type { HarmonicEvent } from '@/lib/music/harmony'
import type { Key } from '@/lib/music/key'
import type { Pitch } from '@/lib/music/pitch'
import type { VoiceId } from '@/lib/music/satbVoicing'

import { bassDegrees, bassLength, bassTonic, type HarmonyQuestion } from './generate'

/**
 * One voice of a progression, written down as scale degrees.
 *
 * Everything a line dictation needs to know about the voice it asks for, so
 * the round screen, the grading and the summary are written once: which clef
 * the keys are drawn in, the tonic the degrees count from, which steps the
 * keyboard offers, what the right answer is, and which note of the answer each
 * chord of the setting shows.
 */
export interface LineDef {
  voice: VoiceId
  clef: ClefId
  /** The tonic the degrees are counted from, with the octave the keys draw in. */
  tonic: (key: Key) => Pitch
  /** One key each, low to high. */
  steps: (key: Key) => readonly Degree[]
  /** The line as the answer gives it, one degree per note the voice sings. */
  answer: (question: HarmonyQuestion) => readonly Degree[] | undefined
  /** How many notes the player writes. */
  length: (question: HarmonyQuestion) => number
  /** Which note of the answer each event of the setting shows. */
  slots: (events: readonly HarmonicEvent[]) => readonly number[]
}

/**
 * Which bass note each event belongs to — a held one shares the one before it.
 *
 * The bass is written one degree per *bass note*, not per sonority, so a
 * suspension's two chords both read from the same slot of the draft.
 */
export function bassSlots(events: readonly HarmonicEvent[]): readonly number[] {
  return events.map(
    (_, index) =>
      events.slice(0, index + 1).filter((event) => event.held !== true).length - 1,
  )
}

/** The seven degrees, in the tonic's own octave. */
const SEVEN = stepRange({ number: 1, alteration: 0 }, { number: 7, alteration: 0 })

/**
 * **The bass is answered without an octave**: which octave it sits in is a fact
 * about the voicing the search settled on, not about the harmony.
 */
export const BASS_LINE: LineDef = {
  voice: 'bass',
  clef: 'bass',
  tonic: bassTonic,
  steps: () => SEVEN,
  answer: (question) => bassDegrees(question.progression),
  length: (question) => bassLength(question.progression),
  slots: bassSlots,
}
