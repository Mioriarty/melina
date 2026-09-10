import type { Phrase } from '@/lib/music/phrase'
import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from '@/lib/music/meter'
import type { Pitch } from '@/lib/music/pitch'
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
 * The bars as they are being typed — shared by both dictation exercises.
 *
 * **Kept as the keys that were pressed, not the impacts they imply.** The staff
 * has to show what the player wrote: someone who enters a quarter rest should
 * see a quarter rest. The impacts are derived from it for grading, and they are
 * the only part that is graded — a rest and a held note say the same thing
 * about when the next note begins, so choosing between them can never be wrong.
 *
 * This is rhythmic dictation's draft, generalised in exactly two directions
 * rather than copied into a sibling:
 *
 * - **More than one bar.** A rhythm answers one; a melody may answer up to
 *   four. An entry may never cross a barline, which is the same rule a single
 *   bar already had — there it simply had nowhere else to go.
 * - **A pitch on an entry.** A rhythm has none and never sets one, so its
 *   behaviour is untouched.
 *
 * There is a third thing a melody needs and a rhythm does not: a **locked**
 * prefix. Melodic dictation gives the first note away, and a hint that can be
 * deleted is not a hint.
 */

export interface DraftEntry {
  kind: 'note' | 'rest'
  dur: NoteValue
  dots: 0 | 1
  /** The tuplet division this was entered under, when it was one. */
  tuplet?: number
  /** The note it was written on. Absent for a rest, and for a rhythm. */
  pitch?: Pitch
}

export interface BarDraft {
  meter: TimeSignature
  /** How many bars the finished answer has. */
  bars: number
  entries: readonly DraftEntry[]
  /**
   * A tuplet waiting to be filled. Only ever set at a beat boundary, and
   * cleared the moment its beat is exactly full, so a bracket can never be
   * left half open across a barline.
   */
  tuplet?: number
  /**
   * How many entries at the front were given rather than typed.
   *
   * Backspace stops here. Melodic dictation shows the first note — correct in
   * pitch and in length — so that it is somewhere to reckon from; a player who
   * deleted it would be left with a question that no longer says where it
   * starts.
   */
  locked: number
}

export function emptyDraft(meter: TimeSignature, bars = 1): BarDraft {
  return { meter, bars, entries: [], locked: 0 }
}

/**
 * A draft that opens with something already written, and locked.
 *
 * The entries are taken from the spelling of the correct answer rather than
 * invented here — see `leadingEntries` — so the note that is given always
 * agrees with the note that will be marked.
 */
