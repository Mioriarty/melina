import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import {
  IntervalComparison,
  IntervalCurves,
  SteadySteps,
  WidthByGap,
} from '@/components/explain/ContourFigures'
import { Icon } from '@/components/ui/Icon'

/**
 * How melodic dictation chooses its notes.
 *
 * Reached from the question mark on the Melodic shape setting, and from
 * nowhere else — it explains one choice, and it is written to be read at the
 * moment that choice is being made.
 *
 * **The pictures are computed from `contour.ts`, not drawn to match it.** A
 * page that describes a model has to be able to go stale; this one cannot,
 * because the curves are the model evaluated. Turning a constant moves the
 * drawings with it.
 *
 * The prose is deliberately short and the figures carry the argument. Someone
 * opening this wants to know what the two options do, not to read a paper.
 */
export default function MelodyShapePage() {
  const { t } = useTranslation(['guide', 'curriculum'])

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-7">
          <Link
            to="/train/dictation/short-melodies?screen=setup"
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t('guide:back')}
          </Link>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            {t('curriculum:categories.dictation.exercises.short-melodies.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:shape.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t('guide:shape.intro')}</p>
        </header>

        <Section title={t('guide:order.title')}>
          <p>{t('guide:order.body')}</p>
          <Steps
            items={[
              t('guide:order.step1'),
              t('guide:order.step2'),
              t('guide:order.step3'),
            ]}
          />
        </Section>

        <Section title={t('guide:first.title')}>
          <p>{t('guide:first.body')}</p>
        </Section>

        <Section title={t('guide:next.title')}>
          <p>{t('guide:next.body')}</p>
          <p>{t('guide:next.pools')}</p>
        </Section>

        <Section title={t('guide:paced.title')}>
          <p>{t('guide:paced.body')}</p>
          <IntervalCurves />
          <p>{t('guide:paced.width')}</p>
          <WidthByGap />
          <p>{t('guide:paced.concrete')}</p>
          <IntervalComparison />
        </Section>

        <Section title={t('guide:steady.title')}>
          <p>{t('guide:steady.body')}</p>
          <SteadySteps />
        </Section>

        <Section title={t('guide:rules.title')}>
          <p>{t('guide:rules.body')}</p>
          <ul className="mt-3 grid gap-2.5">
            {['range', 'nothing', 'unison', 'rhythm'].map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="leading-relaxed text-ink-muted">
                  {t(`guide:rules.${rule}`)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-ink-faint">
          {t('guide:source')}
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

/** The three passes, numbered, because the order is the thing being said. */
function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="mt-1 grid gap-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-tint text-[0.75rem] font-semibold text-accent">
            {index + 1}
          </span>
          <span className="leading-relaxed text-ink-muted">{item}</span>
        </li>
      ))}
    </ol>
  )
}
