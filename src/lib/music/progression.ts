import { weightedPick, type Random } from '@/lib/utils/seededRandom'

import { chordNotes } from './chord'
import {
  buildEvents,
  eventsKey,
  parseEvents,
  specChord,
  type ChordSpec,
  type HarmonicEvent,
  type StoredProgression,
} from './harmony'
import { isCleanKey, type Key } from './key'
import type { TimeSignature } from './meter'
import type { PitchClass } from './scale'
import {
  BLOCKS,
  FREE_BLOCKS,
  choiceLength,
  choiceSpecs,
  choicesOf,
  choiceFits,
  entryDegree,
  exitDegree,
  getBlock,
  precedence,
  type BlockChoice,
  type HarmonicBlock,
  type SatztechnikId,
} from './satzmodell'

/**
 * Generating a progression that means something.
 *
 * **The destination is chosen first.** A phrase is defined by where it ends,
 * so a cadence is picked and the rest is prepended in front of it, block by
 * block, until the target length is reached. That is not a trick of
 * implementation — harmony is goal-directed, and the question *"what may
 * precede a dominant"* has a short confident answer where *"what may follow a
 * tonic"* has a long weak one. Walking backwards therefore needs a smaller,
 * better-motivated table, and every progression arrives somewhere by
 * construction rather than by luck.
 *
 * The walk is over **blocks**, not chords, and a single chord is a block of
 * length one (`FREE_BLOCKS`) — so one loop covers the named Satzmodelle and a
 * plain chord-by-chord Markov walk at once, and `freeWeight` is simply how
 * hard it reaches for the short ones. A level that wants schemas sets it low;
 * a level that wants ordinary progressions sets it high. Both are honest about
 * what they produced, because every block writes its own name into the
 * analysis.
 */

export interface Annotation {
  id: SatztechnikId
  /** The degree the block stood on. */
  origin: number
  /** How many links, for a sequence; 1 for everything else. */
  links: number
  /** First event index the block produced, inclusive. */
  from: number
  /** Last event index, inclusive. */
  to: number
}

/**
 * A voicing preference the plan asks for, as a note that belongs in the
 * soprano. Not stored: it is re-derived from the annotations, so a row stays
 * the size it is and the block table stays the only place that knows.
 */
export interface VoicingConstraint {
  event: number
  soprano: PitchClass
}

export interface Progression {
  key: Key
  meter: TimeSignature
  events: readonly HarmonicEvent[]
  analysis: readonly Annotation[]
  constraints: readonly VoicingConstraint[]
}

export interface ProgressionSpec {
  keys: readonly Key[]
  /** How many chords a progression should come to. */
  chords: readonly number[]
  /** Which cadences may close it. */
  cadences: readonly SatztechnikId[]
  /** Which models, prolongations and approaches may fill the middle. */
  blocks: readonly SatztechnikId[]
  /**
   * How hard the walk reaches for a plain chord rather than a named block.
   * Zero is all-schema; a large number is an ordinary progression that still
   * cadences properly.
   */
  freeWeight: number
  meter: TimeSignature
}

export const DEFAULT_METER: TimeSignature = { beats: 4, unit: 4 }

/** The opening, which is always the tonic and always one chord. */
const OPENING: SatztechnikId = 'eroeffnung-tonika'

const TRIES = 24

/* ---------------------------------------------------------------- expanding */

interface Expansion {
  events: readonly HarmonicEvent[]
  analysis: readonly Annotation[]
  constraints: readonly VoicingConstraint[]
}

/**
 * The chord member a soprano constraint names, as an actual note.
 *
 * Resolved here rather than carried as an index, so the voicing search never
 * has to know what a chord member is — it is handed a pitch class and asked to
 * put it on top.
 */
function sopranoNote(key: Key, spec: ChordSpec, member: number): PitchClass | undefined {
  const chord = specChord(key, spec)
  if (chord === undefined) return undefined
  return chordNotes(chord.root, chord.quality)?.[member]
}

