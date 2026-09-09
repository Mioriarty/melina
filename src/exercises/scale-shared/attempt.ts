import type { ScaleAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import { parsePitch, pitchKey } from '@/lib/music/pitch'
import { isModeId, scalePitches } from '@/lib/music/scale'

import type { ScaleQuestion, ScaleRoundSpec } from './generate'

/**
 * A scale question, to and from the attempt log.
 *
 * A tonic and a mode, never the eight pitches: `scalePitches` spells them
 * again, and it is the only thing that should ever spell them. The tonic
 * keeps its octave, because C dorian in the treble clef and C dorian an
 * octave below are not the same question on the page.
 */

export function scaleAttempt(question: ScaleQuestion): ScaleAttempt {
  return {
    kind: 'scale',
    tonic: pitchKey(question.tonic),
    mode: question.mode,
    clef: question.clef,
    direction: question.direction,
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be spelled — one hand-edited, or
 * naming a mode that no longer exists.
 */
export function scaleQuestion(attempt: ScaleAttempt): ScaleQuestion | undefined {
  const tonic = parsePitch(attempt.tonic)
  if (tonic === undefined || !isModeId(attempt.mode)) return undefined

  const pitches = scalePitches(tonic, attempt.mode)
  if (pitches === undefined) return undefined

  return {
    mode: attempt.mode,
    tonic,
    pitches,
    clef: attempt.clef,
    direction: attempt.direction,
  }
}

/**
 * Which past answers a set of scale settings could have asked for.
 *
 * `root` rather than `tonic`, because the settings choose a tonic without an
 * octave — which octave a scale lands in is the clef's decision, not the
 * level's, so a level that offers B♭ means every B♭ the clef could hold.
 */
export function scaleFilter(spec: ScaleRoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'scale',
    clef: spec.clefs,
    mode: spec.modes,
    root: spec.tonics,
    direction: spec.directions,
  }
}
