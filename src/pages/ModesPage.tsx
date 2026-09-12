import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { ModeExample } from '@/components/explain/ModeExamples'
import { ModeTable } from '@/components/explain/ModeTable'
import { Icon } from '@/components/ui/Icon'
import { DIATONIC_MODE_IDS, MINOR_SCALE_IDS } from '@/lib/music/scale'
import { preloadEngraver } from '@/lib/notation/verovio'

/**
 * What the seven modes are, what the two minor scales beside them are, and the
 * shortcut for remembering all nine.
 *
 * A stop on the path at the head of the scales column, and the question mark
 * in the corner of the Modes setting on all three scale exercises: this is
 * the vocabulary every one of them is built on, so it is owed before the
 * first round rather than only to somebody already in the settings. `?from=`
 * says which exercise opened it, and no `?from=` at all means the path.
 *
 * **Everything on it is `scale.ts` evaluated** — the staves through
 * `scalePitches`, the shorthand and the table through `modeSeries.ts` — for the
 * same reason the melodic shape guide plots `contour.ts` rather than a drawing
 * of it: a page that describes a model by hand can come to describe something
 * the app no longer does.
 */
export default function ModesPage() {
  const { t } = useTranslation(['guide', 'curriculum'])
  const [params] = useSearchParams()

  // Nine staves, and this may well be the first thing in a session to want
  // the engraver — asked for on mount rather than by whichever `Score` renders
  // first.
  useEffect(preloadEngraver, [])

  // Which exercise opened it, so reading it never costs the player their
  // place: the settings survive the trip in Dexie but *which screen was
  // showing* is React state and does not. An unrecognised value is treated as
  // the path rather than trusted into a route.
  const from = params.get('from')
  const exercise =
    from === 'reading' || from === 'hearing' || from === 'degrees' ? from : undefined
  const back = exercise === undefined ? '/' : `/train/scales/${exercise}?screen=setup`

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-7">
          <Link
            to={back}
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t(exercise === undefined ? 'guide:backToPath' : 'guide:back')}
          </Link>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            {t('curriculum:categories.scales.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:modes.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t('guide:modes.intro')}</p>
        </header>

        <Section title={t('guide:modes.what.title')}>
          <p>{t('guide:modes.what.body')}</p>
          <p>{t('guide:modes.what.after')}</p>
        </Section>

        <Section title={t('guide:modes.list.title')}>
          <p>{t('guide:modes.list.body')}</p>
          <div className="mt-1 grid gap-3">
            {DIATONIC_MODE_IDS.map((mode) => (
              <ModeExample key={mode} mode={mode} />
            ))}
          </div>
        </Section>

        {/* A section of their own rather than two more cards in the list
            above: they are not rotations of the major scale, and what there is
            to say about them — where the raised degrees come from, and why
            melodic minor only goes up — is not said about any mode. */}
        <Section title={t('guide:modes.minors.title')}>
          <p>{t('guide:modes.minors.body')}</p>
          <div className="mt-1 grid gap-3">
            {MINOR_SCALE_IDS.map((mode) => (
              <ModeExample key={mode} mode={mode} />
            ))}
          </div>
          <p>{t('guide:modes.minors.after')}</p>
          <p>{t('guide:modes.minors.direction')}</p>
        </Section>

        <Section title={t('guide:modes.table.title')}>
          <p>{t('guide:modes.table.body')}</p>
          <ModeTable />
          <p>{t('guide:modes.table.after')}</p>
        </Section>

        <Section title={t('guide:modes.spelling.title')}>
          <p>{t('guide:modes.spelling.body')}</p>
          <p>{t('guide:modes.spelling.after')}</p>
        </Section>

        <Section title={t('guide:modes.next.title')}>
          <p>{t('guide:modes.next.body')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Next to="/train/scales/reading" label={t('guide:modes.next.reading')} />
            <Next to="/train/scales/hearing" label={t('guide:modes.next.hearing')} />
          </div>
        </Section>

        <p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-ink-faint">
          {t('guide:modes.source')}
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule py-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-heading">{title}</h2>
      <div className="mt-2 grid gap-3 leading-relaxed text-ink-muted">{children}</div>
    </section>
  )
}

function Next({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-rule bg-paper-raised px-4 py-3 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
    >
      {label}
      <Icon name="arrowForward" size={18} />
    </Link>
  )
}