/**
 * One block spelled out, with its constraints indexed **from its own start**.
 *
 * Relative rather than absolute, so reading a row back can place a block's
 * constraints by that span's own `from` without replaying every block before
 * it. That matters because not every block *can* be replayed: a free chord is
 * annotated `frei` and is not in `BLOCKS` at all, so walking the list to count
 * events skips it and shifts every index after it — which put a cadence's
 * "tonic in the soprano" onto the wrong chord and left the voicing search with
 * nothing legal to find. This shape removes the bug rather than guarding
 * against it.
 */
export function expandChoice(key: Key, choice: BlockChoice): Expansion | undefined {
  const events: HarmonicEvent[] = []
  const constraints: VoicingConstraint[] = []

  const specs = choiceSpecs(choice)
  if (specs.length === 0) return undefined

  // A sequence's units repeat, so only a fixed schema carries constraints —
  // which is right, since it is cadences that name a Lage.
  const relative = choice.block.sequence === undefined ? (choice.block.events ?? []) : []

  for (const [index, spec] of specs.entries()) {
    const built = buildEvents(key, spec)
    if (built === undefined) return undefined
    events.push(...built)

    // A suspension resolves *into* the chord its constraint names, so the last
    // of the events a spec produced is the one it belongs to.
    const member = relative[index]?.soprano
    if (member === undefined) continue
    const note = sopranoNote(key, spec, member)
    if (note !== undefined) constraints.push({ event: events.length - 1, soprano: note })
  }

  return {
    events,
    constraints,
    analysis: [
      {
        id: choice.block.id,
        origin: choice.origin,
        links: choice.links,
        from: 0,
        to: events.length - 1,
      },
    ],
  }
}

/**
 * Turn a run of choices into events, spans and constraints.
 *
 * The single place that does it, so generation and reading a row back out
 * cannot come to disagree about which events a block produced — which matters
 * because a suspension makes one spec into two events and the spans would
 * otherwise be off by one wherever a cadence suspends.
 */
export function expand(key: Key, choices: readonly BlockChoice[]): Expansion | undefined {
  const events: HarmonicEvent[] = []
  const analysis: Annotation[] = []
  const constraints: VoicingConstraint[] = []

  for (const choice of choices) {
    const from = events.length
    const part = expandChoice(key, choice)
    if (part === undefined) return undefined

    events.push(...part.events)
    for (const constraint of part.constraints) {
      constraints.push({ ...constraint, event: constraint.event + from })
    }
    analysis.push({
      id: choice.block.id,
      origin: choice.origin,
      links: choice.links,
      from,
      to: events.length - 1,
    })
  }

  if (events.length === 0) return undefined
  return { events, analysis, constraints }
}

/**
 * The voicing constraints a stored analysis implies.
 *
 * Each span is expanded on its own and placed by its own `from`, so a span
 * this version of the app no longer recognises costs that block its Lage and
 * nothing else.
 */
export function constraintsOf(
  key: Key,
  analysis: readonly Annotation[],
): readonly VoicingConstraint[] {
  const constraints: VoicingConstraint[] = []

  for (const span of analysis) {
    const block = getBlock(span.id)
    if (block === undefined) continue

    const part = expandChoice(key, { block, origin: span.origin, links: span.links })
    if (part === undefined) continue
    for (const constraint of part.constraints) {
      constraints.push({ ...constraint, event: constraint.event + span.from })
    }
  }

  return constraints
}

/* --------------------------------------------------------------- generating */

interface Candidate {
  choice: BlockChoice
  weight: number
}

function allowedBlocks(spec: ProgressionSpec): readonly HarmonicBlock[] {
  return BLOCKS.filter(
    (block) =>
      block.kind !== 'cadence' &&
      block.kind !== 'opening' &&
      spec.blocks.includes(block.id),
  )
}

/**
 * Everything that may be prepended in front of a chord standing on `next`,
 * with the weight it deserves.
 *
 * The weight is the block's own times **how readily its last chord stands in
 * front of that one** — so the same `PRECEDENTS` table that drives the free
 * walk also decides how well two blocks join. Two tables would be two things
 * that could disagree about one question.
 */
