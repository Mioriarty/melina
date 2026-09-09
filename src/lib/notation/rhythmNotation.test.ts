import { describe, expect, it } from 'vitest'

import {
  TICKS_PER_BEAT,
  maxDurationAt,
  ticksPerMeasure,
  type TimeSignature,
} from '@/lib/music/meter'
import { onsetsInBeat, type Rhythm } from '@/lib/music/rhythm'
import { RHYTHM_CELLS, cellTicks, startsSilent } from '@/lib/music/rhythmCells'
import { createRandom, randomPick } from '@/lib/utils/seededRandom'

import {
  fillsMeasure,
  notateRhythm,
  notatedTicks,
  onsetsOf,
  type RhythmNode,
  type RhythmSymbol,
} from './rhythmNotation'

const FOUR_FOUR: TimeSignature = { beats: 4, unit: 4 }
const THREE_FOUR: TimeSignature = { beats: 3, unit: 4 }
const FIVE_FOUR: TimeSignature = { beats: 5, unit: 4 }

function rhythm(onsets: readonly number[], meter = FOUR_FOUR): Rhythm {
  return { meter, onsets }
}

/** A readable spelling, so a failure says what was drawn rather than a tree. */
const VALUE_NAMES: Record<string, string> = {
  '1|0': 'whole',
  '1|1': 'whole.',
  '2|0': 'half',
  '2|1': 'half.',
  '4|0': 'quarter',
  '4|1': 'quarter.',
  '8|0': 'eighth',
  '8|1': 'eighth.',
  '16|0': '16th',
}

function spell(node: RhythmNode): string {
  if (node.kind === 'beam') return `[${node.children.map(spell).join(' ')}]`
  if (node.kind === 'tuplet') {
    return `${node.num}:${node.numbase}(${node.children.map(spell).join(' ')})`
  }
  return `${node.kind === 'rest' ? 'r-' : ''}${VALUE_NAMES[`${node.dur}|${node.dots}`]}`
}

function spelling(value: Rhythm): string {
  return notateRhythm(value).map(spell).join(' ')
}

/** Every symbol in a spelling, in the order it is drawn. */
function symbols(nodes: readonly RhythmNode[]): RhythmSymbol[] {
  return nodes.flatMap((node) =>
    node.kind === 'beam' || node.kind === 'tuplet' ? symbols(node.children) : [node],
  )
}

/** Whether a symbol is drawn inside a bracket. */
function tupletSymbols(nodes: readonly RhythmNode[]): RhythmSymbol[] {
  return nodes.flatMap((node) =>
    node.kind === 'tuplet'
      ? symbols(node.children)
      : node.kind === 'beam'
        ? tupletSymbols(node.children)
        : [],
  )
}

/* -------------------------------------------------------------- spellings */

describe('spelling a rhythm', () => {
  it('writes one impact in a bar as one note filling it', () => {
    expect(spelling(rhythm([0]))).toBe('whole')
    expect(spelling(rhythm([0], THREE_FOUR))).toBe('half.')
  })

  it('writes an empty bar as silence, not as nothing', () => {
    // A bar has to be full to be engraved at all; an empty layer would render
    // a measure with no contents and no width.
    expect(spelling(rhythm([]))).toBe('r-whole')
    expect(fillsMeasure(FOUR_FOUR, notateRhythm(rhythm([])))).toBe(true)
  })

  it('lets a bar open with silence', () => {
    expect(spelling(rhythm([60, 120, 180]))).toBe('r-quarter quarter quarter quarter')
  })

  it('reaches a dot when the metre allows one', () => {
    // From the downbeat the ceiling is the whole bar, so the gap decides.
    expect(spelling(rhythm([0, 90, 120, 180]))).toBe('quarter. eighth quarter quarter')
  })

  it('refuses a dot that would cross a stronger beat', () => {
    // The documented consequence of the strict hierarchy: a dotted quarter on
    // beat 2 of 4/4 would cross the half bar, which is stronger than the beat
    // it starts on, so the gap is spelled as a note plus a rest instead.
    expect(spelling(rhythm([0, 60, 150]))).toBe(
      'quarter quarter r-eighth eighth r-quarter',
    )
  })

  it('beams by the beat, and never across one', () => {
    expect(spelling(rhythm([0, 30, 60, 90, 120, 150, 180, 210]))).toBe(
      '[eighth eighth] [eighth eighth] [eighth eighth] [eighth eighth]',
    )
    expect(spelling(rhythm([0, 15, 30, 45, 60, 120, 180]))).toBe(
      '[16th 16th 16th 16th] quarter quarter quarter',
    )
  })

  it('beams a dotted eighth to its sixteenth', () => {
    expect(spelling(rhythm([0, 45, 60, 120, 180]))).toBe(
      '[eighth. 16th] quarter quarter quarter',
    )
  })

  it('leaves a lone flagged note its flag', () => {
    // A beam of one is not a beam.
    const nodes = notateRhythm(rhythm([0, 30, 60, 120, 180]))
    expect(nodes.map(spell).join(' ')).toBe('[eighth eighth] quarter quarter quarter')
    expect(spelling(rhythm([0, 90, 120, 180]))).toContain('eighth')
    expect(spelling(rhythm([0, 90, 120, 180]))).not.toContain('[')
  })
})

