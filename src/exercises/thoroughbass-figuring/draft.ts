import type { Figure, FigureAccidental, FigureSign } from '@/lib/music/figuredBass'
import type { ScoreCursor } from '@/lib/notation/scoreCursor'

/**
 * The figure being written.
 *
 * **The draft is the keys that were pressed**, the same rule the dictation
 * drafts follow: the staff has to show what the player wrote, so what is kept
 * is the signs and not the notes they imply. Grading resolves them afterwards.
 *
 * The grammar is two keys and it is the written notation itself. A digit adds a
 * line to the column being typed; the dash closes that column and opens the
 * next one **under the same bass note**, which is how `4 – 3` is written and
 * therefore how it is typed.
 */
export interface FigureDraft {
  /** How many bass notes the finished answer has. */
  bassNotes: number
  /** Bass notes whose figuring is finished. */
  done: readonly (readonly Figure[])[]
  /** Columns already closed under the bass note being worked on. */
  pending: readonly Figure[]
  /** The column being typed into. */
  current: readonly FigureSign[]
  /** An accidental waiting for the digit it belongs to. */
  armed: FigureAccidental
}

/** Where a lone accidental goes: "the Third of the Chord". */
const THIRD = 3

export function emptyFigureDraft(bassNotes: number): FigureDraft {
  return { bassNotes, done: [], pending: [], current: [], armed: 'none' }
}

export function isComplete(draft: FigureDraft): boolean {
  return draft.done.length >= draft.bassNotes
}

/**
 * Which bass note is being figured, and which column under it.
 *
 * **The columns belong to the draft and the chords to the question, and the
 * two need not agree.** A dash pressed under a bass note the question figures
 * once opens a column there is no chord for, and the page has no room to mark;
 * the band stays on the last chord there is rather than running off the end of
 * the bass note it belongs to.
 */
export function currentSlot(
  draft: FigureDraft,
  chordsPerEvent: readonly number[],
): ScoreCursor | undefined {
  if (isComplete(draft)) return undefined
  const event = draft.done.length
  const chords = chordsPerEvent[event]
  if (chords === undefined) return undefined
  return { event, position: Math.min(draft.pending.length, Math.max(0, chords - 1)) }
}

/** Whether anything at all has been typed under the bass note in hand. */
function started(draft: FigureDraft): boolean {
  return draft.current.length > 0 || draft.armed !== 'none'
}

/**
 * The column as a figure.
 *
 * **An armed accidental with no digit after it is the third**, which is not a
 * special case bolted on but exactly what the one-shot switch already means:
 * "the Figure 3 being always suppressed in modern Thoroughbasses, and the
 * Accidental Sign alone inserted in its place".
 */
function closeColumn(draft: FigureDraft): Figure {
  if (draft.current.length === 0 && draft.armed !== 'none') {
    return { signs: [{ number: THIRD, accidental: draft.armed }] }
  }
  return { signs: [...draft.current].sort((a, b) => b.number - a.number) }
}

export function canArm(draft: FigureDraft): boolean {
  return !isComplete(draft)
}

export function arm(draft: FigureDraft, accidental: FigureAccidental): FigureDraft {
  if (!canArm(draft)) return draft
  return { ...draft, armed: draft.armed === accidental ? 'none' : accidental }
}

/** A digit already in this column cannot go in twice — there is no `6/6`. */
export function canPress(draft: FigureDraft, number: number): boolean {
  return !isComplete(draft) && !draft.current.some((sign) => sign.number === number)
}

export function press(draft: FigureDraft, number: number): FigureDraft {
  if (!canPress(draft, number)) return draft
  return {
    ...draft,
    current: [...draft.current, { number, accidental: draft.armed }],
    armed: 'none',
  }
}

/** The dash: another figure under the same bass note. */
export function canAdvance(draft: FigureDraft): boolean {
  return !isComplete(draft) && started(draft)
}

export function advance(draft: FigureDraft): FigureDraft {
  if (!canAdvance(draft)) return draft
  return {
    ...draft,
    pending: [...draft.pending, closeColumn(draft)],
    current: [],
    armed: 'none',
  }
}

/**
 * Done: that is the figure for this bass note.
 *
 * Always pressable, because **submitting nothing is a real answer** — a plain
 * triad is figured by writing no figure at all, so "no figure" is not a key to
 * discover but simply pressing done straight away.
 */
export function finish(draft: FigureDraft): FigureDraft {
  if (isComplete(draft)) return draft
  return {
    ...draft,
    done: [...draft.done, [...draft.pending, closeColumn(draft)]],
    pending: [],
    current: [],
    armed: 'none',
  }
}

export function canRemove(draft: FigureDraft): boolean {
  return !isComplete(draft) && (started(draft) || draft.pending.length > 0)
}

export function removeLast(draft: FigureDraft): FigureDraft {
  if (!canRemove(draft)) return draft
  if (draft.armed !== 'none') return { ...draft, armed: 'none' }

  if (draft.current.length > 0) {
    return { ...draft, current: draft.current.slice(0, -1) }
  }

  // Back out of a closed column and carry on typing into it.
  const reopened = draft.pending[draft.pending.length - 1]
  return {
    ...draft,
    pending: draft.pending.slice(0, -1),
    current: reopened === undefined ? [] : reopened.signs,
  }
}

/**
 * What is on the page: one entry per bass note, finished or not.
 *
 * The column being typed into is included, so a figure appears under the bass
 * as it is written rather than all at once when it is closed.
 */
export function draftEvents(draft: FigureDraft): readonly (readonly Figure[])[] {
  const events: (readonly Figure[])[] = [...draft.done]
  if (!isComplete(draft)) {
    const open = closeColumn(draft)
    const showOpen = started(draft) || draft.pending.length === 0
    events.push(showOpen ? [...draft.pending, open] : draft.pending)
  }
  while (events.length < draft.bassNotes) events.push([])
  return events
}

/** The answer, once every bass note has been figured. */
export function draftAnswer(draft: FigureDraft): readonly (readonly Figure[])[] {
  return draft.done
}