function candidates(
  key: Key,
  spec: ProgressionSpec,
  next: number,
  budget: number,
  avoid: SatztechnikId | undefined,
): readonly Candidate[] {
  const pool = [
    ...allowedBlocks(spec).flatMap(choicesOf),
    ...FREE_BLOCKS.flatMap(choicesOf),
  ]

  const found: Candidate[] = []
  for (const choice of pool) {
    if (choiceLength(choice) > budget) continue
    // **No named block twice running.** Two Zwischendominanten in a row is a
    // progression that says the same thing twice, and it reads as a generator
    // repeating itself rather than as a phrase. A free chord may of course
    // follow another — that is what a walk is.
    if (choice.block.kind !== 'free' && choice.block.id === avoid) continue

    const exit = exitDegree(choice)
    if (exit === undefined) continue
    const joins = precedence(exit, next)
    if (joins <= 0) continue

    if (!choiceFits(key, choice)) continue

    const free = choice.block.kind === 'free'
    const weight = choice.block.weight * joins * (free ? spec.freeWeight : 1)
    if (weight <= 0) continue
    found.push({ choice, weight })
  }
  return found
}

function cadenceChoices(key: Key, spec: ProgressionSpec): readonly Candidate[] {
  return BLOCKS.filter(
    (block) => block.kind === 'cadence' && spec.cadences.includes(block.id),
  )
    .flatMap(choicesOf)
    .filter((choice) => choiceFits(key, choice))
    .map((choice) => ({ choice, weight: choice.block.weight }))
}

function walk(
  random: Random,
  spec: ProgressionSpec,
  key: Key,
  cadence: BlockChoice,
  budget: number,
): readonly BlockChoice[] {
  const chosen: BlockChoice[] = [cadence]
  let total = choiceLength(cadence)

  while (total < budget) {
    const next = entryDegree(chosen[0] as BlockChoice)
    if (next === undefined) break

    const previous = chosen[0]?.block
    const pool = candidates(
      key,
      spec,
      next,
      budget - total,
      previous === undefined || previous.kind === 'free' ? undefined : previous.id,
    )
    const picked = weightedPick(random, pool, (entry) => entry.weight)
    if (picked === undefined) break

    chosen.unshift(picked.choice)
    total += choiceLength(picked.choice)
  }

  return chosen
}

function attempt(
  random: Random,
  spec: ProgressionSpec,
  key: Key,
): Progression | undefined {
  const target = weightedPick(random, spec.chords, () => 1)
  if (target === undefined || target < 3) return undefined

  const picked = weightedPick(random, cadenceChoices(key, spec), (entry) => entry.weight)
  if (picked === undefined) return undefined
  const cadence = picked.choice

  const opening = getBlock(OPENING)
  if (opening === undefined) return undefined
  const open: BlockChoice = { block: opening, origin: 1, links: 1 }
  if (!choiceFits(key, open)) return undefined

  // **The opening tonic is part of the length, and whether it is needed is not
  // knowable until the walk has run** — a Quintfallsequenz placed on the first
  // degree, or a tonic prolongation, arrives there on its own. So the walk is
  // run twice at most: once holding a chord back for an opening, and once not,
  // and the pass whose result actually starts on the tonic is the one kept.
  // Without it a progression asked for six chords quietly came out at five
  // whenever the walk happened to land on the tonic by itself.
  for (const reserve of [1, 0]) {
    const chosen = walk(random, spec, key, cadence, target - reserve)
    const opens = entryDegree(chosen[0] as BlockChoice)
    if (opens === undefined) continue

    const needed = opens !== 1
    if (needed !== (reserve === 1)) continue
    if (needed && precedence(1, opens) <= 0) continue

    const expanded = expand(key, needed ? [open, ...chosen] : chosen)
    if (expanded === undefined) continue

    // **A walk that ran out of moves is not a shorter progression, it is a
    // failed one.** With no free chords to fall back on — which is what a
    // level of nothing but Satzmodelle asks for — the blocks that fit the
    // remaining budget can simply run out, and the chain stops early. Handing
    // that back would quietly give the player four chords where the level said
    // six, so it is refused and the caller draws again.
    if (expanded.events.length !== target) continue

    return { key, meter: spec.meter, ...expanded }
  }

  return undefined
}

/**
 * A progression, or `undefined` when this key and this vocabulary could not
 * produce one.
 *
 * `undefined` is the same answer `transpose` gives everywhere else: the caller
 * tries again rather than treating it as an error. `difficulties.test.ts`
 * proves every shipped level fills every time, which is what makes that safe.
 */
