import { useLiveQuery } from 'dexie-react-hooks'

import {
  accuracy,
  ACCURACY_WINDOW,
  type Accuracy,
  type AttemptFilter,
} from '@/lib/db/progress'

/**
 * How accurate practice has been on a given sort of question.
 *
 * Live: answering a question updates every accuracy on screen, because the
 * query re-runs when the attempt log changes. `undefined` on the very first
 * render, before IndexedDB has answered — that is "not known yet", which a
 * caller should show as nothing rather than as a zero that then jumps.
 *
 * The filter is compared by value, so it can be written inline at the call
 * site without being memoised first.
 */
export function useAccuracy(
  filter: AttemptFilter = {},
  window = ACCURACY_WINDOW,
): Accuracy | undefined {
  const key = JSON.stringify(filter)
  // The filter is reconstructed from its own serialisation rather than
  // closed over, so a caller passing a fresh object literal every render
  // cannot make this re-run: the dependency and the query see the same value.
  return useLiveQuery(
    () => accuracy(JSON.parse(key) as AttemptFilter, window),
    [key, window],
  )
}

/**
 * The same, for several filters at once — one accuracy per level on a levels
 * screen. Returns `undefined` until every one of them has answered, so a
 * screen fills in at once rather than a row at a time.
 */
export function useAccuracies(
  filters: readonly AttemptFilter[],
  window = ACCURACY_WINDOW,
): readonly Accuracy[] | undefined {
  const key = JSON.stringify(filters)
  return useLiveQuery(
    () =>
      Promise.all(
        (JSON.parse(key) as AttemptFilter[]).map((filter) => accuracy(filter, window)),
      ),
    [key, window],
  )
}
