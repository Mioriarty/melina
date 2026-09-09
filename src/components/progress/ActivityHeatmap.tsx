import type { DayActivity } from '@/lib/db/history'
import { cn } from '@/lib/utils/cn'

/**
 * Months of practice at a glance.
 *
 * A square per day, a column per week, darker the more was answered. It says
 * nothing the chart does not, and it says it differently: the chart shows a
 * fortnight in detail, this shows the shape of a season — which weeks were
 * kept up and which quietly went missing.
 *
 * Volume, not accuracy. Two quantities on one square would need two visual
 * channels and read as neither.
 *
 * Deliberately **a picture, not a control**. Half a year of squares across a
 * phone is ten pixels each, which is a target no thumb can hit and no
 * accessibility rule would allow. Picking a day belongs to the chart, whose
 * columns are the full height of the plot; here a `title` gives a mouse the
 * same detail for free, and the grid carries one accessible summary rather
 * than a hundred and eighty announcements nobody would tab through.
 */

export interface ActivityHeatmapProps {
  /**
   * Every day in range, oldest first, gaps included. The first entry must be
   * a Monday: the grid fills column by column, so the range's own start is
   * what puts a day in its weekday row — there is no padding to get wrong.
   */
  days: readonly DayActivity[]
  /** What the whole picture says, for a screen reader. */
  summary: string
  /** One day's detail, shown to a mouse as a native tooltip. */
  labelFor: (day: DayActivity) => string
}

/**
 * Four steps rather than a continuous ramp: a gradient invites comparing two
 * squares that differ by one answer, which is not a difference worth reading.
 */
function level(total: number, busiest: number): number {
  if (total === 0) return 0
  return Math.min(3, Math.floor((total / Math.max(busiest, 1)) * 3)) + 1
}

const FILLS = [
  'bg-rule/50',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const

export function ActivityHeatmap({ days, summary, labelFor }: ActivityHeatmapProps) {
  const busiest = Math.max(...days.map((day) => day.total), 1)

  return (
    <div
      role="img"
      aria-label={summary}
      className="grid grid-flow-col gap-[3px]"
      style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
    >
      {days.map((day) => (
        <div
          key={day.day}
          title={labelFor(day)}
          className={cn('aspect-square rounded-[2px]', FILLS[level(day.total, busiest)])}
        />
      ))}
    </div>
  )
}
