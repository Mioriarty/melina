import type { Degree } from '@/lib/music/degree'

/**
 * A run of scale degrees as it is being written down.
 *
 * Far simpler than the rhythm draft, because a degree has no length: the answer
 * is just the degrees pressed, in order, and it is finished when there are as
 * many of them as there were notes.
 *
 * It lives here rather than beside scale degrees because bass dictation writes
 * its answer the same way — one degree per chord, finished when the line is as
 * long as the progression — and two copies of "the degrees pressed so far" is
 * two things that could disagree. The same move `voicing.ts` made into
 * `lib/music` when a second exercise needed it.
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
