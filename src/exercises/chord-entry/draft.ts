import type { ClefId } from '@/lib/music/clef'
import { voiceChords } from '@/lib/music/voicing'
import type { Pitch } from '@/lib/music/pitch'
import type { ScoreCursor } from '@/lib/notation/scoreCursor'
import { tonicKey, type PitchClass } from '@/lib/music/scale'

/**
 * The chord being written.
 *
 * **A set, not a sequence.** The figure underdetermines the voicing — octave,
 * order and spacing are the player's — so what is collected is the notes
 * placed, and where they sit is `voiceChord`'s business rather than the
 * player's.
 *
 * How many notes are wanted comes from the question and never from a constant:
 * two for a triad, three for a seventh. That is what "enough notes have been
 * placed" means, and it is why this keyboard needs no confirm key — a chord
 * *is* exactly fillable, so every key that would overfill is disabled and the
 * last press left is the one that completes it.
 */
export interface ChordDraft {
  /** How many notes each bass note's chord asks for. */
  slots: readonly number[]
  /** The notes placed under each bass note, in press order. */
  chords: readonly (readonly PitchClass[])[]
}

export function emptyChordDraft(slots: readonly number[]): ChordDraft {
  return { slots, chords: slots.map(() => []) }
}

/** The bass note being worked on: the first whose chord is not yet full. */
export function currentEvent(draft: ChordDraft): number {
  const index = draft.slots.findIndex(
    (slots, at) => (draft.chords[at]?.length ?? 0) < slots,
  )
  return index === -1 ? draft.slots.length : index
}

/**
 * Which chord of which bass note the next press goes into.
 *
 * The draft's slots are flat, because a suspension is two chords under one
 * bass note and they therefore cannot be counted per bass note. This is the
 * walk back out of that, and the grouping is handed in rather than kept: it is
 * a fact about the question, and a second copy of it here is a copy that could
 * come to disagree.
 */
export function currentSlot(
  draft: ChordDraft,
  chordsPerEvent: readonly number[],
): ScoreCursor | undefined {
  const active = currentEvent(draft)
  let first = 0
  for (let event = 0; event < chordsPerEvent.length; event += 1) {
    const count = chordsPerEvent[event] ?? 0
    if (active < first + count) return { event, position: active - first }
    first += count
  }
  return undefined
}

export function isFull(draft: ChordDraft): boolean {
  return currentEvent(draft) >= draft.slots.length
}

function notesAt(draft: ChordDraft, index: number): readonly PitchClass[] {
  return draft.chords[index] ?? []
}

/**
 * A note already in this chord cannot go in twice.
 *
 * There is no doubling here: the answer is the set of *distinct* notes above
 * the bass, so a repeat can never be right, and the key says so before the
 * press is spent rather than after.
 */
export function canPlace(draft: ChordDraft, note: PitchClass): boolean {
  if (isFull(draft)) return false
  const key = tonicKey(note)
  return !notesAt(draft, currentEvent(draft)).some((placed) => tonicKey(placed) === key)
}

export function place(draft: ChordDraft, note: PitchClass): ChordDraft {
  if (!canPlace(draft, note)) return draft
  const index = currentEvent(draft)
  return {
    ...draft,
    chords: draft.chords.map((chord, at) => (at === index ? [...chord, note] : chord)),
  }
}

export function canRemove(draft: ChordDraft): boolean {
  return draft.chords.some((chord) => chord.length > 0)
}

export function removeLast(draft: ChordDraft): ChordDraft {
  if (!canRemove(draft)) return draft
  // The last note placed is the last one of the last chord that has any.
  const index = draft.chords.reduce(
    (found, chord, at) => (chord.length > 0 ? at : found),
    -1,
  )
  return {
    ...draft,
    chords: draft.chords.map((chord, at) => (at === index ? chord.slice(0, -1) : chord)),
  }
}

/**
 * Where every chord of the draft sits.
 *
 * Voiced as a succession rather than one at a time, so the player's own line
 * follows itself — a chord after another opens near where that one began,
 * which is what keeps a resolution from leaping an octave.
 */
export function draftPitches(
  draft: ChordDraft,
  clef: ClefId = 'treble',
): readonly (readonly Pitch[])[] {
  return voiceChords(draft.chords, undefined, clef)
}

/**
 * Where a note is, or would be if it were pressed now.
 *
 * **What you see is what you get**: the realising keyboard draws each key as
 * the note that pressing it would actually put on the staff, octave and all,
 * so the row is a preview of the chord rather than a row of names. That can
 * only be answered by the thing that decides where notes go, and it has to be
 * answered by *the same* one the staff reads or the two would disagree — so it
 * is `voiceChords` here as everywhere else, run over the draft the press would
 * produce.
 *
 * A note already in the chord cannot be pressed again, and there the honest
 * answer is where it already sits: the key is showing the note it stands for,
 * which is on the staff.
 *
 * Once every chord is written there is no next press, and the key shows where
 * the note would open a chord after the last one — which is what it will mean
 * again the moment there is somewhere to press.
 */
export function placedPitch(
  draft: ChordDraft,
  note: PitchClass,
  clef: ClefId = 'treble',
): Pitch | undefined {
  const index = currentEvent(draft)
  if (index >= draft.chords.length) {
    const after = [...draft.chords, [note]]
    return voiceChords(after, undefined, clef)[after.length - 1]?.[0]
  }

  const key = tonicKey(note)
  const at = notesAt(draft, index).findIndex((placed) => tonicKey(placed) === key)
  const chords = draft.chords.map((chord, on) =>
    on === index && at === -1 ? [...chord, note] : chord,
  )
  const voiced = voiceChords(chords, undefined, clef)[index] ?? []
  return voiced[at === -1 ? voiced.length - 1 : at]
}

/** Where the notes placed under one chord slot actually sit. */
export function chordPitches(
  draft: ChordDraft,
  index: number,
  clef: ClefId = 'treble',
): readonly Pitch[] {
  return draftPitches(draft, clef)[index] ?? []
}

export function draftAnswer(draft: ChordDraft): readonly (readonly PitchClass[])[] {
  return draft.chords
}
