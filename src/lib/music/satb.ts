import { leapWeight, type MelodicShape } from './contour'
import type { HarmonicEvent } from './harmony'
import { chromaticValue, type Pitch } from './pitch'
import type { Progression, VoicingConstraint } from './progression'
import { tonicKey, type PitchClass } from './scale'
import {
  contextOf,
  COMFORTABLE_LEAP,
  motionBetween,
  SATB_RANGES,
  step,
  VOICES,
  type EventContext,
  type Move,
  type Satz,
  type VoiceId,
  type VoiceRange,
  type Voicing,
} from './satbVoicing'
import { chordAllowed, moveFindings } from './voiceLeading'

/**
 * Putting a progression into four parts.
 *
 * **A shortest path, not a greedy walk.** Choosing each chord's voicing by
 * what is cheapest from the one before it is exactly how a generator paints
 * itself into a corner: the locally tidy choice leaves the next chord with no
 * legal move, and what comes out is either a dead end or a patched-up setting
 * with the rules bent where it got stuck. So the whole progression is solved
 * at once — nodes are (event, voicing), edges are the transitions
 * `voiceLeading.ts` permits, edge weight is what it costs, and Viterbi finds
 * the globally cheapest path through all of them.
 *
 * That buys three things beyond correctness. Hard rules are edges that do not
 * exist, so a parallel fifth cannot be outvoted by a large enough preference
 * elsewhere. Preferences are weights, so an idiom is a table rather than an
 * algorithm. And **the soprano is a first-class objective rather than a
 * by-product** — a search that only minimised motion would leave the top voice
 * sitting still, so the line is shaped by `leapWeight` from `contour.ts`, the
 * same curve that shapes a melody in melodic dictation.
 */

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

/** The middle of each voice's compass, where a chorale part mostly sits. */
const CENTRES: Readonly<Record<VoiceId, number>> = Object.fromEntries(
  VOICES.map((voice) => [
    voice,
    (chromaticValue(SATB_RANGES[voice].lowest) +
      chromaticValue(SATB_RANGES[voice].highest)) /
      2,
  ]),
) as Readonly<Record<VoiceId, number>>

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

/**
 * What a move costs, or `undefined` when it breaks a rule.
 *
 * The two questions answered in one pass, because the search asks both of
 * every edge it looks at and `moveFindings` is the expensive part. **A broken
 * rule is not priced, it is refused** — that is the difference between a hard
 * rule and a preference, and pricing them together is how a generator ends up
 * emitting parallel fifths whenever the alternative was awkward enough.
 *
 * Run with no rule set, so the generator is always held to **every** rule
 * whatever a level has switched off for the player. A level's selection says
 * what a player is marked on; it can never make the app's own writing worse.
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

export interface SatzOptions {
  weights?: Weights
  /** Notes the plan wants in the soprano, by event index. */
  constraints?: readonly VoicingConstraint[]
  /** How the soprano line should move. */
  shape?: MelodicShape
  /** A soprano given in advance — chorale harmonisation, when it arrives. */
  soprano?: readonly Pitch[]
}

/** How hard the soprano's own line pulls against plain economy of motion. */
const CONTOUR_WEIGHT = 5

/**
 * How many voicings one event may offer.
 *
 * A cap rather than a limit that ever bites in practice — four notes across
 * four voices inside chorale ranges comes to a few dozen once spacing and
 * doubling have had their say. It is here so that a future vocabulary with
 * wider chords cannot quietly make the search quadratic in something large.
 */
const MAX_VOICINGS = 200

function placements(note: PitchClass, range: VoiceRange): readonly Pitch[] {
  const found: Pitch[] = []
  for (
    let octave = range.lowest.octave;
    octave <= range.highest.octave + 1;
    octave += 1
  ) {
    const candidate: Pitch = { ...note, octave }
    if (
      chromaticValue(candidate) >= chromaticValue(range.lowest) &&
      chromaticValue(candidate) <= chromaticValue(range.highest)
    ) {
      found.push(candidate)
    }
  }
  return found
}

