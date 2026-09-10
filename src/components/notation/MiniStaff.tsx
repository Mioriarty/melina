import { useEffect, useState } from 'react'

import type { ClefId } from '@/lib/music/clef'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { pitchKey, type Pitch } from '@/lib/music/pitch'
import type { NoteValue } from '@/lib/notation/rhythmNotation'
import { degreeKeyMei } from '@/lib/notation/mei'
import { cropToStaff } from '@/lib/notation/cropToStaff'
import { DEGREE_KEY_PROFILE, renderMei } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

/**
 * One note on a bare staff, small enough to sit on a keyboard key.
 *
 * **Cached across mounts, and that is the point of the component.** A key costs
 * about eight milliseconds to engrave, a keyboard has seven of them, and the
 * keyboard remounts on every question. Without the cache each question would
 * spend a visible moment with seven blank keys, and a key that draws late is a
 * key that moves under a thumb.
 *
 * The cache is keyed by everything the picture depends on, so a round that
 * stays in one key engraves its keyboard exactly once.
 */

const RENDERS = new Map<string, string>()

export interface MiniStaffProps {
  pitch: Pitch
  clef: ClefId
  keySignature: KeySignatureId
  /**
   * The note value to draw it as. A plain quarter unless the key is a preview
   * of something else — melodic dictation draws each pitch key as the value
   * that pressing it would actually write.
   */
  dur?: NoteValue
  dots?: 0 | 1
  /** What the staff shows, for a screen reader. Usually the key already says. */
  label?: string
  className?: string
}

export function MiniStaff({
  pitch,
  clef,
  keySignature,
  dur = 4,
  dots = 0,
  label,
  className,
}: MiniStaffProps) {
  const cacheKey = `${clef}|${keySignature}|${pitchKey(pitch)}|${dur}.${dots}`
  const [rendered, setRendered] = useState<{ key: string; svg: string }>()

  // A hit is available on the very first render, so a keyboard that has been
  // drawn before never flashes empty.
  //
  // On a miss the **last** picture is kept rather than nothing. Melodic
  // dictation redraws its whole row of pitch keys whenever the note value
  // changes, and blanking them for the few milliseconds that takes made the
  // keyboard flicker under the hand that had just pressed a key. A note of the
  // previous value is a better thing to show for one frame than a hole.
  const cached = RENDERS.get(cacheKey)
  const svg = cached ?? rendered?.svg

  useEffect(() => {
    if (RENDERS.has(cacheKey)) return
    let active = true

    renderMei(
      degreeKeyMei({ pitch, clef, keySignature, dur, dots }),
      undefined,
      DEGREE_KEY_PROFILE,
    )
      .then((raw) => {
        const result = cropToStaff(raw)
        RENDERS.set(cacheKey, result)
        // The engraver is shared and asynchronous, so a key that changed while
        // a render was in flight must not be overwritten by the older one.
        if (active) setRendered({ key: cacheKey, svg: result })
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [cacheKey, pitch, clef, keySignature, dur, dots])

  if (svg === undefined) {
    // Holds the space rather than collapsing, so the key does not resize when
    // the note arrives.
    return <span className={cn('block', className)} aria-hidden="true" />
  }

  return (
    <span
      className={cn('block [&_svg]:h-full [&_svg]:w-auto [&_svg]:max-w-full', className)}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label })}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
