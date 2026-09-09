import { useEffect, useState } from 'react'

import type { ClefId } from '@/lib/music/clef'
import type { KeySignatureId } from '@/lib/music/keySignature'
import { pitchKey, type Pitch } from '@/lib/music/pitch'
import { degreeKeyMei } from '@/lib/notation/mei'
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
  /** What the staff shows, for a screen reader. Usually the key already says. */
  label?: string
  className?: string
}

export function MiniStaff({
  pitch,
  clef,
  keySignature,
  label,
  className,
}: MiniStaffProps) {
  const cacheKey = `${clef}|${keySignature}|${pitchKey(pitch)}`
  const [rendered, setRendered] = useState<{ key: string; svg: string }>()

  // A hit is available on the very first render, so a keyboard that has been
  // drawn before never flashes empty.
  const cached = RENDERS.get(cacheKey)
  const svg = cached ?? (rendered?.key === cacheKey ? rendered.svg : undefined)

  useEffect(() => {
    if (RENDERS.has(cacheKey)) return
    let active = true

    renderMei(degreeKeyMei({ pitch, clef, keySignature }), undefined, DEGREE_KEY_PROFILE)
      .then((result) => {
        RENDERS.set(cacheKey, result)
        // The engraver is shared and asynchronous, so a key that changed while
        // a render was in flight must not be overwritten by the older one.
        if (active) setRendered({ key: cacheKey, svg: result })
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [cacheKey, pitch, clef, keySignature])

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
