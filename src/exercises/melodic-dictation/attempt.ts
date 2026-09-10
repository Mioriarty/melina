import type { MelodyAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import {
  degreePitch,
  degreesKey,
  keySignatureFor,
  parseDegreesKey,
} from '@/lib/music/degree'
import { isMeterKey, meterKey, parseMeter } from '@/lib/music/meter'
import { parsePitch, pitchKey, type Pitch } from '@/lib/music/pitch'
import { parsePhrase, phraseKey } from '@/lib/music/phrase'
import { isModeId } from '@/lib/music/scale'

import { BARS_PER_SYSTEM, type MelodyQuestion, type MelodyRoundSpec } from './generate'

/**
 * A melodic dictation question, to and from the attempt log.
 *
 * A key, when the impacts fall, and the melody as **degrees**. The notes are
 * spelled again on the way out and the key signature worked out again, so the
 * row can never disagree with the notation it produces — the same rule scale
 * degrees follows, for the same reason.
 *
 * Degrees rather than pitches, even though pitches are what the player typed
 * and what was graded: a melody in a key *is* a run of degrees, and storing the
 * notes instead would keep a spelling that the question would then have to
 * decide again anyway. How the bar is written down is likewise not stored, and
 * is worked out again by `notateRhythm`.
 */

export function melodyAttempt(question: MelodyQuestion): MelodyAttempt {
  return {
    kind: 'melody',
    tonic: pitchKey(question.tonic),
    mode: question.mode,
    clef: question.clef,
    meter: meterKey(question.phrase.meter),
    onsets: phraseKey(question.phrase),
    degrees: degreesKey(question.degrees),
    tempo: question.tempo,
  }
}

/**
 * The question a row records, ready to be asked again.
 *
 * `undefined` only for a row that cannot be read — one hand-edited, or naming
 * a mode, metre or key this version no longer spells.
 *
 * The click it went by is deliberately not stored and so not restored: like
 * the tempo it is a property of the *level*, and unlike the tempo it changes
 * nothing about which answer is right.
 */
export function melodyQuestion(attempt: MelodyAttempt): MelodyQuestion | undefined {
  const tonic = parsePitch(attempt.tonic)
  const degrees = parseDegreesKey(attempt.degrees)
  const meter = isMeterKey(attempt.meter) ? parseMeter(attempt.meter) : undefined

  if (
    tonic === undefined ||
    degrees === undefined ||
    meter === undefined ||
    !isModeId(attempt.mode)
  ) {
    return undefined
  }

  const phrase = parsePhrase(attempt.onsets, meter)
  const keySignature = keySignatureFor(tonic, attempt.mode)
  if (phrase === undefined || keySignature === undefined) return undefined

  const pitches = degrees.map((degree) => degreePitch(tonic, attempt.mode, degree))
  if (!pitches.every((pitch): pitch is Pitch => pitch !== undefined)) return undefined

  // One note per impact, or the row is describing two different melodies.
  if (pitches.length !== phrase.bars.flat().length) return undefined

  return {
    tonic,
    mode: attempt.mode,
    clef: attempt.clef,
    keySignature,
    phrase,
    degrees,
    pitches,
    tempo: attempt.tempo,
    metronome: 'count-in',
    barsPerSystem: BARS_PER_SYSTEM,
  }
}

/**
 * Which past answers a set of melodic settings could have asked for.
 *
 * The dimensions a level actually **pins**, and no others. Its tonics, modes,
 * clefs, metres, tempo and bar count all bound what it can produce; its cell
 * weights and its step range do not — weights shape which bars come up rather
 * than bounding them, and a range says which notes were *available*, not which
 * were drawn. A level cannot claim the questions it happened not to ask.
 *
 * `root` rather than `tonic`, because a level chooses a tonic without an
 * octave — which octave it lands in is the clef's decision, not the level's —
 * and because it is the dimension an interval's lower note and a scale's tonic
 * already share, which is what lets one query span the whole app.
 */
export function melodyFilter(spec: MelodyRoundSpec, exerciseId?: string): AttemptFilter {
  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'melody',
    clef: spec.clefs,
    mode: spec.modes,
    root: spec.tonics,
    meter: spec.meters,
    tempo: String(spec.tempo),
    bars: String(spec.bars),
  }
}
