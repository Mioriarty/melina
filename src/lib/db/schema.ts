import Dexie, { type EntityTable } from 'dexie'

import type { AttemptQuestion } from './attemptQuestion'

/**
 * The local database. Everything melina remembers lives here — there is no
 * server. Bump the version and add a `.stores()` block to migrate; never edit
 * an existing version in place, or installed clients will not upgrade.
 */

export interface SettingRow {
  key: string
  value: unknown
}

/**
 * One answered question.
 *
 * Every answer is recorded, right or wrong, and each row carries enough to
 * put the exact question back on screen — and deliberately no more. What the
 * question implies is left out: the upper note of an interval, the eight
 * pitches of a scale and the answer that would have been correct are all
 * derived from `question` on the way back out.
 *
 * `answered` is written even when the answer was right, where it repeats the
 * correct answer. That costs a few bytes and buys a row that says what the
 * player actually pressed without anyone having to reason from `correct`.
 */
export interface AttemptRow {
  id?: number
  /** `categoryId/exerciseId`, e.g. `intervals/reading`. */
  exerciseId: string
  /** Epoch milliseconds. */
  ts: number
  correct: boolean
  /** What was asked, in the form it can be rebuilt from. */
  question: AttemptQuestion
  /** What the player answered, in the same vocabulary as the answer. */
  answered: string
  /** Time from question shown to answer, in milliseconds. */
  ms: number
}

const db = new Dexie('melina') as Dexie & {
  settings: EntityTable<SettingRow, 'key'>
  attempts: EntityTable<AttemptRow, 'id'>
}

db.version(1).stores({
  settings: 'key',
})

// v2 adds the attempt log. Indexed on the fields Progress will group by.
db.version(2).stores({
  settings: 'key',
  attempts: '++id, exerciseId, ts, correct, subject',
})

/**
 * v3 replaces the attempt log's stringly-typed `subject`/`context` pair with
 * a question that can be rebuilt.
 *
 * The old rows are cleared rather than migrated, because a v2 interval row
 * cannot be recovered: it kept the interval, the clef and the key signature
 * but not the note the interval was built on, so the question it records no
 * longer exists. Carrying half-legible rows into a table whose whole promise
 * is reconstructability would cost that promise for every row.
 *
 * `[exerciseId+ts]` is what an accuracy window walks: the newest attempts of
 * one exercise, newest first, without reading the rest of the log.
 */
db.version(3)
  .stores({
    settings: 'key',
    attempts: '++id, exerciseId, ts, correct, [exerciseId+ts]',
  })
  .upgrade((tx) => tx.table('attempts').clear())

export { db }
