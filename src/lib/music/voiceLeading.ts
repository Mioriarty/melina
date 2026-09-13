import { chordNotes, isSeventh, type Chord } from './chord'
import { eventChord, eventNotes, type HarmonicEvent } from './harmony'
import { intervalBetween } from './interval'
import { keyNotes, type Key } from './key'
import { chromaticValue, isAlteration, pitch, type Pitch } from './pitch'
import { tonicKey, type PitchClass } from './scale'

/**
 * The rules a four-part setting is held to.
 *
 * **This module is written once and read twice.** Run as a filter it is what
 * `satb.ts` generates through — an edge that breaks a rule is an edge that
 * does not exist, and a preference is a weight. Run as a detector over a
 * finished `Satz` it is a *grader*, returning a list of findings rather than a
 * verdict, which is the shape the four-part writing exercises need and the one
 * thing melina's round machinery has never had.
 *
 * Building it that way round is the whole reason the generator can be trusted:
 * `satb.test.ts` voices every level's progressions and insists the grader
 * finds **nothing**. A generator checked against its own grader is the same
 * move `modeOf` makes on the scale generator and `readChord` on the chord one.
 *
 * The rule list is not invented here. It is the standard
 * Stimmführung inventory — spacing, crossing, overlap, doubling, omission,
 * the four kinds of motion, leading-note and seventh resolution, dissonance
 * preparation — and each entry below says which one it is.
 */

export type VoiceId = 'soprano' | 'alto' | 'tenor' | 'bass'

/** Top down, which is the order a score is read in. */
export const VOICES: readonly VoiceId[] = ['soprano', 'alto', 'tenor', 'bass']

export type Voicing = Readonly<Record<VoiceId, Pitch>>

export interface VoiceRange {
  lowest: Pitch
  highest: Pitch
}

/**
 * Chorale ranges, which are **not** the staff ranges in `clef.ts`.
 *
 * Those are geometry — the staff plus two ledger lines — and they say nothing
 * about what a voice can sing. These are the ordinary compass of a four-part
 * chorus, deliberately conservative: a setting that stays inside them is
 * singable by amateurs, which is what the idiom is for.
 */
export const SATB_RANGES: Readonly<Record<VoiceId, VoiceRange>> = {
  soprano: { lowest: pitch('C', 0, 4), highest: pitch('G', 0, 5) },
  alto: { lowest: pitch('G', 0, 3), highest: pitch('D', 0, 5) },
  tenor: { lowest: pitch('C', 0, 3), highest: pitch('G', 0, 4) },
  bass: { lowest: pitch('E', 0, 2), highest: pitch('C', 0, 4) },
}

/** Widest gap allowed between neighbouring upper voices, in semitones. */
const UPPER_SPACING = 12
/** Tenor to bass may open further, which is the ordinary chorale texture. */
const LOWER_SPACING = 19
/** Beyond this a voice is leaping rather than moving. */
const COMFORTABLE_LEAP = 5
const WIDE_LEAP = 9

export type Motion = 'parallel' | 'similar' | 'contrary' | 'oblique' | 'none'

export type FindingId =
  | 'range'
  | 'spacing'
  | 'crossing'
  | 'overlap'
  | 'parallel-fifths'
  | 'parallel-octaves'
  | 'hidden-fifths'
  | 'hidden-octaves'
  | 'doubled-leading-note'
  | 'doubled-altered'
  | 'incomplete-chord'
  | 'wrong-note'
  | 'unresolved-leading-note'
  | 'unresolved-seventh'
  | 'unresolved-suspension'
  | 'augmented-second'
  | 'cross-relation'
  | 'large-leap'
  | 'static'

export interface Finding {
  id: FindingId
  severity: 'error' | 'warning'
  /** The event the fault is at; for a transition, the later of the two. */
  at: number
  voices: readonly VoiceId[]
}

