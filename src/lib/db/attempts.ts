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

export async function attemptsFor(exerciseId: string): Promise<AttemptRow[]> {
  return db.attempts.where('exerciseId').equals(exerciseId).toArray()
}
