import { getClef } from '@/lib/music/clef'
import { chromaticValue, diatonicValue, pitch, type Pitch } from '@/lib/music/pitch'
import type { PitchClass } from '@/lib/music/scale'

/**
 * Where the notes of a chord actually sit.
 *
 * **A figure says which notes, never where they sit** — a realisation an octave
 * up, or with the notes in another order, is the same answer. But something has
 * to put them on a staff, and if the staff and the verdict worked it out
 * separately they could disagree about what the player had written. So this is
 * the one place that decides, and everything reads it.
 *
 * Two rules, and the second is what makes a succession of chords readable:
 *
 * - **Close position.** Each note goes at the lowest place above the one
 *   before it, which is the texture a continuo player's right hand makes. The
 *   order they are given in is the order they are stacked in, so the player
 *   controls the shape by which key they press first.
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
 */

/**
 * Where a chord sits when there is nothing before it to follow.
 *
 * Chosen so the first note of a first chord lands in `C4`–`B4` whatever its
 * letter — the same octave the keyboard draws its keys in, so pressing a key
 * for an opening chord puts the note exactly where the key showed it.
 */
export const DEFAULT_REGISTER: Pitch = pitch('F', 0, 4)

/** Which octave a note is written in on a keyboard key. */
export const KEY_OCTAVE = 4

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
 * spanning a seventh — and it moves the chord as one, so its shape is kept.
 * Generated questions are checked against the same range afterwards and a
 * bass that will not fit is simply not used; this is what keeps a player's
 * own chord from running off the page, where there is no such second chance.
 */
function ontoTheStaff(chord: readonly Pitch[]): readonly Pitch[] {
  const { lowest, highest } = getClef('treble')
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
 * the default register, which is what a first chord does.
 */
export function voiceChord(
  notes: readonly PitchClass[],
  near: Pitch = DEFAULT_REGISTER,
): readonly Pitch[] {
  const first = notes[0]
  if (first === undefined) return []

  const placed: Pitch[] = [nearest(near, first)]
  for (const note of notes.slice(1)) {
    placed.push(above(placed[placed.length - 1] as Pitch, note))
  }

  return ontoTheStaff(placed)
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
): readonly (readonly Pitch[])[] {
  const voiced: (readonly Pitch[])[] = []
  let previous = near

  for (const chord of chords) {
    const placed = voiceChord(chord, previous)
    voiced.push(placed)
    previous = placed[0] ?? previous
  }

  return voiced
}
