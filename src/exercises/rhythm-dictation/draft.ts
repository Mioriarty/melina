import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from '@/lib/music/meter'
import type { Rhythm } from '@/lib/music/rhythm'
import {
  beamed,
  beamedByBeat,
  borrowedFrom,
  valueTicks,
  type NoteValue,
  type RhythmNode,
  type RhythmSymbol,
} from '@/lib/notation/rhythmNotation'

/**
 * The bar as it is being typed.
 *
 * Kept as the sequence of keys that were pressed rather than as a set of
 * impacts, because the staff has to show **what the player wrote**, not a
 * tidied-up version of it: someone who enters a quarter rest should see a
 * quarter rest. The impacts are derived from it for grading, and they are the
 * only part that is graded — a rest and a held note say the same thing about
 * a drum, so the choice between them can never be wrong.
 */

export interface DraftEntry {
  kind: 'note' | 'rest'
  dur: NoteValue
  dots: 0 | 1
  /** The tuplet division this was entered under, when it was one. */
  tuplet?: number
}

export interface RhythmDraft {
  meter: TimeSignature
  entries: readonly DraftEntry[]
  /**
   * A tuplet waiting to be filled. Only ever set at a beat boundary, and
   * cleared the moment its beat is exactly full, so a bracket can never be
   * left half open across a barline.
   */
  tuplet?: number
}

export function emptyDraft(meter: TimeSignature): RhythmDraft {
  return { meter, entries: [] }
}

/**
 * How long an entry really lasts.
 *
 * Inside a tuplet a value is *borrowed*: three eighths in the space of two
 * means each of them is two thirds of an eighth. `undefined` when the value
 * cannot be written at all.
 */
export function entryTicks(entry: DraftEntry): number | undefined {
  const written = valueTicks(entry.dur, entry.dots)
  if (written === undefined) return undefined
  if (entry.tuplet === undefined) return written

  const real = (written * borrowedFrom(entry.tuplet)) / entry.tuplet
  return Number.isInteger(real) ? real : undefined
}

/** Where each entry starts, in ticks from the barline. */
function positions(
  draft: RhythmDraft,
): { entry: DraftEntry; at: number; ticks: number }[] {
  const placed: { entry: DraftEntry; at: number; ticks: number }[] = []
  let at = 0

  for (const entry of draft.entries) {
    const ticks = entryTicks(entry)
    if (ticks === undefined) continue
    placed.push({ entry, at, ticks })
    at += ticks
  }

  return placed
}

/** How much of the bar has been typed. */
export function draftTicks(draft: RhythmDraft): number {
  return draft.entries.reduce((total, entry) => total + (entryTicks(entry) ?? 0), 0)
}

export function isFull(draft: RhythmDraft): boolean {
  return draftTicks(draft) === ticksPerMeasure(draft.meter)
}

/** The impacts the draft says — the whole of what gets graded. */
export function draftRhythm(draft: RhythmDraft): Rhythm {
  return {
    meter: draft.meter,
    onsets: positions(draft)
      .filter((placed) => placed.entry.kind === 'note')
      .map((placed) => placed.at),
  }
}

/**
 * Whether a key may be pressed.
 *
 * A plain value may run over a beat — that is what a half note is — but never
 * over the barline. A tuplet value may not leave its own beat, since a bracket
 * has to close where it opened.
 */
export function canAppend(
  draft: RhythmDraft,
  value: { dur: NoteValue; dots: 0 | 1 },
): boolean {
  const entry: DraftEntry = {
    kind: 'note',
    ...value,
    ...(draft.tuplet === undefined ? {} : { tuplet: draft.tuplet }),
  }

  const ticks = entryTicks(entry)
  if (ticks === undefined) return false

  const at = draftTicks(draft)
  if (draft.tuplet === undefined) return at + ticks <= ticksPerMeasure(draft.meter)

  const beatEnd = (Math.floor(at / TICKS_PER_BEAT) + 1) * TICKS_PER_BEAT
  return at + ticks <= beatEnd
}

