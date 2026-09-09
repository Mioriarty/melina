import type { Degree } from '@/lib/music/degree'

/**
 * The melody as it is being written down.
 *
 * Far simpler than the rhythm draft, because a degree has no length: the answer
 * is just the degrees pressed, in order, and it is finished when there are as
 * many of them as there were notes.
 */

export interface DegreeDraft {
  /** How many notes the melody had, which is how many are wanted. */
  length: number
  degrees: readonly Degree[]
}

export function emptyDraft(length: number): DegreeDraft {
  return { length, degrees: [] }
}

export function isFull(draft: DegreeDraft): boolean {
  return draft.degrees.length >= draft.length
}

/** Whether another degree may be entered. */
export function canAppend(draft: DegreeDraft): boolean {
  return !isFull(draft)
}

export function append(draft: DegreeDraft, degree: Degree): DegreeDraft {
  if (!canAppend(draft)) return draft
  return { ...draft, degrees: [...draft.degrees, degree] }
}

export function removeLast(draft: DegreeDraft): DegreeDraft {
  return { ...draft, degrees: draft.degrees.slice(0, -1) }
}
