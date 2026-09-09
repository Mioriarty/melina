import type { DegreeAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import {
  degreePitch,
  degreesKey,
  keySignatureFor,
  parseDegreesKey,
} from '@/lib/music/degree'
import { parsePitch, pitchKey, type Pitch } from '@/lib/music/pitch'
import { isModeId } from '@/lib/music/scale'

import type { DegreeQuestion, DegreeRoundSpec } from './generate'

/**
 * A degree question, to and from the attempt log.
 *
 * A key and a melody of degrees. The notes are spelled again on the way out and
 * the key signature worked out again, so the row can never disagree with the
 * notation it produces.
 */

export function degreeAttempt(question: DegreeQuestion): DegreeAttempt {
  return {
    kind: 'degree',
    tonic: pitchKey(question.tonic),
    mode: question.mode,
    clef: question.clef,
    degrees: degreesKey(question.degrees),
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be read — one hand-edited, or naming a
 * mode or a key this version no longer spells.
 */
export function degreeQuestion(attempt: DegreeAttempt): DegreeQuestion | undefined {
  const tonic = parsePitch(attempt.tonic)
  const degrees = parseDegreesKey(attempt.degrees)
  if (tonic === undefined || degrees === undefined || !isModeId(attempt.mode)) {
    return undefined
  }

  const keySignature = keySignatureFor(tonic, attempt.mode)
  if (keySignature === undefined) return undefined

  const pitches = degrees.map((degree) => degreePitch(tonic, attempt.mode, degree))
  if (!pitches.every((pitch): pitch is Pitch => pitch !== undefined)) return undefined

  return {
    tonic,
    mode: attempt.mode,
    clef: attempt.clef,
    keySignature,
    degrees,
    pitches,
  }
}

/**
 * Which past answers a set of degree settings could have asked for.
 *
 * `root` rather than `tonic`, because a level chooses a tonic without an
 * octave — which octave it lands in is the clef's decision, not the level's.
 * The degrees offered are not a filter: they shape which melodies come up
 * rather than bounding them, so a level cannot claim the ones it did not draw.
 */
export function degreeFilter(spec: DegreeRoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'degree',
    clef: spec.clefs,
    mode: spec.modes,
    root: spec.tonics,
    length: String(spec.melodyLength),
  }
}
