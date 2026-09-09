import { attemptFacets, type FacetValue } from './attemptQuestion'
import { db, type AttemptRow } from './schema'

/**
 * Practice over time.
 *
 * Pure functions over rows rather than queries, because the progress screen
 * wants a dozen different cuts of the same log — days, streaks, accuracy per
 * interval, per clef, per exercise — and reading it once and slicing it in
 * memory is both simpler and faster than a dozen cursor walks. The log is
 * local and one player's, so it comfortably fits.
 *
 * The one exception is `practiceDays`, which the header needs on every
 * screen: it reads timestamps out of the index without loading a single row,
 * because drawing one small number should not cost a year of practice in
 * memory.
 *
 * Everything here is timezone-local. A day is the day it was where the player
 * was practising, not UTC: a session at 23:30 belongs to that evening, and
 * shifting it to the next day would break a streak someone had earned.
 */

/** `YYYY-MM-DD` in local time. Sorts lexicographically, which is why. */
export function dayKey(ts: number): string {
  const date = new Date(ts)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The local midnight a day key stands for, as epoch milliseconds. */
export function dayStart(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime()
}

/** The day key `offset` days after `key` — negative to go backwards. */
export function shiftDay(key: string, offset: number): string {
  const date = new Date(dayStart(key))
  date.setDate(date.getDate() + offset)
  return dayKey(date.getTime())
}

export interface DayActivity {
  /** `YYYY-MM-DD`, local. */
  day: string
  /** How many questions were answered that day. */
  total: number
  correct: number
}

export interface Tally {
  correct: number
  total: number
}

/** `correct / total`, or `undefined` when there is nothing to divide. */
export function rateOf({ correct, total }: Tally): number | undefined {
  return total === 0 ? undefined : correct / total
}

/**
 * One entry per day that has practice in it, oldest first.
 *
 * Empty days are left out rather than filled with zeroes: which days count as
 * empty depends on the range being drawn, and only the chart knows that.
 */
export function dailyActivity(rows: readonly AttemptRow[]): DayActivity[] {
  const byDay = new Map<string, DayActivity>()

  for (const row of rows) {
    const day = dayKey(row.ts)
    const entry = byDay.get(day) ?? { day, total: 0, correct: 0 }
    entry.total += 1
    if (row.correct) entry.correct += 1
    byDay.set(day, entry)
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
}

/**
 * Every day in a range, including the empty ones, oldest first.
 *
 * A chart needs the gaps: a week off is the most informative shape a practice
 * chart can have, and skipping those columns would draw it as though the
 * practice either side were consecutive.
 */
export function daysBetween(
  activity: readonly DayActivity[],
  from: string,
  to: string,
): DayActivity[] {
  const byDay = new Map(activity.map((entry) => [entry.day, entry]))
  const days: DayActivity[] = []

  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    days.push(byDay.get(day) ?? { day, total: 0, correct: 0 })
  }

  return days
}

export interface Streak {
  /** Days in a row up to now. */
  current: number
  /** The best run there has ever been. */
  longest: number
  /** Whether anything has been answered today. */
  practisedToday: boolean
}

/**
 * How many days in a row.
 *
 * A streak survives until a whole day passes without practice: practise on
 * Monday and Tuesday still reads 1 until the day is over, and only Wednesday
 * resets it. The alternative — counting only days with practice in them —
 * empties the number every midnight and reads as a punishment for not having
 * practised yet at breakfast.
 */
export function streakOf(practised: readonly string[], now = Date.now()): Streak {
  const days = new Set(practised)
  const today = dayKey(now)
  const practisedToday = days.has(today)

  // Anchored on yesterday when today is still untouched, which is what lets
  // the count stand — greyed — through a day that has not been used yet.
  let cursor = practisedToday ? today : shiftDay(today, -1)
  let current = 0
  while (days.has(cursor)) {
    current += 1
    cursor = shiftDay(cursor, -1)
  }

  let longest = 0
  let run = 0
  let previous: string | undefined
  for (const day of [...days].sort()) {
    run = previous !== undefined && shiftDay(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }

  return { current, longest, practisedToday }
}

export interface Group extends Tally {
  /** The facet value this group counts, e.g. `A4`, `dorian`, `treble`. */
  value: string
}

/**
 * Accuracy per value of one dimension — every interval, every mode, every
 * clef — in one pass.
 *
 * The dimension is a facet name, so this knows nothing about music and a new
 * kind of question is groupable the day it starts being logged.
 */
export function groupBy(
  rows: readonly AttemptRow[],
  dimension: string,
  keep: (row: AttemptRow) => boolean = () => true,
): Group[] {
  const groups = new Map<string, Group>()

  for (const row of rows) {
    if (!keep(row)) continue

    const value = facetString(attemptFacets(row.question)[dimension])
    if (value === undefined) continue

    const group = groups.get(value) ?? { value, correct: 0, total: 0 }
    group.total += 1
    if (row.correct) group.correct += 1
    groups.set(value, group)
  }

  return [...groups.values()]
}

function facetString(value: FacetValue | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'boolean' ? String(value) : value
}

/**
 * Every day that has practice in it, oldest first.
 *
 * Walks the `ts` index and never touches a row: the header draws a streak on
 * every screen, and loading the whole attempt log to count days would grow
 * into a real cost after a year of daily practice.
 */
export async function practiceDays(): Promise<string[]> {
  const days: string[] = []
  let last: string | undefined

  await db.attempts.orderBy('ts').eachKey((key) => {
    const day = dayKey(Number(key))
    // The index is in time order, so days arrive grouped and a single
    // comparison is all the de-duplication this needs.
    if (day !== last) {
      days.push(day)
      last = day
    }
  })

  return days
}

/** Right and wrong, over whatever rows are handed in. */
export function tally(rows: readonly AttemptRow[]): Tally {
  let correct = 0
  for (const row of rows) if (row.correct) correct += 1
  return { correct, total: rows.length }
}
