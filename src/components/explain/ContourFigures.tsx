import { useTranslation } from 'react-i18next'

import { TICKS_PER_BEAT } from '@/lib/music/meter'

import {
  SHOWN_GAPS,
  SPAN,
  WIDTH_CHART_FROM,
  WIDTH_CHART_TO,
  WIDTH_MARKS,
  cappedAtBeats,
  comparisonRows,
  curvePoints,
  notePoints,
  peak,
  steadyPoints,
  widestShown,
  widthOf,
  widthPoints,
} from './contourSeries'

/**
 * The pictures on the melodic shape explainer.
 *
 * Hand-drawn SVG rather than a charting library, the same reasoning as
 * `ActivityChart`: the whole app is a few hundred kilobytes of precache and
 * these are polylines and rectangles.
 *
 * Every coordinate comes from `contourFigures.ts`, which computes from
 * `contour.ts` itself — so a turned constant moves the drawings with it and
 * the page cannot come to describe something the code no longer does.
 *
 * Each figure stretches to the width it is given and keeps a fixed aspect, so
 * a phone gets the same picture rather than a cropped one. Labels sit in HTML
 * around the plot rather than inside the SVG, which keeps them at a readable
 * size whatever the drawing is scaled to.
 */

/** How strongly each shown gap is drawn: the shortest darkest. */
const GAP_TONE = ['text-accent', 'text-accent/55', 'text-accent/30']

/**
 * The coordinate space, and why it scales the way it does.
 *
 * The drawing keeps its aspect ratio — no `preserveAspectRatio="none"` — so a
 * dot is a dot rather than an ellipse and the curve is not steeper on a wide
 * screen than a narrow one. What that costs is that the height follows the
 * width; the box is 100 by 30, which comes out around 190px on a desktop and
 * 100px on a phone, and both read.
 *
 * Strokes are marked non-scaling so they stay a constant thickness on screen
 * instead of growing with the drawing.
 */
const PLOT_WIDTH = 100
const PLOT_HEIGHT = 30
/** Kept clear at the edges so a marker on the last point is not half cut off. */
const INSET = 2

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
      role="img"
      aria-label={label}
      className="w-full"
    >
      {children}
    </svg>
  )
}

/* ------------------------------------------------------------- the curves */

/**
 * The heart of it: one curve per gap, all centred on the note just sung.
 *
 * The smooth line is the curve; the dots are the notes that actually exist to
 * be chosen, which is why the one at the centre sits below its own curve — the
 * unison is damped, and the drop is the only thing on this picture that is not
 * the curve.
 */
