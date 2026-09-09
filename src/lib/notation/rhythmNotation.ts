import {
  TICKS_PER_BEAT,
  maxDurationAt,
  ticksPerMeasure,
  type TimeSignature,
} from '@/lib/music/meter'
import { onsetsInBeat, type Rhythm } from '@/lib/music/rhythm'

/**
 * Turning impacts into note values — the half of a rhythm that is a spelling
 * rather than a fact.
 *
 * `lib/music/rhythm.ts` holds the other half: a rhythm *is* its impacts,
 * because a snare drum hit has no audible length. So nothing decided here is
 * ever graded. What it has to be instead is **readable and stable**: the same
 * impacts must always spell the same way, and reading the impacts back off the
 * spelling must return exactly what went in. `rhythmNotation.test.ts` asserts
 * that round trip over every rhythm the generator can produce, which is the
 * same trick `modeOf` plays on the scale generator.
 *
 * There are no ties. That is affordable only because tuplets are beat-local —
 * see `rhythmCells.ts` — and it is what keeps the keyboard down to a row of
 * note values.
 */

/** MEI `@dur`: 1 is a whole note, 16 a sixteenth. */
export type NoteValue = 1 | 2 | 4 | 8 | 16

export interface RhythmSymbol {
  kind: 'note' | 'rest'
  dur: NoteValue
  dots: 0 | 1
  /** Ticks from the barline. */
  at: number
  /** Real ticks it occupies — inside a tuplet, less than it looks. */
  ticks: number
}

export interface RhythmBeam {
  kind: 'beam'
  children: readonly RhythmNode[]
}

export interface RhythmTuplet {
  kind: 'tuplet'
  /** `3` in the space of `2`. */
  num: number
  numbase: number
  children: readonly RhythmNode[]
}

export type RhythmNode = RhythmSymbol | RhythmBeam | RhythmTuplet

/**
 * Every value that can be written as one symbol, longest first.
 *
 * There is no dotted sixteenth: it is 22.5 ticks, and every impact is a whole
 * number of them, so no gap can ever call for one.
 */
const VALUES: readonly { dur: NoteValue; dots: 0 | 1; ticks: number }[] = [
  { dur: 1, dots: 1, ticks: TICKS_PER_BEAT * 6 },
  { dur: 1, dots: 0, ticks: TICKS_PER_BEAT * 4 },
  { dur: 2, dots: 1, ticks: TICKS_PER_BEAT * 3 },
  { dur: 2, dots: 0, ticks: TICKS_PER_BEAT * 2 },
  { dur: 4, dots: 1, ticks: TICKS_PER_BEAT * 1.5 },
  { dur: 4, dots: 0, ticks: TICKS_PER_BEAT },
  { dur: 8, dots: 1, ticks: TICKS_PER_BEAT * 0.75 },
  { dur: 8, dots: 0, ticks: TICKS_PER_BEAT / 2 },
  { dur: 16, dots: 0, ticks: TICKS_PER_BEAT / 4 },
]

/** The shortest value there is, below which nothing can be drawn. */
const SHORTEST = TICKS_PER_BEAT / 4

function largestValueWithin(ticks: number): (typeof VALUES)[number] | undefined {
  return VALUES.find((value) => value.ticks <= ticks)
}

/** Every value that can be written, shortest first — the keyboard's row. */
export const NOTE_VALUES: readonly NoteValue[] = [16, 8, 4, 2, 1]

/**
 * How long a written value lasts, in ticks. `undefined` for a dotted
 * sixteenth, which is 22.5 ticks and so cannot be written on this grid.
 */
export function valueTicks(dur: NoteValue, dots: 0 | 1): number | undefined {
  return VALUES.find((value) => value.dur === dur && value.dots === dots)?.ticks
}

/** Whether a value takes a flag, and so can be beamed to its neighbours. */
function isFlagged(symbol: RhythmSymbol): boolean {
  return symbol.dur >= 8
}

/* ------------------------------------------------------------------ filling

   The rule, from the top: a note lasts until the next impact, but never longer
   than the metre allows it to (`maxDurationAt`), and never longer than a value
   that actually exists. Whatever is left over after that is rests, filled the
   same way — which is the part the plain "place the longest note that fits"
   version leaves undefined. */

