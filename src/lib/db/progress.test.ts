import { describe, expect, it } from 'vitest'

import type {
  AttemptQuestion,
  DegreeAttempt,
  IntervalAttempt,
  RhythmAttempt,
  ScaleAttempt,
} from './attemptQuestion'
import { accuracy, matchesFilter, matchingAttempts } from './progress'
import { db, type AttemptRow } from './schema'

/**
 * Reading the attempt log back.
 *
 * The filter is the whole interface: a level, a single tonic and "everything
 * ever answered" are all the same query with more or fewer dimensions named,
 * so what has to hold is that naming a dimension narrows and leaving it out
 * does not.
 */

const INTERVAL: IntervalAttempt = {
  kind: 'interval',
  lower: 'C4',
  interval: 'P5',
  clef: 'treble',
  keySignature: '0',
  direction: 'ascending',
}

const SCALE: ScaleAttempt = {
  kind: 'scale',
  tonic: 'C4',
  mode: 'dorian',
  clef: 'treble',
  direction: 'ascending',
}

let clock = 0

function row(
  exerciseId: string,
  question: AttemptQuestion,
  correct: boolean,
): AttemptRow {
  clock += 1
  return {
    exerciseId,
    ts: clock,
    correct,
    question,
    answered: correct ? 'right' : 'wrong',
    ms: 1000,
  }
}

async function log(...rows: readonly AttemptRow[]): Promise<void> {
  await db.attempts.bulkAdd([...rows])
}

describe('matchesFilter', () => {
  const attempt = row('intervals/reading', INTERVAL, true)

  it('counts everything when nothing is named', () => {
    expect(matchesFilter(attempt, {})).toBe(true)
  })

  it('splits the exercise id, so a whole format can be asked about', () => {
    // "How am I doing at hearing things" spans both hearing exercises and
    // needs neither of them named.
    expect(matchesFilter(attempt, { format: 'reading' })).toBe(true)
    expect(matchesFilter(attempt, { format: 'hearing' })).toBe(false)
    expect(matchesFilter(attempt, { category: 'intervals' })).toBe(true)
  })

  it('reads a list as any of', () => {
    expect(matchesFilter(attempt, { clef: ['treble', 'bass'] })).toBe(true)
    expect(matchesFilter(attempt, { clef: ['alto', 'tenor'] })).toBe(false)
  })

  it('excludes an attempt that has no such dimension', () => {
    // A scale has no key signature, so asking about one is asking about
    // intervals whether or not the filter says so.
    const scale = row('scales/reading', SCALE, true)
    expect(matchesFilter(scale, { keySignature: '0' })).toBe(false)
    expect(matchesFilter(attempt, { mode: 'dorian' })).toBe(false)
  })

  it('matches the root across both kinds of question', () => {
    // An interval built on C and a scale on C are the same dimension, which
    // is what lets one query cover the whole app.
    const scale = row('scales/reading', SCALE, true)
    expect(matchesFilter(attempt, { root: 'C' })).toBe(true)
    expect(matchesFilter(scale, { root: 'C' })).toBe(true)
    expect(matchesFilter(scale, { root: 'Eb' })).toBe(false)
  })

  it('narrows on a derived dimension', () => {
    // Nothing in the row says whether the question needed ledger lines; the
    // treble staff runs E4 to F5, so a fifth on G4 sits inside it and the
    // same fifth on C4 does not.
    const onStaff = row('intervals/reading', { ...INTERVAL, lower: 'G4' }, true)
    expect(matchesFilter(onStaff, { staffOnly: true })).toBe(true)
    expect(matchesFilter(attempt, { staffOnly: true })).toBe(false)
  })
})

describe('accuracy', () => {
  it('is undefined rather than zero when nothing matches', async () => {
    // Never practised and never right are different things, and a screen
    // that renders 0% for the first is telling the player something false.
    expect(await accuracy({ exerciseId: 'intervals/reading' })).toEqual({
      correct: 0,
      total: 0,
      rate: undefined,
    })
  })

  it('counts only the answers the filter admits', async () => {
    await log(
      row('intervals/reading', INTERVAL, true),
      row('intervals/reading', INTERVAL, false),
      row('intervals/reading', { ...INTERVAL, interval: 'm3' }, false),
      row('scales/reading', SCALE, false),
    )

    expect(await accuracy({ exerciseId: 'intervals/reading' })).toMatchObject({
      correct: 1,
      total: 3,
    })
    expect(await accuracy({ interval: 'P5' })).toMatchObject({ correct: 1, total: 2 })
    expect(await accuracy({})).toMatchObject({ correct: 1, total: 4 })
  })

  it('measures the most recent answers, not the first ones', async () => {
    // Ten wrong long ago and three right just now is a player improving; a
    // window that read from the front would call it a 23% player.
    await log(
      ...Array.from({ length: 10 }, () => row('intervals/reading', INTERVAL, false)),
      ...Array.from({ length: 3 }, () => row('intervals/reading', INTERVAL, true)),
    )

    expect(await accuracy({ exerciseId: 'intervals/reading' }, 3)).toEqual({
      correct: 3,
      total: 3,
      rate: 1,
    })
  })

  it('fills the window from matching answers only', async () => {
    // Five matching answers buried under fifty that do not: the window holds
    // five, not zero. A rarely practised level still has a statistic.
    await log(
      ...Array.from({ length: 5 }, () => row('scales/hearing', SCALE, true)),
      ...Array.from({ length: 50 }, () => row('intervals/reading', INTERVAL, false)),
    )

    expect(await accuracy({ exerciseId: 'scales/hearing' }, 10)).toMatchObject({
      correct: 5,
      total: 5,
    })
  })
})

