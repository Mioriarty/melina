import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ActivityChart, type ActivityPoint } from '@/components/progress/ActivityChart'
import { ActivityHeatmap } from '@/components/progress/ActivityHeatmap'
import { AccuracyList } from '@/components/progress/AccuracyList'
import { Icon } from '@/components/ui/Icon'
import { exerciseTitleKey } from '@/config/curriculum'
import { useAttemptLog } from '@/hooks/useAttemptLog'
import { useMusicNames } from '@/hooks/useMusicNames'
import {
  dailyActivity,
  dayKey,
  dayStart,
  daysBetween,
  groupBy,
  shiftDay,
  streakOf,
  tally,
  type DayActivity,
  type Group,
} from '@/lib/db/history'
import { isClefId } from '@/lib/music/clef'
import { parseIntervalKey } from '@/lib/music/interval'
import { isKeySignatureId } from '@/lib/music/keySignature'
import { isModeId } from '@/lib/music/scale'
import { cn } from '@/lib/utils/cn'

/**
 * Progress.
 *
 * Reached from the streak button at the right of the header, and — like
 * Settings — not a station on the path, because it is not something you
 * practise. It answers three questions in the order they get asked: how much
 * have I done, when did I do it, and what am I actually bad at.
 *
 * Everything here is a different cut of the same attempt log, read once and
 * sliced in memory. Nothing is stored that is not already an answered
 * question — a streak is a fact about the log, not a counter that could drift
 * out of step with it.
 */

/** The spans the chart offers, and how many days each column covers. */
const RANGES = [
  { id: 'fortnight', days: 14, bucket: 1 },
  { id: 'weeks', days: 56, bucket: 1 },
  { id: 'year', days: 364, bucket: 7 },
] as const

type RangeId = (typeof RANGES)[number]['id']

/** How many weeks of squares the heatmap shows. */
const HEATMAP_WEEKS = 26

/** Monday on or before a day, so heatmap columns are whole weeks. */
function mondayOnOrBefore(day: string): string {
  const weekday = new Date(dayStart(day)).getDay()
  // getDay is Sunday-first; Monday-first is what a practice week reads as.
  return shiftDay(day, -((weekday + 6) % 7))
}

/** Group consecutive days into columns, so a year fits in 52 of them. */
function bucketed(days: readonly DayActivity[], size: number): ActivityPoint[] {
  const points: ActivityPoint[] = []

  for (let index = 0; index < days.length; index += size) {
    const slice = days.slice(index, index + size)
    const first = slice[0]
    if (first === undefined) continue

    points.push({
      day: first.day,
      span: slice.length,
      total: slice.reduce((sum, day) => sum + day.total, 0),
      correct: slice.reduce((sum, day) => sum + day.correct, 0),
    })
  }

  return points
}

