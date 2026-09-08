import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * The two pieces every setup screen is built from.
 *
 * Four exercises now offer the same kind of choice — a titled group of
 * toggles, sometimes with a line explaining what the choice changes — and a
 * chip that reads or behaves differently in one of them would look like a
 * bug rather than a variation.
 */

export interface SetupSectionProps {
  title: string
  /** One line on what this choice actually does, where it is not obvious. */
  hint?: string
  children: ReactNode
}

export function SetupSection({ title, hint, children }: SetupSectionProps) {
  return (
    <section className="border-t border-rule py-5 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="mb-1 text-heading">{title}</h2>
      {hint !== undefined && (
        <p className="mb-3 text-sm leading-relaxed text-ink-faint">{hint}</p>
      )}
      <div className={hint === undefined ? 'mt-3' : undefined}>{children}</div>
    </section>
  )
}

export interface SetupChipProps {
  selected: boolean
  onClick: () => void
  /** Spoken name, where the visible text is an abbreviation or a symbol. */
  label?: string
  children: ReactNode
}

export function SetupChip({ selected, onClick, label, children }: SetupChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-3.5 text-[0.8125rem] font-medium',
        'transition-[background-color,border-color,color] duration-150',
        selected
          ? 'border-accent bg-accent-tint text-accent'
          : 'border-rule bg-paper-raised text-ink-muted hover:border-accent hover:text-accent',
      )}
    >
      {children}
    </button>
  )
}