/** Whether a tuplet may be started here: only on an untouched beat. */
export function canArm(draft: RhythmDraft): boolean {
  return !isFull(draft) && draftTicks(draft) % TICKS_PER_BEAT === 0
}

/** Set or clear the bracket, with no questions asked. */
function setTuplet(draft: RhythmDraft, division: number | undefined): RhythmDraft {
  const { tuplet: _drop, ...rest } = draft
  return division === undefined ? rest : { ...rest, tuplet: division }
}

/**
 * Start or stop a tuplet, as a key press would.
 *
 * Guarded by `canArm`, so a bracket can only ever open on an untouched beat.
 * Restoring one after a backspace deliberately goes around this — see
 * `removeLast`, which puts the draft back *inside* a bracket that is by
 * definition half filled.
 */
export function arm(draft: RhythmDraft, division: number | undefined): RhythmDraft {
  if (division !== undefined && !canArm(draft)) return draft
  return setTuplet(draft, division)
}

export function append(
  draft: RhythmDraft,
  value: { kind: 'note' | 'rest'; dur: NoteValue; dots: 0 | 1 },
): RhythmDraft {
  if (!canAppend(draft, value)) return draft

  const entry: DraftEntry = {
    ...value,
    ...(draft.tuplet === undefined ? {} : { tuplet: draft.tuplet }),
  }
  const entries = [...draft.entries, entry]
  const next: RhythmDraft = { ...draft, entries }

  // A bracket closes as soon as its beat is exactly full, so the next key is a
  // plain one again without anyone having to switch back.
  return draftTicks(next) % TICKS_PER_BEAT === 0 ? setTuplet(next, undefined) : next
}

/**
 * Take back the last key.
 *
 * If that lands back inside an unfinished tuplet, the tuplet is armed again —
 * otherwise the next key would be entered as a plain value in the middle of a
 * bracket.
 */
export function removeLast(draft: RhythmDraft): RhythmDraft {
  if (draft.entries.length === 0) return setTuplet(draft, undefined)

  const entries = draft.entries.slice(0, -1)
  const trimmed: RhythmDraft = { ...draft, entries }
  const last = entries[entries.length - 1]

  // Half way through a bracket, which `canArm` would refuse and which is
  // exactly where deleting into one leaves you.
  const insideTuplet =
    last?.tuplet !== undefined && draftTicks(trimmed) % TICKS_PER_BEAT !== 0

  return setTuplet(trimmed, insideTuplet ? last.tuplet : undefined)
}

/**
 * The draft as notation — what the player wrote, not a re-spelling of it.
 *
 * Consecutive entries sharing a bracket become one tuplet; everything else is
 * beamed by the beat, the same way a generated bar is.
 */
export function draftNodes(draft: RhythmDraft): RhythmNode[] {
  const placed = positions(draft)
  const nodes: RhythmNode[] = []
  let plain: RhythmSymbol[] = []

  const flushPlain = () => {
    if (plain.length > 0) nodes.push(...beamedByBeat(draft.meter, plain))
    plain = []
  }

  for (let index = 0; index < placed.length;) {
    const current = placed[index]
    if (current === undefined) break

    const division = current.entry.tuplet
    if (division === undefined) {
      plain.push(toSymbol(current))
      index += 1
      continue
    }

    // Everything entered under the same bracket, which by construction sits
    // inside one beat.
    const run: RhythmSymbol[] = []
    while (index < placed.length && placed[index]?.entry.tuplet === division) {
      run.push(toSymbol(placed[index] as (typeof placed)[number]))
      index += 1
    }

    flushPlain()
    nodes.push({
      kind: 'tuplet',
      num: division,
      numbase: borrowedFrom(division),
      children: beamed(run),
    })
  }

  flushPlain()
  return nodes
}

function toSymbol({
  entry,
  at,
  ticks,
}: {
  entry: DraftEntry
  at: number
  ticks: number
}): RhythmSymbol {
  return { kind: entry.kind, dur: entry.dur, dots: entry.dots, at, ticks }
}
