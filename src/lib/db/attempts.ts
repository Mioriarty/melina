import { db, type AttemptRow } from './schema'

/**
 * Recording practice.
 *
 * Writes are fire-and-forget: a failed log must never interrupt a round, and
 * a dropped attempt costs a data point rather than the player's place.
 */
export function recordAttempt(attempt: AttemptRow): void {
  void db.attempts.add(attempt).catch(() => {
    // Storage can be unavailable (private browsing, quota). Practice
    // continues; only the statistics suffer.
  })
}

/**
 * Every answer given in one exercise, oldest first.
 *
 * The whole log, unbounded — for exporting or for a test. Anything that wants
 * to *measure* practice wants `accuracy` in `progress.ts`, which reads a
 * bounded window and stops early.
 */
export async function attemptsFor(exerciseId: string): Promise<AttemptRow[]> {
  return db.attempts.where('exerciseId').equals(exerciseId).sortBy('ts')
}