export function generateProgression(
  random: Random,
  spec: ProgressionSpec,
): Progression | undefined {
  const keys = spec.keys.filter(isCleanKey)
  if (keys.length === 0) return undefined

  for (let tries = 0; tries < TRIES; tries += 1) {
    const key = weightedPick(random, keys, () => 1)
    if (key === undefined) continue
    const found = attempt(random, spec, key)
    if (found !== undefined) return found
  }
  return undefined
}

/* --------------------------------------------------------------- the shape */

export function progressionTicks(progression: Progression): number {
  return progression.events.reduce((total, event) => total + event.ticks, 0)
}

/** The bass line, which is what the first exercise asks for. */
export function bassLine(progression: Progression): readonly PitchClass[] {
  const line: PitchClass[] = []
  for (const event of progression.events) {
    // A held bass is one note, however many sonorities stand over it.
    if (event.held === true) continue
    line.push(event.bass)
  }
  return line
}

/** Which Satztechniken a progression is made of, in order, each named once. */
export function techniquesOf(progression: Progression): readonly SatztechnikId[] {
  const seen: SatztechnikId[] = []
  for (const span of progression.analysis) {
    if (!seen.includes(span.id)) seen.push(span.id)
  }
  return seen
}

/** The cadence a progression closes with, which every progression has. */
export function cadenceOf(progression: Progression): SatztechnikId | undefined {
  const last = progression.analysis[progression.analysis.length - 1]
  return last?.id
}

/** The named model a progression used, if it used one. */
export function modelOf(progression: Progression): SatztechnikId | undefined {
  return progression.analysis.find((span) => getBlock(span.id)?.kind === 'model')?.id
}

export function hasApplied(progression: Progression): boolean {
  return progression.analysis.some((span) => {
    const block = getBlock(span.id)
    if (block === undefined) return false
    const events = block.sequence?.unit ?? block.events ?? []
    return events.some((event) => event.applied !== undefined)
  })
}

export function hasSuspension(progression: Progression): boolean {
  return progression.events.some((event) => event.held === true)
}

/* ------------------------------------------------------------- stored form */

const SPAN_SEPARATOR = ','
const FIELD_SEPARATOR = ':'

export function analysisKey(analysis: readonly Annotation[]): string {
  return analysis
    .map((span) =>
      [span.id, span.origin, span.links, span.from, span.to].join(FIELD_SEPARATOR),
    )
    .join(SPAN_SEPARATOR)
}

export function parseAnalysis(text: string): readonly Annotation[] | undefined {
  if (text.trim() === '') return []

  const spans: Annotation[] = []
  for (const part of text.split(SPAN_SEPARATOR)) {
    const fields = part.split(FIELD_SEPARATOR)
    if (fields.length !== 5) return undefined
    const [id, origin, links, from, to] = fields as [
      string,
      string,
      string,
      string,
      string,
    ]

    const numbers = [origin, links, from, to].map(Number)
    if (numbers.some((value) => !Number.isInteger(value) || value < 0)) return undefined

    spans.push({
      id: id as SatztechnikId,
      origin: numbers[0] as number,
      links: numbers[1] as number,
      from: numbers[2] as number,
      to: numbers[3] as number,
    })
  }
  return spans
}

export interface StoredProgressionRow extends StoredProgression {
  analysis: string
}

export function progressionKey(
  progression: Progression,
): StoredProgressionRow | undefined {
  const stored = eventsKey(progression.key, progression.events)
  if (stored === undefined) return undefined
  return { ...stored, analysis: analysisKey(progression.analysis) }
}

/**
 * A progression read back out of a row.
 *
 * The notes come from the figures, which are exact. The **constraints** are
 * re-derived by re-expanding the annotations rather than being stored — so a
 * row stays small, and a row written before a block existed still replays its
 * own notes perfectly and merely loses a voicing nicety.
 */
export function parseProgression(
  key: Key,
  meter: TimeSignature,
  stored: StoredProgressionRow,
): Progression | undefined {
  const events = parseEvents(key, stored)
  const analysis = parseAnalysis(stored.analysis)
  if (events === undefined || analysis === undefined) return undefined

  return { key, meter, events, analysis, constraints: constraintsOf(key, analysis) }
}
