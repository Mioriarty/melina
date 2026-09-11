import { diatonicValue, type Pitch } from '@/lib/music/pitch'
import type { PitchClass } from '@/lib/music/scale'

/**
 * Where the notes of a chord actually sit.
 *
 * **A figure says which notes, never where they sit** — a realisation an octave
 * up, or with the notes in another order, is the same answer. But something has
 * to put them on a staff, and if the staff and the verdict worked it out
 * separately they could disagree about what the player had written. So this is
 * the one place that decides, and both of them read it.
 *
 * The rule is the plainest one there is: **each note goes at the lowest place
 * above the one before it**. Close position, building upward, which is the
 * texture a continuo player's right hand actually makes. It also means the
 * player never chooses an octave, which is what "the figure underdetermines the
 * octave" ought to feel like — you say *which note*, and it lands.
 *
 * Position is by staff line rather than by sound, because what must not collide
 * is two noteheads on one line. The letters in a chord are always distinct, so
 * a run of them is strictly rising on the staff and nothing can ever stack.
 */
export function voiceChord(floor: Pitch, notes: readonly PitchClass[]): readonly Pitch[] {
  const placed: Pitch[] = []
  let below = floor

  for (const note of notes) {
    let candidate: Pitch = { ...note, octave: below.octave }
    while (diatonicValue(candidate) <= diatonicValue(below)) {
      candidate = { ...note, octave: candidate.octave + 1 }
    }
    placed.push(candidate)
    below = candidate
  }

  return placed
}