/* ---------------------------------------------------------------- tuplets */

describe('tuplets', () => {
  it('writes a triplet as three eighths in the space of two', () => {
    expect(spelling(rhythm([0, 20, 40, 60, 120, 180]))).toBe(
      '3:2([eighth eighth eighth]) quarter quarter quarter',
    )
  })

  it('writes a quintuplet as five sixteenths in the space of four', () => {
    expect(spelling(rhythm([0, 12, 24, 36, 48, 60, 120, 180]))).toBe(
      '5:4([16th 16th 16th 16th 16th]) quarter quarter quarter',
    )
  })

  it('writes an uneven triplet in the values it borrows', () => {
    expect(spelling(rhythm([0, 40, 60, 120, 180]))).toBe(
      '3:2(quarter eighth) quarter quarter quarter',
    )
    expect(spelling(rhythm([0, 20, 60, 120, 180]))).toBe(
      '3:2(eighth quarter) quarter quarter quarter',
    )
  })

  it('closes a bracket at its own beat rather than running past it', () => {
    // Without ties a tuplet cannot reach into the next beat, so the note is
    // stopped at the barline of its beat and the next one opens with a rest.
    // The impacts are untouched, which is all that is graded.
    expect(spelling(rhythm([0, 20, 40, 120, 180]))).toBe(
      '3:2([eighth eighth eighth]) r-quarter quarter quarter',
    )
    expect(onsetsOf(notateRhythm(rhythm([0, 20, 40, 120, 180])))).toEqual([
      0, 20, 40, 120, 180,
    ])
  })

  it('does not bracket a beat that only happens to come from a triplet cell', () => {
    // Division 3 struck on its first part only is a quarter note and nothing
    // else — the question is about the impacts, not where they came from.
    expect(spelling(rhythm([0, 60, 120, 180]))).not.toContain(':')
  })
})

/* ------------------------------------------------------------- properties */

/**
 * Bars assembled the way the generator assembles them, so the properties below
 * cover exactly what the exercise can actually ask.
 */
function everyCellBar(meter: TimeSignature): Rhythm[] {
  const random = createRandom(20260909)
  const bars: Rhythm[] = []

  // Every cell, in every beat, against a plain background.
  for (const cell of RHYTHM_CELLS) {
    for (let beat = 0; beat < meter.beats; beat += 1) {
      const onsets = new Set<number>()
      for (let other = 0; other < meter.beats; other += 1) {
        if (other === beat) cellTicks(cell, other).forEach((tick) => onsets.add(tick))
        else onsets.add(other * TICKS_PER_BEAT)
      }
      bars.push({ meter, onsets: [...onsets].sort((a, b) => a - b) })
    }
  }

  // And a pile of random combinations, which is where the awkward pairings are.
  for (let seed = 0; seed < 400; seed += 1) {
    const onsets: number[] = []
    for (let beat = 0; beat < meter.beats; beat += 1) {
      const cell = randomPick(random, RHYTHM_CELLS as [(typeof RHYTHM_CELLS)[number]])
      onsets.push(...cellTicks(cell, beat))
    }
    bars.push({ meter, onsets: [...new Set(onsets)].sort((a, b) => a - b) })
  }

  return bars
}

