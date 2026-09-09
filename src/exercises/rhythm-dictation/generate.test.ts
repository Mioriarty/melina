import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT, meterKey, ticksPerMeasure } from '@/lib/music/meter'
import { isValidRhythm, onsetsInBeat, rhythmDivision } from '@/lib/music/rhythm'
import { CELL_GROUP_IDS, NO_CELLS } from '@/lib/music/rhythmCells'
import { notateRhythm, onsetsOf } from '@/lib/notation/rhythmNotation'
import { createRandom } from '@/lib/utils/seededRandom'

import { generateRound, type RhythmRoundSpec } from './generate'
import { DEFAULT_SETTINGS } from './settings'

const SEEDS = [1, 2, 3, 7, 11, 101]

function spec(overrides: Partial<RhythmRoundSpec> = {}): RhythmRoundSpec {
  return { ...DEFAULT_SETTINGS, questionsPerRound: 20, ...overrides }
}

function everyQuestion(value: RhythmRoundSpec) {
  return SEEDS.flatMap((seed) => generateRound(createRandom(seed), value))
}

describe('generateRound', () => {
  it('fills the round it was asked for', () => {
    for (const seed of SEEDS) {
      expect(generateRound(createRandom(seed), spec()).length).toBe(20)
    }
  })

  it('generates nothing rather than something wrong when nothing is allowed', () => {
    // An empty round leaves the player on the level screen, which is far
    // better than dropping them into a round with no questions in it.
    expect(generateRound(createRandom(1), spec({ cellWeights: NO_CELLS }))).toEqual([])
    expect(generateRound(createRandom(1), spec({ meters: [] }))).toEqual([])
    expect(generateRound(createRandom(1), spec({ meters: ['6/8'] }))).toEqual([])
  })

  it('asks only the meters the level allows', () => {
    const meters = ['3/4', '5/4']
    for (const question of everyQuestion(spec({ meters }))) {
      expect(meters).toContain(meterKey(question.rhythm.meter))
    }
  })

  it('deals the meters evenly rather than leaving one out', () => {
    const meters = ['2/4', '3/4', '4/4']
    const asked = new Set(
      generateRound(createRandom(5), spec({ meters, questionsPerRound: 20 })).map(
        (question) => meterKey(question.rhythm.meter),
      ),
    )
    expect([...asked].sort()).toEqual(meters)
  })

  it('carries the tempo and the click through to the question', () => {
    for (const question of everyQuestion(spec({ tempo: 100, metronome: 'throughout' }))) {
      expect(question.tempo).toBe(100)
      expect(question.metronome).toBe('throughout')
    }
  })
})

describe('every bar it builds', () => {
  const ALL = CELL_GROUP_IDS.reduce((weights, group) => ({ ...weights, [group]: 2 }), {
    ...NO_CELLS,
  })

  const WIDE = spec({
    meters: ['2/4', '3/4', '4/4', '5/4', '6/4'],
    cellWeights: ALL,
    allowInitialRest: true,
    questionsPerRound: 30,
  })

  const questions = everyQuestion(WIDE)

  it('has bars to check', () => {
    expect(questions.length).toBeGreaterThan(100)
  })

  it('stays inside its bar, ascending and on whole ticks', () => {
    for (const { rhythm } of questions) {
      expect(isValidRhythm(rhythm), `${rhythm.onsets}`).toBe(true)
    }
  })

  it('can be written down and read back unchanged', () => {
    // The join between the generator and the engraver: a bar that cannot be
    // spelled, or that spells to different impacts, would be unanswerable.
    for (const { rhythm } of questions) {
      expect(onsetsOf(notateRhythm(rhythm)), `${rhythm.onsets}`).toEqual([
        ...rhythm.onsets,
      ])
    }
  })

  it('never leaves a tuplet without a downbeat after it', () => {
    // A tuplet whose last note runs past its own beat would need a tie, and
    // there are none. The engraver would cut the note short; the sound and the
    // spelling should agree instead.
    for (const { rhythm } of questions) {
      for (let beat = 0; beat < rhythm.meter.beats - 1; beat += 1) {
        const inBeat = onsetsInBeat(rhythm, beat)
        const isTuplet = inBeat.some((offset) => offset % (TICKS_PER_BEAT / 4) !== 0)
        if (!isTuplet) continue

        expect(rhythm.onsets, `tuplet in beat ${beat} of ${rhythm.onsets}`).toContain(
          (beat + 1) * TICKS_PER_BEAT,
        )
      }
    }
  })
})

describe('what a level bounds', () => {
  it('offers only the divisions it switched on', () => {
    const cases = [
      { weights: { ...NO_CELLS, quarter: 5, hold: 1 }, expected: ['quarter'] },
      {
        weights: { ...NO_CELLS, quarter: 3, eighth: 5 },
        expected: ['quarter', 'eighth'],
      },
      {
        weights: { ...NO_CELLS, quarter: 3, triplet: 5 },
        expected: ['quarter', 'triplet'],
      },
    ]

    for (const { weights, expected } of cases) {
      for (const { rhythm } of everyQuestion(spec({ cellWeights: weights }))) {
        expect(expected, `${rhythm.onsets}`).toContain(rhythmDivision(rhythm))
      }
    }
  })

  it('keeps a bar off its own downbeat only when told it may', () => {
    for (const { rhythm } of everyQuestion(spec({ allowInitialRest: false }))) {
      expect(rhythm.onsets[0], `${rhythm.onsets}`).toBe(0)
    }

    const open = everyQuestion(
      spec({
        allowInitialRest: true,
        cellWeights: { ...NO_CELLS, quarter: 1, hold: 1, offbeat: 6 },
      }),
    )
    expect(open.some(({ rhythm }) => rhythm.onsets[0] !== 0)).toBe(true)
  })

  it('always puts enough in a bar to be worth hearing', () => {
    // A level weighted towards held notes can draw an almost empty bar, and a
    // round of those is silence with a barline.
    for (const minOnsets of [1, 3, 4]) {
      const held = spec({
        minOnsets,
        cellWeights: { ...NO_CELLS, quarter: 1, hold: 9 },
      })
      for (const { rhythm } of everyQuestion(held)) {
        expect(
          rhythm.onsets.length,
          `min ${minOnsets}: ${rhythm.onsets}`,
        ).toBeGreaterThanOrEqual(minOnsets)
      }
    }
  })

  it('fills a bar no further than one impact per beat can reach', () => {
    // Asking for more impacts than the level's own cells can spell is a level
    // to fix, not a bar to fake: filling the gap with eighths would put a
    // subdivision on the page that the level had switched off.
    const impossible = spec({
      minOnsets: 5,
      cellWeights: { ...NO_CELLS, quarter: 1, hold: 9 },
    })

    for (const { rhythm } of everyQuestion(impossible)) {
      expect(rhythm.onsets, `${rhythm.onsets}`).toEqual([0, 60, 120, 180])
      expect(rhythmDivision(rhythm)).toBe('quarter')
    }
  })

  it('does not pad a bar past its own length', () => {
    for (const { rhythm } of everyQuestion(spec({ meters: ['2/4'], minOnsets: 2 }))) {
      const last = rhythm.onsets[rhythm.onsets.length - 1] ?? 0
      expect(last).toBeLessThan(ticksPerMeasure(rhythm.meter))
    }
  })
})

describe('determinism', () => {
  it('gives the same round for the same seed', () => {
    const one = generateRound(createRandom(99), spec())
    const two = generateRound(createRandom(99), spec())
    expect(JSON.stringify(one)).toBe(JSON.stringify(two))
  })
})