export function seededDraft(
  meter: TimeSignature,
  bars: number,
  entries: readonly DraftEntry[],
): BarDraft {
  const draft: BarDraft = { meter, bars, entries, locked: entries.length }

  // Landing inside an unfinished bracket arms it, exactly as deleting back
  // into one does: otherwise the next key would be entered as a plain value in
  // the middle of a tuplet.
  const last = entries[entries.length - 1]
  const inside = last?.tuplet !== undefined && draftTicks(draft) % TICKS_PER_BEAT !== 0
  return inside ? { ...draft, tuplet: last.tuplet as number } : draft
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

interface Placed {
  entry: DraftEntry
  /** Ticks from the start of the phrase, not from the entry's own barline. */
  at: number
  ticks: number
}

/** Where each entry starts, measured from the start of the phrase. */
function positions(draft: BarDraft): Placed[] {
  const placed: Placed[] = []
  let at = 0

  for (const entry of draft.entries) {
    const ticks = entryTicks(entry)
    if (ticks === undefined) continue
    placed.push({ entry, at, ticks })
    at += ticks
  }

  return placed
}

/** How much of the answer has been typed. */
export function draftTicks(draft: BarDraft): number {
  return draft.entries.reduce((total, entry) => total + (entryTicks(entry) ?? 0), 0)
}

/** Ticks in the whole answer, across every bar of it. */
export function totalTicks(draft: BarDraft): number {
  return ticksPerMeasure(draft.meter) * draft.bars
}

export function isFull(draft: BarDraft): boolean {
  return draftTicks(draft) === totalTicks(draft)
}

/** Which bar is being written into. */
export function currentBar(draft: BarDraft): number {
  return Math.floor(draftTicks(draft) / ticksPerMeasure(draft.meter))
}

/** The impacts the draft says — the whole of what its rhythm is graded on. */
export function draftPhrase(draft: BarDraft): Phrase {
  const perBar = ticksPerMeasure(draft.meter)
  const bars: number[][] = Array.from({ length: draft.bars }, () => [])

  for (const placed of positions(draft)) {
    if (placed.entry.kind !== 'note') continue
    const bar = Math.floor(placed.at / perBar)
    bars[bar]?.push(placed.at - bar * perBar)
  }

  return { meter: draft.meter, bars }
}

/**
 * The notes the draft says, in the order they sound.
 *
 * One per impact, which is what makes them line up with `draftPhrase` — a rest
 * has no pitch and contributes nothing to either.
 */
export function draftPitches(draft: BarDraft): readonly Pitch[] {
  return draft.entries.flatMap((entry) =>
    entry.kind === 'note' && entry.pitch !== undefined ? [entry.pitch] : [],
  )
}

/** The barline after a tick — the one boundary a written value may never cross. */
function nextBarline(draft: BarDraft, at: number): number {
  const perBar = ticksPerMeasure(draft.meter)
  return (Math.floor(at / perBar) + 1) * perBar
}

/**
 * Whether a key may be pressed.
 *
 * A plain value may run over a beat — that is what a half note is — but never
 * over a **barline**. That is the rule `maxDurationAt` states for spelling, and
 * holding the keyboard to it is what means no answer ever needs a tie: a sound
 * that carries into the next bar is written as a note and then a rest, which is
 * what a single bar already does for any gap one value cannot span.
 *
 * A tuplet value may not leave its own beat either, since a bracket has to
 * close where it opened.
 */
export function canAppend(
  draft: BarDraft,
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
  if (at >= totalTicks(draft)) return false

  if (draft.tuplet === undefined) return at + ticks <= nextBarline(draft, at)

  const beatEnd = (Math.floor(at / TICKS_PER_BEAT) + 1) * TICKS_PER_BEAT
  return at + ticks <= beatEnd
}

/** Whether a tuplet may be started here: only on an untouched beat. */
export function canArm(draft: BarDraft): boolean {
  return !isFull(draft) && draftTicks(draft) % TICKS_PER_BEAT === 0
}

/** Whether backspace has anything left to take. */
export function canRemove(draft: BarDraft): boolean {
  return draft.entries.length > draft.locked
}

/** Set or clear the bracket, with no questions asked. */
function setTuplet(draft: BarDraft, division: number | undefined): BarDraft {
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
export function arm(draft: BarDraft, division: number | undefined): BarDraft {
  if (division !== undefined && !canArm(draft)) return draft
  return setTuplet(draft, division)
}

export function append(
  draft: BarDraft,
  value: { kind: 'note' | 'rest'; dur: NoteValue; dots: 0 | 1; pitch?: Pitch },
): BarDraft {
  if (!canAppend(draft, value)) return draft

  const entry: DraftEntry = {
    ...value,
    ...(draft.tuplet === undefined ? {} : { tuplet: draft.tuplet }),
  }
  const entries = [...draft.entries, entry]
  const next: BarDraft = { ...draft, entries }

  // A bracket closes as soon as its beat is exactly full, so the next key is a
  // plain one again without anyone having to switch back.
  return draftTicks(next) % TICKS_PER_BEAT === 0 ? setTuplet(next, undefined) : next
}

/**
 * Take back the last key.
 *
 * Never past the locked prefix, and if that lands back inside an unfinished
 * tuplet the tuplet is armed again — otherwise the next key would be entered
 * as a plain value in the middle of a bracket.
 */
export function removeLast(draft: BarDraft): BarDraft {
  if (!canRemove(draft)) return setTuplet(draft, undefined)

  const entries = draft.entries.slice(0, -1)
  const trimmed: BarDraft = { ...draft, entries }
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
 * One list of nodes per bar, always as many lists as the answer has bars: a bar
 * that has not been reached yet is an empty list rather than a missing one, so
 * it still holds its width on the page and the notes already written stay put.
 *
 * Consecutive entries sharing a bracket become one tuplet; everything else is
 * beamed by the beat, the same way a generated bar is.
 */
export function draftNodes(draft: BarDraft): RhythmNode[][] {
  const perBar = ticksPerMeasure(draft.meter)
  const byBar: Placed[][] = Array.from({ length: draft.bars }, () => [])

  for (const placed of positions(draft)) {
    // An entry cannot cross a barline, so it belongs wholly to one bar and its
    // position within that bar is what the spelling is built from.
    const bar = Math.floor(placed.at / perBar)
    byBar[bar]?.push({ ...placed, at: placed.at - bar * perBar })
  }

  return byBar.map((placed) => barNodes(draft.meter, placed))
}

function barNodes(meter: TimeSignature, placed: readonly Placed[]): RhythmNode[] {
  const nodes: RhythmNode[] = []
  let plain: RhythmSymbol[] = []

  const flushPlain = () => {
    if (plain.length > 0) nodes.push(...beamedByBeat(meter, plain))
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
      run.push(toSymbol(placed[index] as Placed))
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

function toSymbol({ entry, at, ticks }: Placed): RhythmSymbol {
  return { kind: entry.kind, dur: entry.dur, dots: entry.dots, at, ticks }
}

/**
 * The entries a spelling opens with, down to and including its first note.
 *
 * What melodic dictation gives away. Taken from `notateRhythm`'s own output
 * rather than worked out again, so the note that is shown is exactly the note
 * the finished answer would have been spelled with — a hint that disagreed
 * with the answer would be worse than no hint.
 *
 * Only as far as the first note: the rests that follow it say how long the gap
 * to the *second* note is, which is a thing to hear rather than a thing to be
 * told.
 */
export function leadingEntries(
  nodes: readonly RhythmNode[],
  pitch?: Pitch,
): DraftEntry[] {
  const entries: DraftEntry[] = []

  const walk = (list: readonly RhythmNode[], tuplet: number | undefined): boolean => {
    for (const node of list) {
      if (node.kind === 'beam') {
        if (walk(node.children, tuplet)) return true
        continue
      }
      if (node.kind === 'tuplet') {
        if (walk(node.children, node.num)) return true
        continue
      }

      entries.push({
        kind: node.kind,
        dur: node.dur,
        dots: node.dots,
        ...(tuplet === undefined ? {} : { tuplet }),
        ...(node.kind === 'note' && pitch !== undefined ? { pitch } : {}),
      })
      if (node.kind === 'note') return true
    }
    return false
  }

  return walk(nodes, undefined) ? entries : []
}
