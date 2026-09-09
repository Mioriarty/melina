import { describe, expect, it } from 'vitest'

import type { AttemptQuestion } from './attemptQuestion'
import {
  dailyActivity,
  dayKey,
  daysBetween,
  groupBy,
  practiceDays,
  shiftDay,
  streakOf,
  tally,
} from './history'
import { db, type AttemptRow } from './schema'

/**
 * Practice over time.
 *
 * The streak is the part that has to be right: it is the number the header
 * shows on every screen, and a rule that quietly resets someone's fortnight
 * is worse than showing no number at all.
 */

const QUESTION: AttemptQuestion = {
  kind: 'interval',
  lower: 'C4',
  interval: 'P5',
  clef: 'treble',
  keySignature: '0',
  direction: 'harmonic',
}

/** Local noon on a day, so no timezone can push it into its neighbour. */
function at(day: string, hour = 12): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year!, month! - 1, date!, hour).getTime()
}

function row(day: string, correct: boolean, question = QUESTION): AttemptRow {
  return {
    exerciseId: 'intervals/reading',
    ts: at(day),
    correct,
    question,
    answered: 'P5',
    ms: 1000,
  }
}

describe('day keys', () => {
  it('is the local day, not the UTC one', () => {
    // A session at half past eleven at night belongs to that evening. Shifting
    // it to the next day would hand someone a streak they did not practise.
    const late = new Date(2026, 2, 3, 23, 30).getTime()
    expect(dayKey(late)).toBe('2026-03-03')
  })

  it('sorts lexicographically, which is the whole point of the format', () => {
    expect(['2026-03-09', '2026-03-10'].sort()).toEqual(['2026-03-09', '2026-03-10'])
  })

  it('crosses months and years', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('crosses a daylight saving boundary without losing a day', () => {
    // Adding 24 hours would land on the same date in the spring-forward week.
    expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDay('2026-03-30', -1)).toBe('2026-03-29')
  })
})

describe('dailyActivity', () => {
  it('collects answers into the days they were given on', () => {
    expect(
      dailyActivity([
        row('2026-03-01', true),
        row('2026-03-01', false),
        row('2026-03-03', true),
      ]),
    ).toEqual([
      { day: '2026-03-01', total: 2, correct: 1 },
      { day: '2026-03-03', total: 1, correct: 1 },
    ])
  })

  it('fills the gaps only when a range asks for them', () => {
    // The empty day is the most informative column a practice chart has, so
    // the chart gets it — but the activity list itself stays sparse.
    const activity = dailyActivity([row('2026-03-01', true), row('2026-03-03', true)])
    expect(activity).toHaveLength(2)

    expect(daysBetween(activity, '2026-03-01', '2026-03-03')).toEqual([
      { day: '2026-03-01', total: 1, correct: 1 },
      { day: '2026-03-02', total: 0, correct: 0 },
      { day: '2026-03-03', total: 1, correct: 1 },
    ])
  })
})

describe('streakOf', () => {
  const now = at('2026-03-10')

  it('counts consecutive days up to today', () => {
    const days = ['2026-03-08', '2026-03-09', '2026-03-10']
    expect(streakOf(days, now)).toMatchObject({ current: 3, practisedToday: true })
  })

  it('stands through a day that has not been used yet', () => {
    // Practised yesterday, nothing today: the streak is still alive and the
    // header greys out to say so. Zeroing it at midnight would read as a
    // punishment for not having practised before breakfast.
    const days = ['2026-03-08', '2026-03-09']
    expect(streakOf(days, now)).toMatchObject({ current: 2, practisedToday: false })
  })

  it('breaks once a whole day has passed without practice', () => {
    const days = ['2026-03-07', '2026-03-08']
    expect(streakOf(days, now)).toMatchObject({ current: 0, practisedToday: false })
  })

  it('remembers the best run even after it is broken', () => {
    const days = [
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-03-09',
      '2026-03-10',
    ]
    expect(streakOf(days, now)).toMatchObject({ current: 2, longest: 4 })
  })

  it('is zero for someone who has never practised', () => {
    expect(streakOf([], now)).toEqual({
      current: 0,
      longest: 0,
      practisedToday: false,
    })
  })
})

describe('groupBy', () => {
  it('splits accuracy across the values of one dimension', () => {
    const groups = groupBy(
      [
        row('2026-03-01', true),
        row('2026-03-01', false),
        row('2026-03-01', true, { ...QUESTION, interval: 'A4' }),
      ],
      'interval',
    )

    expect(groups).toEqual([
      { value: 'P5', correct: 1, total: 2 },
      { value: 'A4', correct: 1, total: 1 },
    ])
  })

  it('skips answers that have no such dimension', () => {
    // A scale has no interval, so it belongs in no interval group rather than
    // in an "unknown" one that would be read as a real weakness.
    const scale: AttemptQuestion = {
      kind: 'scale',
      tonic: 'C4',
      mode: 'dorian',
      clef: 'treble',
      direction: 'ascending',
    }

    expect(groupBy([row('2026-03-01', true, scale)], 'interval')).toEqual([])
    expect(groupBy([row('2026-03-01', true, scale)], 'mode')).toMatchObject([
      { value: 'dorian', total: 1 },
    ])
  })

  it('groups on a derived dimension as readily as a stored one', () => {
    // Both questions are a fifth on C; only the clef decides whether it sat
    // on the staff, and nothing in the row says so.
    const groups = groupBy(
      [
        row('2026-03-01', true, { ...QUESTION, lower: 'G4' }),
        row('2026-03-01', false, { ...QUESTION, lower: 'C4' }),
      ],
      'staffOnly',
    )

    expect(groups).toEqual([
      { value: 'true', correct: 1, total: 1 },
      { value: 'false', correct: 0, total: 1 },
    ])
  })
})

describe('practiceDays', () => {
  it('reads one entry per day out of the index', async () => {
    await db.attempts.bulkAdd([
      row('2026-03-01', true),
      row('2026-03-01', false),
      row('2026-03-03', true),
    ])

    expect(await practiceDays()).toEqual(['2026-03-01', '2026-03-03'])
  })

  it('is empty before anything has been practised', async () => {
    expect(await practiceDays()).toEqual([])
  })
})

describe('tally', () => {
  it('counts right and wrong', () => {
    expect(tally([row('2026-03-01', true), row('2026-03-01', false)])).toEqual({
      correct: 1,
      total: 2,
    })
  })
})
