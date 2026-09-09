import { useLiveQuery } from 'dexie-react-hooks'

import { practiceDays, streakOf, type Streak } from '@/lib/db/history'

/**
 * How many days in a row practice has happened.
 *
 * Reads day keys out of the index rather than the attempt log itself, because
 * the header shows this on every screen and a year of daily practice is a lot
 * of rows to load for one small number.
 *
 * `undefined` until IndexedDB answers, which the header should draw as
 * nothing rather than as a zero that flickers into a seven.
 */
export function useStreak(): Streak | undefined {
  return useLiveQuery(async () => streakOf(await practiceDays()), [])
}
