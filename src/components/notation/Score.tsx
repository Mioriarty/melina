import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_NOTE_SPACING, renderMei } from '@/lib/notation/verovio'
import type { VerovioOptions } from 'verovio/esm'
import { cn } from '@/lib/utils/cn'

export interface ScoreProps {
  /** MEI document to engrave. */
  mei: string
  /**
   * How much room each note gets — see `SCALE_NOTE_SPACING`. A scale needs
   * more of it than an interval, being eight notes wide.
   */
  noteSpacing?: number
  /**
   * What the notation shows, for screen readers — the clef, key and written
   * pitches. Describe what is drawn, never the answer to the question.
   */
  label: string
  /**
   * Page options for this render — `rhythmProfile(...)`, or nothing for the usual
   * shrink-to-content behaviour. Must be a stable reference: it is compared by
   * identity to decide whether a finished render still belongs to this call.
   */
  profile?: VerovioOptions
  className?: string
}

/** The last completed render, tagged with the input it came from. */
type Result = {
  mei: string
  noteSpacing: number
  profile: VerovioOptions | undefined
} & ({ status: 'ready'; svg: string } | { status: 'failed' })

/** Shared so an omitted profile is one stable reference, not a new object. */
const NO_PROFILE: VerovioOptions = {}

/**
 * Engraved notation.
 *
 * Verovio returns a complete SVG string, which is injected as markup. That is
 * safe here because the input is MEI this app generated itself from typed
 * pitch data — no user or network content ever reaches it.
 *
 * **Every Verovio render in the app passes through here**, which is what makes
 * one class enough to give engraved text the app's own serif — see the
 * `font-serif` note below.
 */
export function Score({
  mei,
  label,
  noteSpacing = DEFAULT_NOTE_SPACING,
  profile = NO_PROFILE,
  className,
}: ScoreProps) {
  const { t } = useTranslation('exercise')
  const [result, setResult] = useState<Result>()

  useEffect(() => {
    let active = true

    renderMei(mei, noteSpacing, profile)
      .then((svg) => {
        if (active) setResult({ mei, noteSpacing, profile, status: 'ready', svg })
      })
      .catch(() => {
        if (active) setResult({ mei, noteSpacing, profile, status: 'failed' })
      })

    // The engraver is shared and asynchronous, so a question that changes
    // while a render is in flight must not overwrite the newer one.
    return () => {
      active = false
    }
  }, [mei, noteSpacing, profile])

  // Derived rather than stored: a result for a previous question is simply
  // not this question's result, so it reads as pending without an extra
  // render to reset it.
  const state: Result | { status: 'pending' } =
    result?.mei === mei &&
    result.noteSpacing === noteSpacing &&
    result.profile === profile
      ? result
      : { status: 'pending' }

  if (state.status === 'failed') {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-2xl border border-dashed border-rule p-6 text-center text-sm text-ink-muted',
          className,
        )}
        role="status"
      >
        {t('score.failed')}
      </div>
    )
  }

  if (state.status === 'pending') {
    return (
      <div
        className={cn('grid place-items-center', className)}
        role="status"
        aria-label={t('score.pending')}
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
      //
      // `font-serif` overrides the `font-family="Times, serif"` Verovio writes
      // onto its inner `<svg>`. That is a *presentation attribute*, which the
      // cascade ranks below every author rule, so a plain class wins without
      // `!important`. It reaches only real `<text>` — staff labels, and later
      // any directive or tempo mark — because notation itself is drawn as
      // glyph outlines, not as type.
      className={cn(
        'flex items-center justify-center',
        '[&_svg]:h-auto [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:max-w-full',
        '[&_svg]:font-serif',
        className,
      )}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}