const ALL_BARS = [FOUR_FOUR, THREE_FOUR, FIVE_FOUR].flatMap(everyCellBar)

describe('the round trip', () => {
  it('has bars to check', () => {
    expect(ALL_BARS.length).toBeGreaterThan(1000)
  })

  it('reads back exactly the impacts that went in', () => {
    // The guard the whole spelling rests on, and the reason grading can ignore
    // note values: however a rhythm is spelled, it still says the same thing.
    for (const bar of ALL_BARS) {
      expect(onsetsOf(notateRhythm(bar)), `${bar.meter.beats}/4 ${bar.onsets}`).toEqual([
        ...bar.onsets,
      ])
    }
  })

  it('fills every bar exactly', () => {
    // Short of a full bar Verovio engraves a measure that is missing time, and
    // over it the barline lands in the wrong place.
    for (const bar of ALL_BARS) {
      expect(notatedTicks(notateRhythm(bar)), `${bar.meter.beats}/4 ${bar.onsets}`).toBe(
        ticksPerMeasure(bar.meter),
      )
    }
  })

  it('never writes a note longer than the metre allows', () => {
    for (const bar of ALL_BARS) {
      const nodes = notateRhythm(bar)
      const bracketed = new Set(tupletSymbols(nodes))

      for (const symbol of symbols(nodes)) {
        // Inside a bracket the value drawn is borrowed, so the cap does not
        // apply to it — the bracket is its boundary instead.
        if (bracketed.has(symbol)) continue
        expect(
          symbol.ticks,
          `${bar.meter.beats}/4 ${bar.onsets} @ ${symbol.at}`,
        ).toBeLessThanOrEqual(maxDurationAt(bar.meter, symbol.at))
      }
    }
  })

  it('never lets a bracket cross the beat it belongs to', () => {
    for (const bar of ALL_BARS) {
      for (const node of notateRhythm(bar)) {
        if (node.kind !== 'tuplet') continue
        const inside = symbols(node.children)
        const start = inside[0]?.at ?? 0
        const total = inside.reduce((sum, symbol) => sum + symbol.ticks, 0)
        expect(start % TICKS_PER_BEAT, `${bar.onsets}`).toBe(0)
        expect(total, `${bar.onsets}`).toBe(TICKS_PER_BEAT)
      }
    }
  })

  it('draws every impact as a note, and never invents one', () => {
    for (const bar of ALL_BARS) {
      const drawn = symbols(notateRhythm(bar)).filter((symbol) => symbol.kind === 'note')
      expect(drawn.length, `${bar.onsets}`).toBe(bar.onsets.length)
    }
  })

  it('leaves no gap and no overlap between symbols', () => {
    for (const bar of ALL_BARS) {
      let at = 0
      for (const symbol of symbols(notateRhythm(bar))) {
        expect(symbol.at, `${bar.meter.beats}/4 ${bar.onsets}`).toBe(at)
        at += symbol.ticks
      }
    }
  })
})

describe('cells that start in silence', () => {
  it('spell as a rest when nothing is already sounding', () => {
    // `hold` and the off-beat cells have no impact on the beat, so the bar has
    // to open with silence rather than with a note nobody struck.
    for (const cell of RHYTHM_CELLS.filter(startsSilent)) {
      const bar = rhythm(cellTicks(cell, 0).concat([60, 120, 180]))
      const [first] = symbols(notateRhythm(bar))
      expect(first?.kind, cell.id).toBe('rest')
    }
  })

  it('keeps onsetsInBeat and the spelling in agreement', () => {
    for (const bar of ALL_BARS.slice(0, 200)) {
      const drawn = symbols(notateRhythm(bar)).filter((s) => s.kind === 'note')
      for (let beat = 0; beat < bar.meter.beats; beat += 1) {
        const expected = onsetsInBeat(bar, beat).map((o) => o + beat * TICKS_PER_BEAT)
        const actual = drawn
          .filter(
            (s) => s.at >= beat * TICKS_PER_BEAT && s.at < (beat + 1) * TICKS_PER_BEAT,
          )
          .map((s) => s.at)
        expect(actual, `beat ${beat} of ${bar.onsets}`).toEqual(expected)
      }
    }
  })
})