const error = (id: FindingId, at: number, voices: readonly VoiceId[]): Finding => ({
  id,
  severity: 'error',
  at,
  voices,
})

const warning = (id: FindingId, at: number, voices: readonly VoiceId[]): Finding => ({
  id,
  severity: 'warning',
  at,
  voices,
})

/* ------------------------------------------------------------------ motion */

function step(from: Pitch, to: Pitch): number {
  return chromaticValue(to) - chromaticValue(from)
}

/** How a pair of voices moves between two chords. */
export function motionBetween(
  from: readonly [Pitch, Pitch],
  to: readonly [Pitch, Pitch],
): Motion {
  const upper = step(from[0], to[0])
  const lower = step(from[1], to[1])

  if (upper === 0 && lower === 0) return 'none'
  if (upper === 0 || lower === 0) return 'oblique'
  if (upper > 0 !== lower > 0) return 'contrary'
  return upper === lower ? 'parallel' : 'similar'
}

/** Reduced to within the octave, so a twelfth reads as a fifth. */
function reduced(lower: Pitch, upper: Pitch): number {
  return (((chromaticValue(upper) - chromaticValue(lower)) % 12) + 12) % 12
}

const PERFECT_FIFTH = 7
const PERFECT_OCTAVE = 0

/* ------------------------------------------------------- what a chord holds */

/**
 * Everything about one event the rules need, worked out once.
 *
 * `readChord` walks nine qualities against every rotation of a stack, which is
 * far too much to repeat inside a search that evaluates thousands of edges. So
 * the search builds one of these per event and the detectors read it.
 */
export interface EventContext {
  event: HarmonicEvent
  /** The distinct notes of the sonority, bass first. */
  notes: readonly PitchClass[]
  chord: Chord | undefined
  root: PitchClass | undefined
  fifth: PitchClass | undefined
  seventh: PitchClass | undefined
  /** The key's own leading note, when this chord contains it. */
  leadingNote: PitchClass | undefined
  /** Whether this chord is the one the key is named after. */
  isTonic: boolean
  /** Notes that do not belong to the key, which must never be doubled. */
  altered: readonly PitchClass[]
}

/** The note a semitone below the tonic — the key's leading note, raised in minor. */
export function leadingNoteOf(key: Key): PitchClass | undefined {
  const notes = keyNotes(key)
  const tonic = notes?.[0]
  const seventh = notes?.[6]
  if (tonic === undefined || seventh === undefined) return undefined

  const distance =
    (chromaticValue({ ...tonic, octave: 5 }) -
      chromaticValue({ ...seventh, octave: 4 }) +
      12) %
    12
  if (distance === 1) return seventh

  const raised = seventh.alteration + 1
  return isAlteration(raised) ? { letter: seventh.letter, alteration: raised } : undefined
}

export function contextOf(key: Key, event: HarmonicEvent): EventContext {
  const notes = eventNotes(event)
  const chord = eventChord(event)
  const inKey = new Set((keyNotes(key) ?? []).map(tonicKey))
  const leading = leadingNoteOf(key)

  const members = chord === undefined ? undefined : chordMembers(chord)

  return {
    event,
    notes,
    chord,
    root: chord?.root,
    fifth: members?.fifth,
    seventh: members?.seventh,
    leadingNote:
      leading !== undefined && notes.some((note) => tonicKey(note) === tonicKey(leading))
        ? leading
        : undefined,
    isTonic: chord !== undefined && tonicKey(chord.root) === tonicKey(key.tonic),
    altered: notes.filter((note) => !inKey.has(tonicKey(note))),
  }
}

function chordMembers(chord: Chord): {
  fifth: PitchClass | undefined
  seventh: PitchClass | undefined
} {
  // `chordNotes` is member-ordered — root, third, fifth, seventh — so the
  // index *is* the member.
  const notes = chordNotes(chord.root, chord.quality)
  return { fifth: notes?.[2], seventh: isSeventh(chord.quality) ? notes?.[3] : undefined }
}

