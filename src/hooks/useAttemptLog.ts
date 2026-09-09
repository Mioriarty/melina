import { useLiveQuery } from 'dexie-react-hooks'

import { db, type AttemptRow } from '@/lib/db/schema'

/**
 * Every answer ever given, oldest first.
 *
 * The whole log, deliberately: the progress screen wants a dozen cuts of it —
 * days, streaks, accuracy per interval, per clef, per exercise — and reading
 * it once and slicing it in memory beats a dozen cursor walks over the same
 * rows. It is one player's practice on their own device, so it fits.
 *
 * `undefined` until IndexedDB answers, which callers should render as "not
 * known yet" rather than as an empty log — the two look very different on a
 * screen whose whole subject is how much you have done.
 */
export function useAttemptLog(): readonly AttemptRow[] | undefined {
  return useLiveQuery(() => db.attempts.orderBy('ts').toArray(), [])
}