function fill(
  meter: TimeSignature,
  from: number,
  to: number,
  lead: 'note' | 'rest',
): RhythmSymbol[] {
  const symbols: RhythmSymbol[] = []
  let at = from
  let first = true

  while (at < to) {
    const cap = Math.min(to - at, maxDurationAt(meter, at))
    const value = largestValueWithin(cap)
    // Unreachable for impacts on the grid, where every span is a multiple of a
    // sixteenth. A corrupt row loses its spelling here rather than looping.
    if (value === undefined) break

    symbols.push({
      kind: first && lead === 'note' ? 'note' : 'rest',
      dur: value.dur,
      dots: value.dots,
      at,
      ticks: value.ticks,
    })
    at += value.ticks
    first = false
  }

  return symbols
}

/**
 * How to fill a stretch with symbols that are drawn as nothing at all.
 *
 * The unentered end of a half-typed bar. Padding it keeps the measure's
 * duration constant while it is being filled in, which is what stops the notes
 * already on screen from re-spacing under the player's hands — see
 * `rhythmMei`.
 */
export function padding(
  meter: TimeSignature,
  from: number,
  to: number,
): readonly RhythmSymbol[] {
  return fill(meter, from, to, 'rest')
}

/** A stretch of plain, un-bracketed beats, with the impacts that fall in it. */
function fillRun(rhythm: Rhythm, from: number, to: number): RhythmSymbol[] {
  const points = rhythm.onsets.filter((tick) => tick >= from && tick < to)
  const [firstPoint] = points

  if (firstPoint === undefined) return fill(rhythm.meter, from, to, 'rest')

  return [
    // A bar — or a stretch of one — may open with silence.
    ...(firstPoint > from ? fill(rhythm.meter, from, firstPoint, 'rest') : []),
    ...points.flatMap((point, index) =>
      fill(rhythm.meter, point, points[index + 1] ?? to, 'note'),
    ),
  ]
}

/* ------------------------------------------------------------------ tuplets

   A tuplet is written in the units it borrows: three triplet eighths are drawn
   as three eighths and told to fit the space of two. So the beat is filled a
   second time in that borrowed space, and each symbol carries its *real* tick
   length alongside the value it is drawn as. */

/** The tuplet a beat needs, or `undefined` when it sits on the plain grid. */
function tupletDivision(offsets: readonly number[]): number | undefined {
  if (offsets.every((offset) => offset % SHORTEST === 0)) return undefined

  return [3, 5, 6].find((division) =>
    offsets.every((offset) => offset % (TICKS_PER_BEAT / division) === 0),
  )
}

/** 3 in the space of 2, 5 in the space of 4 — the next power of two down. */
export function borrowedFrom(division: number): number {
  return 1 << Math.floor(Math.log2(division))
}

function fillTuplet(rhythm: Rhythm, beat: number, division: number): RhythmTuplet {
  const unit = TICKS_PER_BEAT / division
  const numbase = borrowedFrom(division)
  const writtenUnit = TICKS_PER_BEAT / numbase
  const start = beat * TICKS_PER_BEAT

  const slots = onsetsInBeat(rhythm, beat).map((offset) => offset / unit)
  const symbols: RhythmSymbol[] = []

  /** Fill `[fromSlot, toSlot)` of the tuplet, in the space it borrows. */
  const span = (fromSlot: number, toSlot: number, lead: 'note' | 'rest') => {
    let slot = fromSlot
    let first = true

    while (slot < toSlot) {
      // No metric cap inside a tuplet: the bracket is the boundary, and the
      // generator never lets one run past its own beat.
      const value = largestValueWithin((toSlot - slot) * writtenUnit)
      if (value === undefined) break

      symbols.push({
        kind: first && lead === 'note' ? 'note' : 'rest',
        dur: value.dur,
        dots: value.dots,
        at: start + slot * unit,
        ticks: (value.ticks / writtenUnit) * unit,
      })
      slot += value.ticks / writtenUnit
      first = false
    }
  }

  const [firstSlot] = slots
  if (firstSlot === undefined || firstSlot > 0) span(0, firstSlot ?? division, 'rest')
  for (const [index, slot] of slots.entries()) {
    span(slot, slots[index + 1] ?? division, 'note')
  }

  return { kind: 'tuplet', num: division, numbase, children: beamed(symbols) }
}

