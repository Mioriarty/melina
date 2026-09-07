import Dexie, { type EntityTable } from 'dexie'

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
 * Deliberately denormalised and exercise-agnostic: `subject` holds whatever
 * the exercise was asking about (an interval key like `A4`, later a chord or
 * a scale degree), so Progress can aggregate weaknesses across modules
 * without knowing what each one teaches.
 */
export interface AttemptRow {
  id?: number
  /** `categoryId/exerciseId`, e.g. `intervals/reading`. */
  exerciseId: string
  /** Epoch milliseconds. */
  ts: number
  correct: boolean
  /** What was asked. */
  subject: string
  /** What the player answered, when they got it wrong. */
  answered?: string
  /** Time from question shown to answer, in milliseconds. */
  ms: number
  /** Free-form context for later analysis: clef, key signature, and so on. */
  context?: Record<string, string>
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

export { db }
