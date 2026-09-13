import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

import { PlayMark } from '@/components/notation/PlayMark'
import { usePlayback } from '@/exercises/shared/usePlayback'
import { cn } from '@/lib/utils/cn'

/**
 * An engraved example that can be heard.
 *
 * **A guide's staves are the same notation the exercises ask about, so they
 * follow the same rule: the notation is the play button.** A page explaining
 * what a Sextakkord is, or what `♭5` resolves to, or how lydian differs from
 * ionian, is describing a *sound* — and a reader who can only look at it is
 * being asked to take the whole page on trust. There is nothing to give away
 * here, unlike a reading question, so every example is pressable from the
 * moment it is drawn.
 *
 * It wraps the staff rather than replacing it, and adds nothing to the layout
 * but `position: relative` — the caller passes the display it already had, so
 * making an example playable moves no geometry. That matters most in the
 * figured bass guide, where the height has to come down a definite chain or
 * the staff sizes the box that was supposed to size it.
 *
 * Each example holds its own `usePlayback`, so the samples arriving and a
 * failure are reported where they happened. Stopping is global, so pressing
 * one example silences another — which is what a reader comparing two of them
 * wants anyway.
 */

export interface PlayableExampleProps {
  /**
   * Sounds the example. **Must be a stable reference**: `usePlayback` hangs
   * its silence on this identity changing, so a closure rebuilt every render
   * would stop the sound it had just started.
   */
  sound: () => Promise<void>
  /** What the notation shows, for the button's name. */
  label: string
  /** The classes the staff itself carried, so wrapping it changes no layout. */
  className?: string
  children: ReactNode
}

export function PlayableExample({
  sound,
  label,
  className,
  children,
}: PlayableExampleProps) {
  const { t } = useTranslation('common')
  const { status, play } = usePlayback(sound)

  return (
    <button
      type="button"
      onClick={play}
      disabled={status === 'failed'}
      // Both halves in one name: what is on the staff, and what pressing it
      // does. A button takes its name from this rather than from the image
      // inside it, so the description has to be here or it is lost.
      aria-label={t('play.scoreLabel', { notes: label })}
      className={cn(
        'relative rounded-2xl transition-[background-color,transform] duration-150',
        // The press has to be felt on a touch screen, where there is no hover
        // to say a thing is pressable and nothing else answers a tap.
        'hover:bg-accent-tint/70 active:scale-[0.98] active:bg-accent-tint',
        'disabled:cursor-default disabled:bg-transparent disabled:active:scale-100',
        className,
      )}
    >
      {children}
      <PlayMark status={status} />
    </button>
  )
}