export function IntervalCurves() {
  const { t } = useTranslation('guide')

  const x = (d: number) => INSET + ((d + SPAN) / (SPAN * 2)) * (PLOT_WIDTH - INSET * 2)
  // The curve peaks at 1, and `pacedWeight` is on that same scale — so a dot
  // lands exactly on its curve, and the one at the centre lands below it.
  // Scaling the dots to their own tallest instead floated every one of them
  // above the line and made the notch impossible to read.
  const y = (value: number) => PLOT_HEIGHT - INSET - value * (PLOT_HEIGHT - INSET * 3)

  return (
    <figure className="mt-4">
      <div className="rounded-2xl border border-rule bg-paper-raised px-3 pt-3 pb-2">
        <Frame label={t('curves.figureLabel')}>
          {/* The last note, which every curve is measured from. */}
          <line
            x1={x(0)}
            y1={INSET}
            x2={x(0)}
            y2={PLOT_HEIGHT - INSET}
            className="stroke-rule"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={0}
            y1={PLOT_HEIGHT - INSET}
            x2={PLOT_WIDTH}
            y2={PLOT_HEIGHT - INSET}
            className="stroke-rule"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />

          {SHOWN_GAPS.map((gap, index) => {
            const line = curvePoints(gap.ticks)
              .map((point) => `${x(point.d)},${y(point.y)}`)
              .join(' ')
            return (
              <polyline
                key={gap.id}
                points={line}
                fill="none"
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
                className={GAP_TONE[index] ?? 'text-accent'}
                stroke="currentColor"
              />
            )
          })}

          {/* The notes themselves, on the shortest gap: the discrete choices. */}
          {notePoints(SHOWN_GAPS[0]?.ticks ?? 15).map((point) => (
            <circle
              key={point.d}
              cx={x(point.d)}
              cy={y(point.y)}
              r={0.7}
              className={point.d === 0 ? 'fill-wrong' : 'fill-accent'}
            />
          ))}
        </Frame>

        <div className="mt-1 flex justify-between text-[0.6875rem] text-ink-faint">
          <span>{t('curves.axisLow')}</span>
          <span className="font-medium text-ink-muted">{t('curves.axisCentre')}</span>
          <span>{t('curves.axisHigh')}</span>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem]">
        {SHOWN_GAPS.map((gap, index) => (
          <li key={gap.id} className="flex items-center gap-1.5 text-ink-muted">
            <span
              aria-hidden="true"
              className={`h-0.5 w-5 rounded-full bg-current ${GAP_TONE[index] ?? ''}`}
            />
            {t(`gaps.${gap.id}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-wrong" />
          {t('curves.notchKey')}
        </li>
      </ul>

      <figcaption className="mt-2 text-sm leading-relaxed text-ink-faint">
        {t('curves.caption')}
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------- width against gap */

/** How wide the curve gets, against how long there is — and where it stops. */
export function WidthByGap() {
  const { t } = useTranslation('guide')

  const capBeats = cappedAtBeats()
  const tallest = widestShown()

  const x = (beats: number) =>
    INSET +
    ((beats - WIDTH_CHART_FROM) / (WIDTH_CHART_TO - WIDTH_CHART_FROM)) *
      (PLOT_WIDTH - INSET * 2)
  const y = (width: number) =>
    PLOT_HEIGHT - INSET - (width / tallest) * (PLOT_HEIGHT - INSET * 3)

  const line = widthPoints()
    .map((point) => `${x(point.beats)},${y(point.width)}`)
    .join(' ')

  return (
    <figure className="mt-4">
      <div className="rounded-2xl border border-rule bg-paper-raised px-3 pt-3 pb-2">
        <Frame label={t('width.figureLabel')}>
          <line
            x1={0}
            y1={PLOT_HEIGHT - INSET}
            x2={PLOT_WIDTH}
            y2={PLOT_HEIGHT - INSET}
            className="stroke-rule"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />

          {/* Where it stops widening, so a long note never becomes a free-for-all. */}
          <line
            x1={x(capBeats)}
            y1={INSET}
            x2={x(capBeats)}
            y2={PLOT_HEIGHT - INSET}
            className="stroke-ink-faint"
            strokeWidth={0.6}
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            vectorEffect="non-scaling-stroke"
            className="text-accent"
          />

          {WIDTH_MARKS.map((mark) => (
            <circle
              key={mark.id}
              cx={x(mark.ticks / TICKS_PER_BEAT)}
              cy={y(widthOf(mark.ticks))}
              r={0.8}
              className="fill-accent"
            />
          ))}
        </Frame>

        <div className="mt-1 flex justify-between text-[0.6875rem] text-ink-faint">
          <span>{t('width.axisShort')}</span>
          <span>{t('width.axisLong')}</span>
        </div>
      </div>

      <figcaption className="mt-2 text-sm leading-relaxed text-ink-faint">
        {t('width.caption', {
          beats: capBeats.toFixed(1),
          narrow: widthOf(WIDTH_CHART_FROM * TICKS_PER_BEAT).toFixed(1),
          wide: widestShown().toFixed(1),
        })}
      </figcaption>
    </figure>
  )
}

/* -------------------------------------------------------------- the steps */

/** Steady, drawn as what it is: a staircase that ignores the rhythm. */
export function SteadySteps() {
  const { t } = useTranslation('guide')

  const points = steadyPoints()
  const tallest = peak(points)
  const barWidth = (PLOT_WIDTH - INSET * 2) / (SPAN * 2 + 1)
  const x = (d: number) => INSET + (d + SPAN) * barWidth

  return (
    <figure className="mt-4">
      <div className="rounded-2xl border border-rule bg-paper-raised px-3 pt-3 pb-2">
        <Frame label={t('steady.figureLabel')}>
          <line
            x1={x(0) + barWidth / 2}
            y1={INSET}
            x2={x(0) + barWidth / 2}
            y2={PLOT_HEIGHT - INSET}
            className="stroke-rule"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point) => {
            const height = (point.y / tallest) * (PLOT_HEIGHT - INSET * 3)
            return (
              <rect
                key={point.d}
                x={x(point.d) + barWidth * 0.15}
                y={PLOT_HEIGHT - INSET - height}
                width={barWidth * 0.7}
                height={Math.max(height, 0.4)}
                rx={0.4}
                className={point.d === 0 ? 'fill-wrong' : 'fill-accent'}
              />
            )
          })}
        </Frame>

        <div className="mt-1 flex justify-between text-[0.6875rem] text-ink-faint">
          <span>{t('curves.axisLow')}</span>
          <span className="font-medium text-ink-muted">{t('curves.axisCentre')}</span>
          <span>{t('curves.axisHigh')}</span>
        </div>
      </div>

      <figcaption className="mt-2 text-sm leading-relaxed text-ink-faint">
        {t('steady.caption')}
      </figcaption>
    </figure>
  )
}

/* --------------------------------------------------------- the comparison */

/**
 * The same thing as a table, for the moves anyone can name — with a bar on
 * each number, because a grid of decimals is a thing to be believed rather
 * than read.
 */
export function IntervalComparison() {
  const { t } = useTranslation('guide')
  const rows = comparisonRows()

  return (
    <figure className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="pr-3 pb-2 font-medium text-ink-muted">
              {t('compare.move')}
            </th>
            {SHOWN_GAPS.map((gap) => (
              <th
                key={gap.id}
                scope="col"
                className="pb-2 pl-3 font-medium text-ink-muted"
              >
                {t('compare.after', { gap: t(`gaps.${gap.id}`) })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.semitones} className="border-b border-rule/60 last:border-0">
              <th
                scope="row"
                className="py-2 pr-3 text-left font-medium whitespace-nowrap text-ink"
              >
                {t(`compare.intervals.${row.semitones}`)}
              </th>
              {row.shares.map((share, index) => (
                <td key={index} className="py-2 pl-3 align-middle">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-rule"
                    >
                      <span
                        className={`block h-full rounded-full ${
                          row.semitones === 0 ? 'bg-wrong' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.max(share * 100, 1.5)}%` }}
                      />
                    </span>
                    <span className="tabular text-[0.8125rem] text-ink-muted">
                      {Math.round(share * 100)}%
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="mt-2 text-sm leading-relaxed text-ink-faint">
        {t('compare.caption')}
      </figcaption>
    </figure>
  )
}