/* ------------------------------------------------------------------ beaming

   Beams are drawn per beat, which is what makes a bar readable at a glance:
   the eye counts beams rather than noteheads. Flags are left on anything that
   would beam alone. */

export function beamed(symbols: readonly RhythmSymbol[]): RhythmNode[] {
  const nodes: RhythmNode[] = []
  let run: RhythmSymbol[] = []

  const flush = () => {
    // A rest may sit *inside* a beam but never start or end one, so the ones
    // hanging off either end come back out and are drawn on their own.
    const trailing: RhythmSymbol[] = []
    while (run.length > 0 && run[run.length - 1]?.kind === 'rest') {
      trailing.unshift(run.pop() as RhythmSymbol)
    }
    const leading: RhythmSymbol[] = []
    while (run.length > 0 && run[0]?.kind === 'rest') {
      leading.push(run.shift() as RhythmSymbol)
    }

    nodes.push(...leading)
    // A lone flagged note keeps its flag rather than becoming a beam of one.
    if (run.filter((symbol) => symbol.kind === 'note').length >= 2) {
      nodes.push({ kind: 'beam', children: run })
    } else {
      nodes.push(...run)
    }
    nodes.push(...trailing)
    run = []
  }

  for (const symbol of symbols) {
    if (isFlagged(symbol)) {
      run.push(symbol)
    } else {
      flush()
      nodes.push(symbol)
    }
  }
  flush()

  return nodes
}

/** Beam within each beat, never across one. */
export function beamedByBeat(
  meter: TimeSignature,
  symbols: readonly RhythmSymbol[],
): RhythmNode[] {
  const nodes: RhythmNode[] = []

  for (let beat = 0; beat < meter.beats; beat += 1) {
    const start = beat * TICKS_PER_BEAT
    const inBeat = symbols.filter(
      (symbol) => symbol.at >= start && symbol.at < start + TICKS_PER_BEAT,
    )
    if (inBeat.length > 0) nodes.push(...beamed(inBeat))
  }

  return nodes
}

/**
 * Spell a rhythm.
 *
 * Plain beats are filled in runs, so a note can still stretch across several
 * of them into a half or a whole note; a tuplet beat is filled on its own,
 * because a bracket cannot be left half open.
 */
export function notateRhythm(rhythm: Rhythm): RhythmNode[] {
  const { meter } = rhythm
  const nodes: RhythmNode[] = []
  let runStart = 0

  const closeRun = (upTo: number) => {
    if (upTo <= runStart) return
    const symbols = fillRun(rhythm, runStart * TICKS_PER_BEAT, upTo * TICKS_PER_BEAT)
    nodes.push(...beamedByBeat(meter, symbols))
  }

  for (let beat = 0; beat <= meter.beats; beat += 1) {
    const division =
      beat === meter.beats ? undefined : tupletDivision(onsetsInBeat(rhythm, beat))

    if (beat === meter.beats || division !== undefined) {
      closeRun(beat)
      if (division !== undefined) nodes.push(fillTuplet(rhythm, beat, division))
      runStart = beat + 1
    }
  }

  return nodes
}

/**
 * Read the impacts back off a spelling.
 *
 * The inverse the round-trip test needs, and how a half-typed bar reports what
 * it says so far.
 */
export function onsetsOf(nodes: readonly RhythmNode[]): number[] {
  return nodes
    .flatMap((node) =>
      node.kind === 'beam' || node.kind === 'tuplet'
        ? onsetsOf(node.children)
        : node.kind === 'note'
          ? [node.at]
          : [],
    )
    .sort((a, b) => a - b)
}

/** How much of a bar a spelling accounts for, in real ticks. */
export function notatedTicks(nodes: readonly RhythmNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total +
      (node.kind === 'beam' || node.kind === 'tuplet'
        ? notatedTicks(node.children)
        : node.ticks),
    0,
  )
}

/** Whether a spelling fills its bar exactly. */
export function fillsMeasure(
  meter: TimeSignature,
  nodes: readonly RhythmNode[],
): boolean {
  return notatedTicks(nodes) === ticksPerMeasure(meter)
}
