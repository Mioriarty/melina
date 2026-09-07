import { CONNECTORS, PATH_HEIGHT } from '@/config/pathLayout'
import { cn } from '@/lib/utils/cn'

export interface PathConnectorsProps {
  reducedMotion: boolean
}

/**
 * The dashed route linking one station to the next.
 *
 * One SVG for the whole column, with a `0 0 100 PATH_HEIGHT` viewBox and
 * `preserveAspectRatio="none"`: x units become percentages of the column
 * width and y units stay pixels, which is exactly the space the connectors
 * are authored in. The horizontal stretch that implies would smear the dash
 * pattern, so strokes are marked non-scaling and render in screen units.
 */
export function PathConnectors({ reducedMotion }: PathConnectorsProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0"
      width="100%"
      height={PATH_HEIGHT}
      viewBox={`0 0 100 ${PATH_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {CONNECTORS.map((connector, index) => (
        <path
          key={connector.id}
          d={connector.d}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity={0.34}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="1 13"
          vectorEffect="non-scaling-stroke"
          className={cn(!reducedMotion && 'path-connector')}
          style={reducedMotion ? undefined : { animationDelay: `${index * 110 + 180}ms` }}
        />
      ))}
    </svg>
  )
}