/* ------------------------------------------------------- vertical: one chord */

const same = (a: PitchClass, b: PitchClass) => tonicKey(a) === tonicKey(b)

/** Everything that can be wrong with a single chord, without looking at its neighbours. */
export function chordFindings(
  context: EventContext,
  voicing: Voicing,
  at: number,
): readonly Finding[] {
  const found: Finding[] = []

  // Range.
  for (const voice of VOICES) {
    const note = voicing[voice]
    const range = SATB_RANGES[voice]
    if (
      chromaticValue(note) < chromaticValue(range.lowest) ||
      chromaticValue(note) > chromaticValue(range.highest)
    ) {
      found.push(error('range', at, [voice]))
    }
  }

  // Crossing, and spacing between neighbours.
  const ladder: readonly VoiceId[] = VOICES
  for (let i = 0; i < ladder.length - 1; i += 1) {
    const upper = ladder[i] as VoiceId
    const lower = ladder[i + 1] as VoiceId
    const gap = chromaticValue(voicing[upper]) - chromaticValue(voicing[lower])
    if (gap < 0) found.push(error('crossing', at, [upper, lower]))
    else if (gap > (lower === 'bass' ? LOWER_SPACING : UPPER_SPACING)) {
      found.push(error('spacing', at, [upper, lower]))
    }
  }

  // The bass is the event's own, not a choice.
  if (!same(voicing.bass, context.event.bass))
    found.push(error('wrong-note', at, ['bass']))

  // Every voice must sing a note of the chord.
  for (const voice of VOICES) {
    const note = voicing[voice]
    if (!context.notes.some((candidate) => same(candidate, note))) {
      found.push(error('wrong-note', at, [voice]))
    }
  }

  // **Omission.** A seventh chord may drop its fifth; a triad may too, with
  // the root then standing three times. Nothing else may go missing — the
  // third says whether the chord is major or minor and the seventh is the
  // reason it is a seventh chord.
  const sounded = new Set(VOICES.map((voice) => tonicKey(voicing[voice])))
  for (const note of context.notes) {
    if (sounded.has(tonicKey(note))) continue
    if (context.fifth !== undefined && same(note, context.fifth)) continue
    found.push(error('incomplete-chord', at, []))
  }

  // **Doubling.** Never the leading note, never a note from outside the key:
  // both want to move somewhere particular, and two voices going there
  // together is what makes octaves.
  const counts = new Map<string, VoiceId[]>()
  for (const voice of VOICES) {
    const key = tonicKey(voicing[voice])
    counts.set(key, [...(counts.get(key) ?? []), voice])
  }

  for (const [note, voices] of counts) {
    if (voices.length < 2) continue
    if (context.leadingNote !== undefined && note === tonicKey(context.leadingNote)) {
      found.push(error('doubled-leading-note', at, voices))
    } else if (context.altered.some((altered) => tonicKey(altered) === note)) {
      found.push(error('doubled-altered', at, voices))
    }
  }

  // The seventh is the dissonance; doubling it makes it unresolvable.
  if (context.seventh !== undefined) {
    const voices = counts.get(tonicKey(context.seventh)) ?? []
    if (voices.length > 1) found.push(error('doubled-altered', at, voices))
  }

  return found
}

/* ----------------------------------------------------- horizontal: a move */

export interface Move {
  from: EventContext
  to: EventContext
  before: Voicing
  after: Voicing
}

