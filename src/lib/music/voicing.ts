import { getClef, type ClefId } from './clef'
import {
  chromaticValue,
  diatonicValue,
  octaveFromDiatonicValue,
  pitch,
  type Pitch,
} from './pitch'
import type { PitchClass } from './scale'

/**
 * Where the notes of a chord actually sit.
 *
 * **A chord is a set of notes; where they sit is a separate question** — a
 * figure says which notes and never where, and a chord symbol says no more. But
 * something has to put them on a staff, and if the staff and the verdict worked
 * it out separately they could disagree about what the player had written. So
 * this is the one place that decides, and everything reads it.
 *
 * Two rules, and the second is what makes a succession of chords readable:
 *
 * - **Close position.** Each note goes at the lowest place above the one
 *   before it, which is the texture a continuo player's right hand makes. The
 *   order they are given in is the order they are stacked in, so the player
 *   controls the shape by which key they press first — and it is also what lets
 *   a chord be voiced to a named *Lage*, by handing the member that belongs on
 *   top last.
 * - **The chord as a whole sits nearest to the one before it.** Its first note
 *   — which is therefore its lowest — is placed at the octave closest to where
 *   the previous chord began.
 *
 * That second rule is the whole of the voice leading, and it needs no matching
 * of voices to work: **a close-position chord is positioned entirely by its
 * lowest note**, so moving that note the least moves the chord the least.
 *
 * It used to place every chord from one fixed floor, strictly above it, which
 * went wrong twice over. A 4–3 suspension leapt an octave up rather than
 * resolving by a semitone — the B of the resolution could not sit on a B floor,
 * so it jumped — and a lone triad's register depended on which letter happened
 * to be lowest, so a chord over G sat a sixth above one over C.
 *
 * Anchoring on the first note rather than on the chord's centre is deliberate:
 * it means **a note already on the staff never moves when the next one
 * arrives**, which matters because the player builds a chord one key at a time
 * and the app cannot know what is still to come.
 *
 * This lives in `lib/music` rather than beside an exercise because it is not
 * one exercise's idea: thoroughbass realises a figure into it and chord writing
 * writes a named chord into it, and two answers to where a note sits is two
 * answers that can disagree.
 */

/**
 * Where a chord opens on a given clef, when there is nothing before it to
 * follow.
 *
 * **Computed from the clef's own staff rather than tabulated**, the same move
 * `isCleanScale` makes: the reference is the F nearest the middle line, which
 * puts the first note of a first chord in the octave that clef reads most
 * comfortably — whatever its letter, since `nearest` then has at most a
 * diminished fifth to travel.
 */
export function defaultRegister(clef: ClefId = 'treble'): Pitch {
  const { staffLowest, staffHighest } = getClef(clef)
  const middle = Math.round(
    (diatonicValue(staffLowest) + diatonicValue(staffHighest)) / 2,
  )

  // The two F's either side of the middle line; the nearer one is the anchor.
  const anchor = diatonicValue(pitch('F', 0, 0))
  const below = middle - ((((middle - anchor) % 7) + 7) % 7)
  const above = below + 7
  const step = middle - below <= above - middle ? below : above

  return pitch('F', 0, octaveFromDiatonicValue(step))
}

/**
 * Where a chord sits when there is nothing before it to follow.
 *
 * The treble one, which is the staff a realised figure goes on. Kept as a
 * constant because it is also what the realising keyboard draws its keys in
 * before anything has been pressed.
 */
export const DEFAULT_REGISTER: Pitch = defaultRegister('treble')

/** The octave an opening chord begins in, whatever its lowest letter is. */
export const OPENING_OCTAVE = 4

/**
 * The octave of `note` that lies closest to `reference`.
 *
 * Ties go upward. Only a plain B ties against the default register, and
 * upward is what keeps the opening row of keys ascending.
 */
function nearest(reference: Pitch, note: PitchClass): Pitch {
  const target = chromaticValue(reference)
  let best = { ...note, octave: reference.octave - 1 }

  for (const octave of [reference.octave, reference.octave + 1]) {
    const candidate = { ...note, octave }
    const closer =
      Math.abs(chromaticValue(candidate) - target) -
      Math.abs(chromaticValue(best) - target)
    if (
      closer < 0 ||
      (closer === 0 && chromaticValue(candidate) > chromaticValue(best))
    ) {
      best = candidate
    }
  }

  return best
}

/** The lowest place above `below` that `note` can take. */
function above(below: Pitch, note: PitchClass): Pitch {
  let candidate: Pitch = { ...note, octave: below.octave }
  while (diatonicValue(candidate) <= diatonicValue(below)) {
    candidate = { ...note, octave: candidate.octave + 1 }
  }
  return candidate
}

/**
 * Move the whole chord by octaves until the staff can show it.
 *
 * Only ever fires for a tall chord anchored high — a ninth is four notes
 * spanning a seventh, and so is a seventh chord voiced to a low Lage — and it
 * moves the chord as one, so its shape is kept. Generated questions are checked
 * against the same range afterwards and a root that will not fit is simply not
 * used; this is what keeps a player's own chord from running off the page,
 * where there is no such second chance.
 */
function ontoTheStaff(chord: readonly Pitch[], clef: ClefId): readonly Pitch[] {
  const { lowest, highest } = getClef(clef)
  const shift = (by: number) =>
    chord.map((note) => ({ ...note, octave: note.octave + by }))

  let placed = chord
  for (let tries = 0; tries < 3; tries += 1) {
    const top = placed[placed.length - 1]
    const bottom = placed[0]
    if (top === undefined || bottom === undefined) return placed

    if (
      diatonicValue(top) > diatonicValue(highest) &&
      diatonicValue(bottom) - 7 >= diatonicValue(lowest)
    ) {
      placed = shift(-1)
      continue
    }
    if (
      diatonicValue(bottom) < diatonicValue(lowest) &&
      diatonicValue(top) + 7 <= diatonicValue(highest)
    ) {
      placed = shift(1)
      continue
    }
    return placed
  }
  return placed
}

/**
 * A chord, placed.
 *
 * `near` is where the chord before it began. Without one the chord opens in
 * the default register, which is what a first chord does. `clef` is only the
 * staff it has to fit on — it never changes the shape, only whether the whole
 * chord is moved bodily by an octave to be showable.
 */
export function voiceChord(
  notes: readonly PitchClass[],
  near: Pitch = DEFAULT_REGISTER,
  clef: ClefId = 'treble',
): readonly Pitch[] {
  const first = notes[0]
  if (first === undefined) return []

  const placed: Pitch[] = [nearest(near, first)]
  for (const note of notes.slice(1)) {
    placed.push(above(placed[placed.length - 1] as Pitch, note))
  }

  return ontoTheStaff(placed, clef)
}

/**
 * Every chord of a succession, each following the one before it.
 *
 * The single place that threads the reference along, so a bass line, a
 * suspension and a question read back out of the attempt log all voice the
 * same way — which they must, or a row would disagree with the notation it
 * produced.
 */
export function voiceChords(
  chords: readonly (readonly PitchClass[])[],
  near: Pitch = DEFAULT_REGISTER,
  clef: ClefId = 'treble',
): readonly (readonly Pitch[])[] {
  const voiced: (readonly Pitch[])[] = []
  let previous = near

  for (const chord of chords) {
    const placed = voiceChord(chord, previous, clef)
    voiced.push(placed)
    previous = placed[0] ?? previous
  }

  return voiced
}