/**
 * Every legal way to sing one chord.
 *
 * The bass is not a choice of note — the event names it — only of octave.
 * Everything above is drawn from the chord's own notes, and `chordAllowed`
 * throws out the crossings, the bad spacings, the doubled leading notes and
 * the incomplete chords before the search ever sees them.
 */
export function voicingsFor(
  context: EventContext,
  soprano?: PitchClass | Pitch,
): readonly Voicing[] {
  const bassOptions = placements(context.event.bass, SATB_RANGES.bass)

  const wanted = soprano === undefined ? undefined : tonicKey(soprano)
  const sopranoNotes =
    wanted === undefined
      ? context.notes
      : context.notes.filter((note) => tonicKey(note) === wanted)

  const sopranoOptions = sopranoNotes.flatMap((note) =>
    placements(note, SATB_RANGES.soprano),
  )
  const altoOptions = context.notes.flatMap((note) => placements(note, SATB_RANGES.alto))
  const tenorOptions = context.notes.flatMap((note) =>
    placements(note, SATB_RANGES.tenor),
  )

  const found: Voicing[] = []
  for (const bass of bassOptions) {
    for (const tenor of tenorOptions) {
      if (chromaticValue(tenor) < chromaticValue(bass)) continue
      for (const alto of altoOptions) {
        if (chromaticValue(alto) < chromaticValue(tenor)) continue
        for (const top of sopranoOptions) {
          if (chromaticValue(top) < chromaticValue(alto)) continue
          const voicing: Voicing = { soprano: top, alto, tenor, bass }
          if (!chordAllowed(context, voicing)) continue
          found.push(voicing)
          if (found.length >= MAX_VOICINGS) return found
        }
      }
    }
  }
  return found
}

/**
 * What the soprano's own line costs.
 *
 * `leapWeight` answers how likely a melody is to move that far in that much
 * time, and a likelihood becomes a cost by taking its negative log — so a step
 * is cheap, a third ordinary, and a seventh after a short note expensive
 * without ever being forbidden. A repeated note is damped by the same curve,
 * which is what stops the top voice standing still.
 */
function contourCost(from: Pitch, to: Pitch, ticks: number, shape: MelodicShape): number {
  const distance = chromaticValue(to) - chromaticValue(from)
  const weight = leapWeight(shape, distance, ticks)
  return -Math.log(Math.max(weight, Number.EPSILON)) * CONTOUR_WEIGHT
}

/** The widest a soprano can move: its own compass, and never more. */
const SOPRANO_SPAN =
  chromaticValue(SATB_RANGES.soprano.highest) - chromaticValue(SATB_RANGES.soprano.lowest)

/**
 * The cheapest the contour term can be at this note length.
 *
 * Needed because the branch-and-bound below is only sound if every term it
 * skips has a floor, and this one is **not** always non-negative: `steady`
 * weights a step at 8, which is a negative cost once logged. Measuring the
 * floor rather than assuming it is zero is what keeps the search exact under
 * a shape whose weights are not probabilities.
 */
function contourFloor(ticks: number, shape: MelodicShape): number {
  let most = 0
  for (let distance = -SOPRANO_SPAN; distance <= SOPRANO_SPAN; distance += 1) {
    most = Math.max(most, leapWeight(shape, distance, ticks))
  }
  return -Math.log(Math.max(most, Number.EPSILON)) * CONTOUR_WEIGHT
}

interface Step {
  cost: number
  from: number
}

/**
 * The four voices of a whole progression, or `undefined` when this
 * progression cannot be set at all under these rules.
 *
 * `undefined` is the answer `transpose` gives everywhere else in `lib/music`,
 * and means the same thing: try another question. The generator retries and
 * `difficulties.test.ts` proves no shipped level ever has to.
 */