/** Everything that can be wrong about getting from one chord to the next. */
export function moveFindings(
  { from, to, before, after }: Move,
  at: number,
): readonly Finding[] {
  const found: Finding[] = []

  // **Parallel fifths and octaves**, between every pair of voices.
  for (let i = 0; i < VOICES.length; i += 1) {
    for (let j = i + 1; j < VOICES.length; j += 1) {
      const upper = VOICES[i] as VoiceId
      const lower = VOICES[j] as VoiceId
      const motion = motionBetween(
        [before[upper], before[lower]],
        [after[upper], after[lower]],
      )
      if (motion !== 'parallel' && motion !== 'similar') continue

      const was = reduced(before[lower], before[upper])
      const now = reduced(after[lower], after[upper])

      if (motion === 'parallel' || was === now) {
        if (was === PERFECT_FIFTH && now === PERFECT_FIFTH) {
          found.push(error('parallel-fifths', at, [upper, lower]))
        }
        if (was === PERFECT_OCTAVE && now === PERFECT_OCTAVE) {
          found.push(error('parallel-octaves', at, [upper, lower]))
        }
      }

      // **Hidden fifths and octaves** — the outer pair arriving at a perfect
      // consonance by similar motion, with the soprano leaping into it. Only
      // the outer voices, because it is only there that the ear hears it.
      if (upper === 'soprano' && lower === 'bass' && was !== now) {
        const leap = Math.abs(step(before.soprano, after.soprano)) > 2
        if (leap && now === PERFECT_FIFTH)
          found.push(error('hidden-fifths', at, ['soprano', 'bass']))
        if (leap && now === PERFECT_OCTAVE) {
          found.push(error('hidden-octaves', at, ['soprano', 'bass']))
        }
      }
    }
  }

  // **Overlap** — a voice moving past where its neighbour just was.
  for (let i = 0; i < VOICES.length - 1; i += 1) {
    const upper = VOICES[i] as VoiceId
    const lower = VOICES[i + 1] as VoiceId
    if (chromaticValue(after[lower]) > chromaticValue(before[upper])) {
      found.push(error('overlap', at, [upper, lower]))
    }
    if (chromaticValue(after[upper]) < chromaticValue(before[lower])) {
      found.push(error('overlap', at, [upper, lower]))
    }
  }

  for (const voice of VOICES) {
    const a = before[voice]
    const b = after[voice]

    // **The augmented second** — the interval harmonic minor puts between its
    // sixth and seventh, and the one melodic minor exists to avoid. Unsingable
    // in this idiom, and a real trap in a minor key rather than a nicety.
    const interval = intervalBetween(a, b)
    if (interval?.number === 2 && interval.quality === 'augmented') {
      found.push(error('augmented-second', at, [voice]))
    }

    if (Math.abs(step(a, b)) > WIDE_LEAP) found.push(warning('large-leap', at, [voice]))
  }

  // **Cross-relation** — the same letter, differently altered, in two voices
  // across the bar. A warning rather than an error: some are idiomatic.
  for (const one of VOICES) {
    for (const other of VOICES) {
      if (one === other) continue
      const a = before[one]
      const b = after[other]
      if (a.letter === b.letter && a.alteration !== b.alteration) {
        found.push(warning('cross-relation', at, [one, other]))
      }
    }
  }

  // **The seventh resolves down by step.** The one rule every textbook opens
  // with, and the reason a seventh chord is not just a chord with a note added.
  if (from.seventh !== undefined) {
    for (const voice of VOICES) {
      if (!same(before[voice], from.seventh)) continue
      const moved = step(before[voice], after[voice])
      const held = same(after[voice], from.seventh)
      if (!held && (moved > 0 || moved < -2)) {
        found.push(error('unresolved-seventh', at, [voice]))
      }
    }
  }

  // **The leading note rises into the tonic.** Checked only where it actually
  // has to: going to the chord the key is named after. Elsewhere a leading
  // note in an inner voice may fall to the fifth so the chord can be complete,
  // which is the standard exception and not a fault.
  // **Only where it is actually a dominant resolving.** A leading note inside
  // a sequence is a passing note and goes where the sequence goes — vii° to
  // iii in a Quintfallsequenz drops a fourth, and calling that a fault taxed
  // every sequence the generator could write.
  if (from.leadingNote !== undefined && to.isTonic) {
    for (const voice of VOICES) {
      if (!same(before[voice], from.leadingNote)) continue
      const moved = step(before[voice], after[voice])
      if (voice !== 'soprano' && voice !== 'bass') continue
      if (moved !== 1 && moved !== 0) {
        found.push(warning('unresolved-leading-note', at, [voice]))
      }
    }
  }

  // **A suspension resolves downward by step.** `held` says the bass did not
  // restrike, which is what makes this event the resolution of the one before
  // it: every upper voice whose note is gone has to have stepped down into the
  // note that replaced it.
  if (to.event.held === true) {
    for (const voice of VOICES) {
      if (voice === 'bass') continue
      if (same(before[voice], after[voice])) continue
      const moved = step(before[voice], after[voice])
      if (moved !== -1 && moved !== -2) {
        found.push(error('unresolved-suspension', at, [voice]))
      }
    }
  }

  // Nothing moving at all is not a progression.
  if (VOICES.every((voice) => same(before[voice], after[voice]))) {
    found.push(warning('static', at, VOICES))
  }

  return found
}

