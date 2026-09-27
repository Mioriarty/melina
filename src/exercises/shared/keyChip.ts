import type { MusicNames } from '@/hooks/useMusicNames'
import { keySignatureFor } from '@/lib/music/degree'
import type { Pitch } from '@/lib/music/pitch'
import { tonicKey, type ModeId } from '@/lib/music/scale'

import type { ChipLabel } from './round'

/**
 * A key as a summary square prints it.
 *
 * Major and minor by the names a key signature already has — `E♭` and `Gm`,
 * or `Es` and `g` in German, where the case is what says minor — because that
 * is how a key is written in the margin of a score. Everything else is its
 * tonic over the mode's abbreviation, and harmonic and melodic minor are the
 * minor key with theirs underneath.
 */
export function keyChip(names: MusicNames, tonic: Pitch, mode: ModeId): ChipLabel {
  const signature = keySignatureFor(tonic, mode)

  if (signature !== undefined) {
    if (mode === 'ionian') return { main: names.keyMajor(signature) }
    if (mode === 'aeolian') return { main: names.keyMinor(signature) }
    if (mode === 'harmonicMinor' || mode === 'melodicMinor') {
      return { main: names.keyMinor(signature), sub: names.modeShort(mode) }
    }
  }

  return { main: names.tonic(tonicKey(tonic)), sub: names.modeShort(mode) }
}