export function voiceProgression(
  progression: Progression,
  options: SatzOptions = {},
): Satz | undefined {
  const weights = options.weights ?? CHORALE_WEIGHTS
  const shape: MelodicShape = options.shape ?? 'paced'

  const contexts = progression.events.map((event) => contextOf(progression.key, event))

  const wanted = new Map<number, PitchClass>()
  for (const constraint of options.constraints ?? [])
    wanted.set(constraint.event, constraint.soprano)
  for (const [index, note] of (options.soprano ?? []).entries()) wanted.set(index, note)

  const layers = contexts.map((context, index) => voicingsFor(context, wanted.get(index)))
  if (layers.some((layer) => layer.length === 0)) return undefined

  // ---- Viterbi.
  // The cheapest an edge can possibly be: every voice holding its note, and
  // the outer pair in contrary motion.
  const edgeFloor = 4 * Math.min(0, weights.commonTone) + Math.min(0, weights.contrary)

  const first = layers[0] as readonly Voicing[]
  let previous: Step[] = first.map((voicing) => ({
    cost: voicingCost(voicing, weights),
    from: -1,
  }))
  const trail: Step[][] = [previous]

  for (let index = 1; index < layers.length; index += 1) {
    const before = layers[index - 1] as readonly Voicing[]
    const here = layers[index] as readonly Voicing[]
    const from = contexts[index - 1] as EventContext
    const to = contexts[index] as EventContext
    const ticks = from.event.ticks
    const floor = edgeFloor + contourFloor(ticks, shape)

    const current: Step[] = here.map(() => ({ cost: Number.POSITIVE_INFINITY, from: -1 }))

    // **Branch and bound, and it is exact rather than a beam.** Every term
    // added below a reached cost has a floor — `voicingCost` and the contour
    // are never negative, and an edge is cheapest when every voice holds and
    // the outer pair moves in contrary motion — so once the sources are in
    // ascending order of what it cost to reach them, the first one that cannot
    // beat the best found so far proves none after it can either. That cuts
    // most of the work without giving up the globally cheapest path, which a
    // narrowed candidate list would.
    const order = previous
      .map((step, index) => ({ index, cost: step.cost }))
      .filter((entry) => Number.isFinite(entry.cost))
      .sort((a, b) => a.cost - b.cost)

    for (const [j, after] of here.entries()) {
      const slot = current[j] as Step
      const settled = voicingCost(after, weights)

      for (const { index: i, cost: reached } of order) {
        if (reached + floor + settled >= slot.cost) break

        const start = before[i]
        if (start === undefined) continue

        const edge = transitionCost({ from, to, before: start, after }, weights)
        if (edge === undefined) continue

        const total =
          reached +
          edge +
          settled +
          contourCost(start.soprano, after.soprano, ticks, shape)
        if (total < slot.cost) {
          slot.cost = total
          slot.from = i
        }
      }
    }

    if (current.every((step) => !Number.isFinite(step.cost))) return undefined
    previous = current
    trail.push(current)
  }

  // ---- Walk the cheapest path back.
  let best = -1
  let bestCost = Number.POSITIVE_INFINITY
  for (const [index, step] of previous.entries()) {
    if (step.cost < bestCost) {
      bestCost = step.cost
      best = index
    }
  }
  if (best < 0 || !Number.isFinite(bestCost)) return undefined

  const voicings: Voicing[] = []
  let at = best
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index] as readonly Voicing[]
    const voicing = layer[at]
    if (voicing === undefined) return undefined
    voicings.unshift(voicing)
    at = (trail[index]?.[at] as Step | undefined)?.from ?? -1
    if (index > 0 && at < 0) return undefined
  }

  return { key: progression.key, events: progression.events, voicings }
}

/** One voice's line through a whole setting — what "sing the tenor" means. */
export function satzLine(satz: Satz, voice: VoiceId): readonly Pitch[] {
  return satz.voicings.map((voicing) => voicing[voice])
}

/** The four notes of one chord, bass upward, which is how a staff reads them. */
export function satzChord(satz: Satz, index: number): readonly Pitch[] {
  const voicing = satz.voicings[index]
  if (voicing === undefined) return []
  return [voicing.bass, voicing.tenor, voicing.alto, voicing.soprano]
}

/** Every event of a progression, as the four voices singing it. */
export function satzEvents(satz: Satz): readonly HarmonicEvent[] {
  return satz.events
}