/* ----------------------------------------------------------- the whole thing */

export interface Satz {
  key: Key
  events: readonly HarmonicEvent[]
  voicings: readonly Voicing[]
}

/** Every finding in a finished setting — the grader. */
export function satzFindings(satz: Satz): readonly Finding[] {
  const contexts = satz.events.map((event) => contextOf(satz.key, event))
  const found: Finding[] = []

  for (const [index, context] of contexts.entries()) {
    const voicing = satz.voicings[index]
    if (voicing === undefined) continue
    found.push(...chordFindings(context, voicing, index))

    const next = contexts[index + 1]
    const after = satz.voicings[index + 1]
    if (next === undefined || after === undefined) continue
    found.push(
      ...moveFindings({ from: context, to: next, before: voicing, after }, index + 1),
    )
  }

  return found
}

export function errorsOf(findings: readonly Finding[]): readonly Finding[] {
  return findings.filter((finding) => finding.severity === 'error')
}

/* ------------------------------------------------------------------- cost */

export interface Weights {
  motion: number
  leap: number
  contrary: number
  commonTone: number
  sopranoLeap: number
  warning: number
  /** How hard each voice is pulled toward the middle of its own compass. */
  tessitura: number
  /** Two upper voices on the same note — legal, and not the chorale sound. */
  unison: number
}

/**
 * The chorale weights.
 *
 * Meant to be turned — the numbers are measured by listening rather than
 * derived, exactly as `PACED_CONTOUR`'s are. A second idiom is a second table
 * here and not a second algorithm, which is what the modal Kantionalsatz will
 * want.
 */
export const CHORALE_WEIGHTS: Weights = {
  motion: 1,
  leap: 1.6,
  contrary: -3,
  commonTone: -2.5,
  sopranoLeap: 2.2,
  warning: 14,
  tessitura: 0.55,
  unison: 6,
}

/** How much a move costs. Lower is better; a broken rule is not priced, it is refused. */
export function moveCost(move: Move, weights: Weights = CHORALE_WEIGHTS): number {
  const { before, after } = move
  let cost = 0

  for (const voice of VOICES) {
    const distance = Math.abs(step(before[voice], after[voice]))
    cost += distance * weights.motion
    if (distance === 0) cost += weights.commonTone
    if (distance > COMFORTABLE_LEAP) {
      cost +=
        (distance - COMFORTABLE_LEAP) *
        (voice === 'soprano' ? weights.sopranoLeap : weights.leap)
    }
  }

  const outer = motionBetween([before.soprano, before.bass], [after.soprano, after.bass])
  if (outer === 'contrary') cost += weights.contrary

  for (const finding of moveFindings(move, 0)) {
    if (finding.severity === 'warning') cost += weights.warning
  }

  return cost
}

