import { describe, expect, it } from 'vitest'

import { TICKS_PER_BEAT } from '@/lib/music/meter'
import { phraseOnsets } from '@/lib/music/phrase'
import { chromaticValue } from '@/lib/music/pitch'
import { NO_CELLS } from '@/lib/music/rhythmCells'
import { createRandom } from '@/lib/utils/seededRandom'

import { generateRound, type MelodyQuestion, type MelodyRoundSpec } from './generate'
import { DEFAULT_SETTINGS } from './settings'

/**
 * What the shapes actually produce, measured.
 *
 * `contour.test.ts` checks the curve; this checks that the curve reaches the
 * melodies — which is a different claim, and the one that was worth writing
 * down. The same reasoning as `generate.test.ts` in rhythmic dictation: a
 * weight that is right on paper and never reaches a bar is a weight that does
 * nothing.
 */

const spec = (over: Partial<MelodyRoundSpec> = {}): MelodyRoundSpec => ({
  ...DEFAULT_SETTINGS,
  // A wide range and a mixture of note lengths, so there is something for the
  // gap to make a difference to.
  low: '5_',
  high: "1'",
  cellWeights: { ...NO_CELLS, quarter: 3, hold: 3, eighth: 3, sixteenth: 2 },
  bars: 2,
  questionsPerRound: 30,
  ...over,
})

interface Move {
  /** Ticks from the previous note to this one. */
  gap: number
  /** How far the line moved, in semitones, without its direction. */
  leap: number
}

/** Every step a run of melodies took, with the time it had to take it. */
function moves(over: Partial<MelodyRoundSpec> = {}, seeds = 12): Move[] {
  const found: Move[] = []

  for (let seed = 1; seed <= seeds; seed += 1) {
    for (const question of generateRound(createRandom(seed), spec(over))) {
      const onsets = phraseOnsets(question.phrase)
      const sounding = question.pitches.map(chromaticValue)

      for (let index = 1; index < sounding.length; index += 1) {
        found.push({
          gap: (onsets[index] as number) - (onsets[index - 1] as number),
          leap: Math.abs((sounding[index] as number) - (sounding[index - 1] as number)),
        })
      }
    }
  }

  return found
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length

/** How far the line moved, on average, after gaps at or under / over a length. */
function meanLeap(all: readonly Move[], predicate: (move: Move) => boolean) {
  const matching = all.filter(predicate).map((move) => move.leap)
  expect(matching.length, 'nothing to measure').toBeGreaterThan(30)
  return mean(matching)
}

const short = (move: Move) => move.gap <= TICKS_PER_BEAT / 2
const long = (move: Move) => move.gap >= TICKS_PER_BEAT * 2

describe('a paced melody', () => {
  const all = moves({ shape: 'paced' })

  it('steps after a short note and leaps further after a long one', () => {
    // **The whole claim of the shape, measured on real melodies.** An eighth
    // or shorter moves the line about as far as a step or a third; a half note
    // or longer moves it noticeably further.
    const afterShort = meanLeap(all, short)
    const afterLong = meanLeap(all, long)

    expect(afterLong).toBeGreaterThan(afterShort * 1.5)
  })

  it('keeps quick notes genuinely close together', () => {
    // Not merely "closer than the long ones" — close in absolute terms, which
    // is what makes a run of sixteenths singable and hearable.
    expect(meanLeap(all, short)).toBeLessThan(4)
  })

  it('still reaches a wide leap somewhere, since none is forbidden', () => {
    // Every interval keeps a non-zero weight, so a long gap should now and
    // then actually take one. A shape that never leaps is as wrong as one that
    // always does.
    expect(Math.max(...all.map((move) => move.leap))).toBeGreaterThanOrEqual(9)
  })

  it('rarely repeats a note', () => {
    const repeats = all.filter((move) => move.leap === 0).length
    expect(repeats / all.length).toBeLessThan(0.1)
  })

  it('does repeat one sometimes, because the rhythm tells them apart', () => {
    expect(all.some((move) => move.leap === 0)).toBe(true)
  })
})

describe('a steady melody', () => {
  const all = moves({ shape: 'steady' })

  it('moves about as far whatever time it has', () => {
    // The other shape, and the reason it is kept: the rhythm has no say, which
    // is a harder line to hear and a different exercise rather than a worse
    // one.
    const afterShort = meanLeap(all, short)
    const afterLong = meanLeap(all, long)

    expect(Math.abs(afterLong - afterShort)).toBeLessThan(1)
  })

  it('still prefers steps over leaps overall', () => {
    expect(mean(all.map((move) => move.leap))).toBeLessThan(5)
  })
})

describe('the two shapes against each other', () => {
  it('differ where they claim to and agree where they do not', () => {
    const paced = moves({ shape: 'paced' })
    const steady = moves({ shape: 'steady' })

    // After a long note, paced is the freer of the two.
    expect(meanLeap(paced, long)).toBeGreaterThan(meanLeap(steady, long))
    // After a short one, it is the tighter.
    expect(meanLeap(paced, short)).toBeLessThan(meanLeap(steady, short))
  })

  it('produces the same rhythms either way', () => {
    // The shape decides pitches and nothing else: the bars are built first and
    // are untouched by it.
    const key = (round: readonly MelodyQuestion[]) =>
      round.map((question) => phraseOnsets(question.phrase).join(',')).join('|')

    expect(key(generateRound(createRandom(5), spec({ shape: 'paced' })))).toBe(
      key(generateRound(createRandom(5), spec({ shape: 'steady' }))),
    )
  })
})
