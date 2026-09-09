import { getClef, type ClefId } from '@/lib/music/clef'
import type { PlayDirection } from '@/lib/music/direction'
import { parseIntervalKey, transpose } from '@/lib/music/interval'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { chromaticValue, parsePitch, pitchKey, type Pitch } from '@/lib/music/pitch'
import { isMeterKey, parseMeter } from '@/lib/music/meter'
import { isOffBeat, parseOnsets, rhythmDivision } from '@/lib/music/rhythm'
import { isModeId, scalePitches, tonicKey, type ModeId } from '@/lib/music/scale'

/**
 * A question, in the smallest form it can be rebuilt from.
 *
 * The rule is *exactly* enough to ask it again and no more. An interval is a
 * root and an interval key — the upper note follows from `transpose`, so
 * storing it would be a second copy of the same fact that could disagree with
 * the first. A scale is a tonic and a mode, never its eight pitches.
 *
 * Nothing about the *level* is stored. `staffOnly` narrowed the generator's
 * range; whether the notes it produced need ledger lines is a property of
 * those notes and is worked out again at query time by `attemptFacets`.
 *
 * These types live beside the schema rather than in the exercises because the
 * database is what has to keep reading them years from now: a row written by
 * a version of the app that no longer exists must still be legible. The
 * exercises own the conversion in either direction — see
 * `interval-shared/attempt.ts` and `scale-shared/attempt.ts`.
 */

export type AttemptKind = 'interval' | 'scale' | 'rhythm'

export interface IntervalAttempt {
  kind: 'interval'
  /** The lower note, as a `pitchKey`: `F#3`. The upper one follows. */
  lower: string
  /** Interval key, e.g. `A4`. Also the answer the question wanted. */
  interval: string
  clef: ClefId
  keySignature: KeySignatureId
  direction: PlayDirection
}

export interface ScaleAttempt {
  kind: 'scale'
  /** The tonic *with* its octave, as a `pitchKey`: `Bb3`. */
  tonic: string
  /** Also the answer the question wanted. */
  mode: ModeId
  clef: ClefId
  /**
   * A scale has no harmonic option — eight notes at once is a cluster — so
   * this is narrower than `PlayDirection`.
   */
  direction: Exclude<PlayDirection, 'harmonic'>
}

/**
 * A rhythm question, which is a bar of impacts and the speed it went by at.
 *
 * The impacts and nothing else, because a rhythm *is* its impacts — a snare
 * hit has no length to remember. How it was spelled on the page is worked out
 * again by `notateRhythm`, and how hard it was — how finely divided, whether
 * anything fell off the beat — is worked out again by `attemptFacets`.
 */
export interface RhythmAttempt {
  kind: 'rhythm'
  /** Meter key, e.g. `4/4`. */
  meter: string
  /** Tick offsets from the barline: `0,60,90,120`. Also the answer. */
  onsets: string
  /** Beats per minute it was played at. */
  tempo: number
}

export type AttemptQuestion = IntervalAttempt | ScaleAttempt | RhythmAttempt

/** The answer the question was asking for. Derived, never stored twice. */
export function correctAnswer(question: AttemptQuestion): string {
  switch (question.kind) {
    case 'interval':
      return question.interval
    case 'scale':
      return question.mode
    case 'rhythm':
      return question.onsets
  }
}

export type FacetValue = string | boolean

/**
 * The dimensions a stored question can be filtered on.
 *
 * Flat and untyped by design: `progress.ts` matches a filter against these
 * without knowing what an interval or a mode is, which is what lets one
 * accuracy query serve every exercise. Facets are *derived* on read — the
 * upper note of an interval and whether a question needs ledger lines are
 * both computed here, so neither has to be trusted in the row.
 */
export type Facets = Readonly<Record<string, FacetValue>>

function onStaff(clefId: ClefId, pitches: readonly Pitch[]): boolean {
  const clef = getClef(clefId)
  const lowest = chromaticValue(clef.staffLowest)
  const highest = chromaticValue(clef.staffHighest)
  return pitches.every((value) => {
    const sounding = chromaticValue(value)
    return sounding >= lowest && sounding <= highest
  })
}

function intervalFacets(question: IntervalAttempt): Facets {
  const base: Facets = {
    kind: 'interval',
    interval: question.interval,
    clef: question.clef,
    keySignature: question.keySignature,
    direction: question.direction,
    lower: question.lower,
  }

  const lower = parsePitch(question.lower)
  const interval = parseIntervalKey(question.interval)
  // A row can only fail to spell if it was hand-edited or written by a
  // version that spelled differently. It then matches no filter that asks
  // about the notes, rather than throwing inside a statistics query.
  if (lower === undefined || interval === undefined) return base

  const upper = transpose(lower, interval, 'up')
  if (upper === undefined) return { ...base, root: tonicKey(lower) }

  return {
    ...base,
    root: tonicKey(lower),
    upper: pitchKey(upper),
    staffOnly: onStaff(question.clef, [lower, upper]),
  }
}

function scaleFacets(question: ScaleAttempt): Facets {
  const tonic = parsePitch(question.tonic)
  // `isModeId` before `scalePitches`, which throws on a mode it does not
  // know: a row naming a mode that has since been renamed must cost that row
  // its derived facets, not the whole query.
  const pitches =
    tonic === undefined || !isModeId(question.mode)
      ? undefined
      : scalePitches(tonic, question.mode)

  return {
    kind: 'scale',
    mode: question.mode,
    clef: question.clef,
    direction: question.direction,
    tonic: question.tonic,
    ...(tonic === undefined ? {} : { root: tonicKey(tonic) }),
    ...(pitches === undefined ? {} : { staffOnly: onStaff(question.clef, pitches) }),
  }
}

/**
 * A rhythm's dimensions.
 *
 * Deliberately no `root`: a rhythm is built on no note at all, so it drops out
 * of every filter that asks about pitch — which is the documented behaviour of
 * a filter naming a dimension an attempt does not have, and exactly right here.
 */
function rhythmFacets(question: RhythmAttempt): Facets {
  const base: Facets = {
    kind: 'rhythm',
    meter: question.meter,
    tempo: String(question.tempo),
  }

  const onsets = parseOnsets(question.onsets)
  const meter = isMeterKey(question.meter) ? parseMeter(question.meter) : undefined
  // A row can only fail to read if it was hand-edited or written by a version
  // that stored something else. It then matches no filter that asks about the
  // rhythm, rather than throwing inside a statistics query.
  if (onsets === undefined || meter === undefined) return base

  const rhythm = { meter, onsets }
  return {
    ...base,
    division: rhythmDivision(rhythm),
    offBeat: isOffBeat(rhythm),
    impacts: String(onsets.length),
  }
}

export function attemptFacets(question: AttemptQuestion): Facets {
  switch (question.kind) {
    case 'interval':
      return intervalFacets(question)
    case 'scale':
      return scaleFacets(question)
    case 'rhythm':
      return rhythmFacets(question)
  }
}