describe('matchingAttempts', () => {
  it('returns the newest first, so a caller can show the last few', async () => {
    await log(
      row('intervals/reading', INTERVAL, false),
      row('intervals/reading', { ...INTERVAL, interval: 'M7' }, true),
    )

    const found = await matchingAttempts({ exerciseId: 'intervals/reading' })
    expect(found.map((attempt) => attempt.question)).toMatchObject([
      { interval: 'M7' },
      { interval: 'P5' },
    ])
  })
})

describe('filtering rhythms', () => {
  const bar = (onsets: string, meter = '4/4'): RhythmAttempt => ({
    kind: 'rhythm',
    meter,
    onsets,
    tempo: 80,
  })

  const beats = bar('0,60,120,180')
  const eighths = bar('0,30,60,90')
  const triplet = bar('0,20,40,60')
  const waltz = bar('0,60,120', '3/4')

  async function logRhythms(): Promise<void> {
    await log(
      row('dictation/rhythm', beats, true),
      row('dictation/rhythm', eighths, false),
      row('dictation/rhythm', triplet, false),
      row('dictation/rhythm', waltz, true),
    )
  }

  it('counts every rhythm when nothing else is named', async () => {
    await logRhythms()
    expect((await accuracy({ kind: 'rhythm' })).total).toBe(4)
  })

  it('narrows to a metre', async () => {
    await logRhythms()
    expect((await accuracy({ meter: '3/4' })).total).toBe(1)
    expect((await accuracy({ meter: '4/4' })).total).toBe(3)
  })

  it('narrows to a subdivision, which is worked out from the impacts', async () => {
    // Nothing stored says "this bar had triplets in it" — it is derived on the
    // way out, so an old row answers a question nobody had thought to ask.
    await logRhythms()
    expect((await accuracy({ division: 'quarter' })).total).toBe(2)
    expect((await accuracy({ division: 'eighth' })).total).toBe(1)
    expect((await accuracy({ division: 'triplet' })).total).toBe(1)
  })

  it('separates the bars that stray from the beat', async () => {
    await logRhythms()
    expect((await accuracy({ offBeat: true })).total).toBe(2)
    expect((await accuracy({ offBeat: false })).total).toBe(2)
  })

  it('leaves rhythms out of every question about pitch', async () => {
    // A rhythm is built on no note, so it has no root to match — which is what
    // keeps one query spanning the whole app without the kinds bleeding into
    // each other.
    await logRhythms()
    expect((await accuracy({ root: 'C' })).total).toBe(0)
    expect((await accuracy({ clef: 'treble' })).total).toBe(0)
  })

  it('does not pick up rhythms when asking about scales', async () => {
    await log(row('scales/hearing', SCALE, true))
    await logRhythms()

    expect((await accuracy({ kind: 'scale' })).total).toBe(1)
    expect((await accuracy({ mode: 'dorian' })).total).toBe(1)
  })
})

describe('filtering scale degrees', () => {
  const melody = (degrees: string, mode = 'ionian', tonic = 'E4'): DegreeAttempt => ({
    kind: 'degree',
    tonic,
    mode: mode as DegreeAttempt['mode'],
    clef: 'treble',
    degrees,
  })

  async function logMelodies(): Promise<void> {
    await log(
      row('scales/degrees', melody('1,3,5'), true),
      row('scales/degrees', melody('1,3,b6'), false),
      row('scales/degrees', melody('1,2,3,4'), true),
      row('scales/degrees', melody('1,3,5', 'aeolian', 'A4'), false),
    )
  }

  it('narrows to a mode and to a tonic', async () => {
    await logMelodies()
    expect((await accuracy({ kind: 'degree' })).total).toBe(4)
    expect((await accuracy({ mode: 'aeolian', kind: 'degree' })).total).toBe(1)
    expect((await accuracy({ root: 'E' })).total).toBe(3)
  })

  it('narrows by how long the melody was, which is derived', async () => {
    await logMelodies()
    expect((await accuracy({ length: '3' })).total).toBe(3)
    expect((await accuracy({ length: '4' })).total).toBe(1)
  })

  it('separates the melodies that stepped outside the key', async () => {
    await logMelodies()
    expect((await accuracy({ altered: true })).total).toBe(1)
    expect((await accuracy({ altered: false })).total).toBe(3)
  })

  it('shares its root with intervals and scales, and nothing else', async () => {
    // `root` is the one dimension all three kinds have, which is what lets a
    // single query span the whole app.
    await log(row('scales/hearing', SCALE, true))
    await logMelodies()

    expect((await accuracy({ root: 'C' })).total).toBe(1)
    expect((await accuracy({ kind: 'scale' })).total).toBe(1)
    expect((await accuracy({ kind: 'degree' })).total).toBe(4)
  })
})