export default function ProgressPage() {
  const { t, i18n } = useTranslation(['progress', 'common', 'curriculum'])
  const names = useMusicNames()
  const rows = useAttemptLog()

  const [range, setRange] = useState<RangeId>('fortnight')
  const [selected, setSelected] = useState<string>()
  // Read once, when the screen opens. A fresh clock on every render is both
  // impure and pointless: nothing here changes minute to minute, and a page
  // left open across midnight redrawing itself under the reader is worse
  // than one that keeps the day it was opened on.
  const [now] = useState(() => Date.now())

  const today = dayKey(now)
  const activity = useMemo(() => dailyActivity(rows ?? []), [rows])

  const span = RANGES.find((entry) => entry.id === range) ?? RANGES[0]
  const chartDays = daysBetween(activity, shiftDay(today, -(span.days - 1)), today)
  const points = bucketed(chartDays, span.bucket)

  const heatmapDays = daysBetween(
    activity,
    mondayOnOrBefore(shiftDay(today, -(HEATMAP_WEEKS * 7 - 1))),
    today,
  )

  const streak = streakOf(
    activity.filter((day) => day.total > 0).map((day) => day.day),
    now,
  )
  const overall = tally(rows ?? [])

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const shortFormat = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
  })

  /** A column's own words: one day, or the week it opens. */
  const spanLabel = (point: { day: string; span: number }) =>
    point.span === 1
      ? dateFormat.format(dayStart(point.day))
      : t('progress:chart.week', {
          from: shortFormat.format(dayStart(point.day)),
          to: shortFormat.format(dayStart(shiftDay(point.day, point.span - 1))),
        })

  const describe = (point: {
    day: string
    span: number
    total: number
    correct: number
  }) =>
    point.total === 0
      ? t('progress:chart.emptyDay', { day: spanLabel(point) })
      : t('progress:chart.day', {
          day: spanLabel(point),
          answers: point.total,
          percent: Math.round((point.correct / point.total) * 100),
        })

  const shown = points.find((point) => point.day === selected)

  const byExercise = useMemo(() => {
    const groups = new Map<string, Group>()
    for (const row of rows ?? []) {
      const group = groups.get(row.exerciseId) ?? {
        value: row.exerciseId,
        correct: 0,
        total: 0,
      }
      group.total += 1
      if (row.correct) group.correct += 1
      groups.set(row.exerciseId, group)
    }
    return [...groups.values()]
  }, [rows])

  const group = (dimension: string) => groupBy(rows ?? [], dimension)

  const exerciseName = (id: string) => {
    const [category, exercise] = id.split('/')
    return category === undefined || exercise === undefined
      ? id
      : t(exerciseTitleKey(category, exercise))
  }

  const intervalName = (key: string) => {
    const interval = parseIntervalKey(key)
    return interval === undefined ? key : names.interval(interval)
  }

  const describeRow = (row: Group) =>
    t('progress:lists.row', {
      percent: Math.round((row.correct / row.total) * 100),
      answers: row.total,
    })

  const stats: readonly { label: string; value: string }[] = [
    { label: t('progress:stats.answers'), value: `${overall.total}` },
    { label: t('progress:stats.days'), value: `${activity.length}` },
    {
      label: t('progress:stats.accuracy'),
      value:
        overall.total === 0
          ? '—'
          : `${Math.round((overall.correct / overall.total) * 100)}%`,
    },
    { label: t('progress:stats.longest'), value: `${streak.longest}` },
  ]

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
        <header className="mb-6">
          <h1 className="text-title">{t('progress:title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t('progress:blurb')}</p>
        </header>

        {rows === undefined ? null : rows.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-rule p-6 text-center">
            <p className="leading-relaxed text-ink-muted">{t('progress:empty')}</p>
            <Link
              to="/"
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <Icon name="arrowBack" size={18} />
              {t('progress:toPath')}
            </Link>
          </section>
        ) : (
          <>
            <section aria-label={t('progress:stats.title')} className="mb-8">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-rule bg-paper-raised p-3"
                  >
                    <dt className="text-xs text-ink-faint">{stat.label}</dt>
                    <dd className="tabular mt-0.5 font-serif text-2xl font-semibold">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mb-8 border-t border-rule pt-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-heading">{t('progress:chart.title')}</h2>
                <div
                  className="flex gap-1"
                  role="group"
                  aria-label={t('progress:chart.range')}
                >
                  {RANGES.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={entry.id === range}
                      onClick={() => {
                        setRange(entry.id)
                        setSelected(undefined)
                      }}
                      className={cn(
                        'min-h-11 rounded-full px-3.5 text-[0.8125rem] font-medium transition-colors',
                        entry.id === range
                          ? 'bg-accent text-white'
                          : 'text-ink-muted hover:bg-accent-tint hover:text-accent',
                      )}
                    >
                      {t(`progress:chart.ranges.${entry.id}`)}
                    </button>
                  ))}
                </div>
              </div>

              <ActivityChart
                points={points}
                selected={selected}
                onSelect={setSelected}
                labelFor={describe}
              />

              {/* The height is held whether or not a column is picked, so
                  moving along the chart does not shift everything under it. */}
              <p className="mt-2 min-h-10 text-sm text-ink-muted">
                {shown === undefined ? t('progress:chart.pick') : describe(shown)}
              </p>
            </section>

            <section className="mb-8 border-t border-rule pt-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-heading">{t('progress:heatmap.title')}</h2>
                <p className="tabular text-sm text-ink-muted">
                  {t('progress:heatmap.streak', { count: streak.current })}
                </p>
              </div>

              <ActivityHeatmap
                days={heatmapDays}
                summary={t('progress:heatmap.summary', {
                  weeks: HEATMAP_WEEKS,
                  days: heatmapDays.filter((day) => day.total > 0).length,
                })}
                labelFor={(day) => describe({ ...day, span: 1 })}
              />
              <p className="mt-2 text-xs text-ink-faint">{t('progress:heatmap.hint')}</p>
            </section>

            <div className="grid gap-8">
              <AccuracyList
                title={t('progress:lists.exercises')}
                hint={t('progress:lists.exercisesHint')}
                rows={byExercise}
                labelFor={exerciseName}
                empty={t('progress:lists.none')}
                describe={describeRow}
              />

              <AccuracyList
                title={t('progress:lists.intervals')}
                hint={t('progress:lists.intervalsHint')}
                rows={group('interval')}
                labelFor={intervalName}
                empty={t('progress:lists.none')}
                describe={describeRow}
              />

              <AccuracyList
                title={t('progress:lists.modes')}
                hint={t('progress:lists.modesHint')}
                rows={group('mode')}
                labelFor={(value) => (isModeId(value) ? names.mode(value) : value)}
                empty={t('progress:lists.none')}
                describe={describeRow}
              />

              <AccuracyList
                title={t('progress:lists.clefs')}
                rows={group('clef')}
                labelFor={(value) => (isClefId(value) ? names.clef(value) : value)}
                empty={t('progress:lists.none')}
                describe={describeRow}
              />

              <AccuracyList
                title={t('progress:lists.keys')}
                hint={t('progress:lists.keysHint')}
                rows={group('keySignature')}
                labelFor={(value) =>
                  isKeySignatureId(value) ? names.keyMajorName(value) : value
                }
                empty={t('progress:lists.none')}
                describe={describeRow}
              />

              <AccuracyList
                title={t('progress:lists.roots')}
                hint={t('progress:lists.rootsHint')}
                rows={group('root')}
                labelFor={(value) => names.tonic(value)}
                empty={t('progress:lists.none')}
                describe={describeRow}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
