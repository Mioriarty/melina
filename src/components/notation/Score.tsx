import { useEffect, useState } from 'react'

import { renderMei } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

export interface ScoreProps {
  /** MEI document to engrave. */
  mei: string
  /**
   * What the notation shows, for screen readers — the clef, key and written
   * pitches. Describe what is drawn, never the answer to the question.
   */
  label: string
  className?: string
}

/** The last completed render, tagged with the input it came from. */
type Result =
  { mei: string; status: 'ready'; svg: string } | { mei: string; status: 'failed' }

/**
 * Engraved notation.
 *
 * Verovio returns a complete SVG string, which is injected as markup. That is
 * safe here because the input is MEI this app generated itself from typed
 * pitch data — no user or network content ever reaches it.
 */
export function Score({ mei, label, className }: ScoreProps) {
  const [result, setResult] = useState<Result>()

  useEffect(() => {
    let active = true

    renderMei(mei)
      .then((svg) => {
        if (active) setResult({ mei, status: 'ready', svg })
      })
      .catch(() => {
        if (active) setResult({ mei, status: 'failed' })
      })

    // The engraver is shared and asynchronous, so a question that changes
    // while a render is in flight must not overwrite the newer one.
    return () => {
      active = false
    }
  }, [mei])

  // Derived rather than stored: a result for a previous question is simply
  // not this question's result, so it reads as pending without an extra
  // render to reset it.
  const state: Result | { status: 'pending' } =
    result?.mei === mei ? result : { status: 'pending' }

  if (state.status === 'failed') {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-2xl border border-dashed border-rule p-6 text-center text-sm text-ink-muted',
          className,
        )}
        role="status"
      >
        The notation could not be drawn.
      </div>
    )
  }

  if (state.status === 'pending') {
    return (
      <div
        className={cn('grid place-items-center', className)}
        role="status"
        aria-label="Drawing the notation"
      >
        <span className="h-24 w-48 animate-pulse rounded-lg bg-ink/5" />
      </div>
    )
  }

  return (
    <div
      // The SVG carries its own width and height, so `auto` plus the two
      // maximums scales it down proportionally when it will not fit —
      // narrow screens especially — and otherwise leaves it at its natural,
      // consistent size.
      className={cn(
        'flex items-center justify-center',
        '[&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full',
        className,
      )}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}
