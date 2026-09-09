import type { Group } from '@/lib/db/history'
import { cn } from '@/lib/utils/cn'

/**
 * Accuracy broken down one dimension at a time.
 *
 * Ordered weakest first, because that is the question being asked: a list you
 * read from the top tells you what to practise next. Strengths are still
 * there — they are simply at the other end, which is where they belong.
 *
 * The bar is redundant with the number on purpose. A column of percentages is
 * a table to be read; a column of bars is a shape to be glanced at, and the
 * glance is what makes a weak spot obvious.
 */

export interface AccuracyListProps {
  title: string
  /** One line under the title, saying what the rows are. */
  hint?: string
  rows: readonly Group[]
  /** The translated name for a row's value: `A4` becomes `Augmented fourth`. */
  labelFor: (value: string) => string
  /** Rendered when there is nothing to show yet. */
  empty: string
  /** `{{count}} answers` and `{{percent}}% correct`, already interpolated. */
  describe: (row: Group) => string
}

export function AccuracyList({
  title,
  hint,
  rows,
  labelFor,
  empty,
  describe,
}: AccuracyListProps) {
  // Weakest first; a tie goes to whichever has been answered more often,
  // since that is the one the figure is more confident about.
  const ordered = [...rows].sort(
    (a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total,
  )

  return (
    <section className="border-t border-rule pt-5">
      <h2 className="text-heading">{title}</h2>
      {hint !== undefined && (
        <p className="mt-1 text-sm leading-relaxed text-ink-faint">{hint}</p>
      )}

      {ordered.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {ordered.map((row) => {
            const percent = Math.round((row.correct / row.total) * 100)
            return (
              <li key={row.value} className="grid gap-1">
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {labelFor(row.value)}
                  </span>
                  <span className="tabular shrink-0 text-sm text-ink-muted">
                    {percent}%
                  </span>
                  <span className="tabular w-10 shrink-0 text-right text-xs text-ink-faint">
                    {row.total}
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-rule/60"
                  role="img"
                  aria-label={describe(row)}
                >
                  <div
                    className={cn(
                      'h-full rounded-full',
                      percent >= 80 ? 'bg-accent' : 'bg-accent/55',
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
