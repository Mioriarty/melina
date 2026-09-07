import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export interface KeyboardShellProps {
  children: ReactNode
  className?: string
}

/**
 * The bar that every answer keyboard sits in.
 *
 * Anchored to the bottom of the exercise with a rounded top edge, so it reads
 * as a panel lifted over the page rather than as the end of it. Shared rather
 * than written per keyboard: the note keyboard and anything after it should
 * look and behave identically, and only the keys inside should differ.
 *
 * The keys scroll within the bar and the bar itself never grows past roughly
 * half the viewport, so a tall keyboard can never push the notation off the
 * top of the screen.
 */
export function KeyboardShell({ children, className }: KeyboardShellProps) {
  return (
    <div
      className={cn(
        'pb-safe shrink-0 rounded-t-2xl border-x border-t border-rule bg-paper/95',
        'shadow-[0_-6px_24px_rgb(16_16_18/0.07)] backdrop-blur-md',
        // Key labels are targets, not prose. Without this, dragging across
        // the keys selects their text, and on touch a long press pops the
        // selection callout in the middle of answering.
        'select-none',
        className,
      )}
    >
      <div className="mx-auto max-h-[46dvh] w-full max-w-2xl overflow-y-auto overscroll-contain px-4 py-3 sm:px-6">
        {children}
      </div>
    </div>
  )
}