/** Whether a move breaks no rule at all — the filter the search runs on. */
export function moveAllowed(move: Move): boolean {
  return moveFindings(move, 0).every((finding) => finding.severity !== 'error')
}

/**
 * What a move costs, or `undefined` when it breaks a rule.
 *
 * The two questions answered in one pass, because the search asks both of
 * every edge it looks at and `moveFindings` is the expensive part. **A broken
 * rule is not priced, it is refused** — that is the difference between a hard
 * rule and a preference, and pricing them together is how a generator ends up
 * emitting parallel fifths whenever the alternative was awkward enough.
 */
export function transitionCost(
  move: Move,
  weights: Weights = CHORALE_WEIGHTS,
): number | undefined {
  const findings = moveFindings(move, 0)
  let cost = 0
  for (const finding of findings) {
    if (finding.severity === 'error') return undefined
    cost += weights.warning
  }

  const { before, after } = move
  for (const voice of VOICES) {
    const distance = Math.abs(step(before[voice], after[voice]))
    cost += distance * weights.motion
    if (distance === 0) cost += weights.commonTone
    if (distance > COMFORTABLE_LEAP) {
      cost +=
        (distance - COMFORTABLE_LEAP) *
        (voice === 'soprano' ? weights.sopranoLeap : weights.leap)
    }
  }

  const outer = motionBetween([before.soprano, before.bass], [after.soprano, after.bass])
  if (outer === 'contrary') cost += weights.contrary

  return cost
}

export function chordAllowed(context: EventContext, voicing: Voicing): boolean {
  return chordFindings(context, voicing, 0).every(
    (finding) => finding.severity !== 'error',
  )
}

/** The middle of each voice's compass, where a chorale part mostly sits. */
const CENTRES: Readonly<Record<VoiceId, number>> = {
  soprano:
    (chromaticValue(SATB_RANGES.soprano.lowest) +
      chromaticValue(SATB_RANGES.soprano.highest)) /
    2,
  alto:
    (chromaticValue(SATB_RANGES.alto.lowest) + chromaticValue(SATB_RANGES.alto.highest)) /
    2,
  tenor:
    (chromaticValue(SATB_RANGES.tenor.lowest) +
      chromaticValue(SATB_RANGES.tenor.highest)) /
    2,
  bass:
    (chromaticValue(SATB_RANGES.bass.lowest) + chromaticValue(SATB_RANGES.bass.highest)) /
    2,
}

/**
 * What one chord costs to stand in, before anything moves.
 *
 * **Register is a preference and nothing else stated it.** The ranges say what
 * is singable; they do not say where a part usually sits, so a search that
 * only counted motion was free to put the bass up at B3 under a tenor on the
 * same note, or let the soprano sink to the bottom of its compass and stay
 * there. Pulling each voice gently toward the middle of its own range is what
 * makes the texture sound like a chorus rather than like four lines that
 * happened to be legal.
 */
export function voicingCost(
  voicing: Voicing,
  weights: Weights = CHORALE_WEIGHTS,
): number {
  const top = chromaticValue(voicing.soprano) - chromaticValue(voicing.tenor)
  let cost = Math.max(0, top - 14) * 0.5

  for (const voice of VOICES) {
    cost +=
      Math.abs(chromaticValue(voicing[voice]) - (CENTRES[voice] ?? 0)) * weights.tessitura
  }

  // Two upper voices on one note is thin, and it is the shape a search finds
  // when it is only avoiding crossings.
  if (chromaticValue(voicing.soprano) === chromaticValue(voicing.alto))
    cost += weights.unison
  if (chromaticValue(voicing.alto) === chromaticValue(voicing.tenor))
    cost += weights.unison

  return cost
}

export function voicingPitches(voicing: Voicing): readonly Pitch[] {
  return [voicing.bass, voicing.tenor, voicing.alto, voicing.soprano]
}
