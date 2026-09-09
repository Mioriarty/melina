import { cn } from '@/lib/utils/cn'

/**
 * How much practice, when, and how accurate — in one picture.
 *
 * Two scales stacked rather than overlaid: accuracy runs across the upper
 * band and volume stands as bars along the bottom. Sharing one axis between a
 * percentage and a count means neither can be read, and the two questions are
 * genuinely different — a bad day at forty answers and a bad day at four look
 * identical on a line alone.
 *
 * Drawn by hand in SVG rather than with a charting library: the whole app is
 * a few hundred kilobytes of precache, and this is a polyline and some
 * rectangles.
 */

export interface ActivityPoint {
  /** Day key of the column, or of the first day when it covers several. */
  day: string
  /** How many days the column covers — 1 for a day, 7 for a week. */
  span: number
  total: number
  correct: number
}

export interface ActivityChartProps {
  points: readonly ActivityPoint[]
  /** The column whose detail is being shown, if any. */
  selected: string | undefined
  onSelect: (day: string | undefined) => void
  /** Accessible name for a column: what it covers and how it went. */
  labelFor: (point: ActivityPoint) => string
}

/** Coordinate space. Stretched horizontally to whatever width it is given. */
const WIDTH = 100
const HEIGHT = 56
/** Where the accuracy band ends and the volume bars begin. */
const SPLIT = 34
const GAP = 4

export function ActivityChart({
  points,
  selected,
  onSelect,
  labelFor,
}: ActivityChartProps) {
  const step = WIDTH / Math.max(points.length, 1)
  const busiest = Math.max(...points.map((point) => point.total), 1)

  const x = (index: number) => index * step + step / 2
  /** Accuracy across the upper band: 100% at the top, 0% at the split. */
  const y = (rate: number) => SPLIT - rate * SPLIT

  // Broken into runs, so a week off leaves a gap in the line rather than a
  // straight edge implying the accuracy either side is connected.
  const runs: { index: number; rate: number }[][] = []
  let run: { index: number; rate: number }[] = []
  points.forEach((point, index) => {
    if (point.total === 0) {
      if (run.length > 0) runs.push(run)
      run = []
      return
    }
    run.push({ index, rate: point.correct / point.total })
  })
  if (run.length > 0) runs.push(run)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full sm:h-48"
        aria-hidden="true"
      >
        {/* Halfway and full marks, so a point on the line can be read
            without hunting for a number. Strokes are marked non-scaling so
            the horizontal stretch does not thicken them. */}
        {[0, 0.5, 1].map((mark) => (
          <line
            key={mark}
            x1={0}
            x2={WIDTH}
            y1={y(mark)}
            y2={y(mark)}
            className="stroke-rule"
            strokeWidth={1}
            strokeDasharray={mark === 0 ? undefined : '2 3'}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {points.map((point, index) => {
          if (point.total === 0) return null
          const height = ((HEIGHT - SPLIT - GAP) * point.total) / busiest
          return (
            <rect
              key={point.day}
              x={index * step + step * 0.15}
              width={step * 0.7}
              y={HEIGHT - height}
              height={height}
              rx={0.6}
              className={cn(
                'transition-colors duration-150',
                point.day === selected ? 'fill-accent' : 'fill-accent/30',
              )}
            />
          )
        })}

        {runs.map((points_) => (
          <polyline
            key={points_[0]?.index}
            points={points_.map((p) => `${x(p.index)},${y(p.rate)}`).join(' ')}
            fill="none"
            className="stroke-accent"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {points.map((point, index) =>
          point.total === 0 || point.day !== selected ? null : (
            <circle
              key={point.day}
              cx={x(index)}
              cy={y(point.correct / point.total)}
              r={2.5}
              className="fill-paper-raised stroke-accent"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
      </svg>

      {/* Real buttons over the drawing rather than pointer handlers on the
          SVG: this way every column is reachable by keyboard and announces
          what it holds, which no amount of hover tooltip would give. */}
      <div className="absolute inset-0 flex">
        {points.map((point) => (
          <button
            key={point.day}
            type="button"
            aria-pressed={point.day === selected}
            onClick={() => onSelect(point.day === selected ? undefined : point.day)}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') onSelect(point.day)
            }}
            className="min-w-0 flex-1 rounded-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <span className="sr-only">{labelFor(point)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
