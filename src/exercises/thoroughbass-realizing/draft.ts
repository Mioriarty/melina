import { CHORD_FLOOR } from '@/exercises/thoroughbass-shared/generate'
import { voiceChord } from '@/exercises/thoroughbass-shared/voicing'
import type { Pitch } from '@/lib/music/pitch'
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

/** Where the notes placed under one bass note actually sit. */
export function chordPitches(draft: ChordDraft, index: number): readonly Pitch[] {
  return voiceChord(CHORD_FLOOR, notesAt(draft, index))
}

/** Where the *next* note would sit, which is what a key draws on its face. */
export function nextPlace(draft: ChordDraft, note: PitchClass): Pitch {
  const placed = chordPitches(draft, currentEvent(draft))
  const below = placed[placed.length - 1] ?? CHORD_FLOOR
  return voiceChord(below, [note])[0] as Pitch
}

export function draftAnswer(draft: ChordDraft): readonly (readonly PitchClass[])[] {
  return draft.chords
}
