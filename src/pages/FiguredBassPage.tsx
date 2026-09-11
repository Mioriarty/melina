import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { FigureTable } from '@/components/explain/FigureTable'
import { Icon } from '@/components/ui/Icon'

/**
 * How a figure is read.
 *
 * Reached from the question mark on the Figures setting of either direction,
 * and from nowhere else. It exists because **canonical-required grading owes
 * the player the conventions it grades against**: being marked wrong for
 * writing `6/3` where `6` is idiomatic is only fair if the rule of omission is
 * stated somewhere, and a one-line hint under a setting cannot state it.
 *
 * The table is computed from `figuredBass.ts` rather than written out, so the
 * page cannot come to describe something the app no longer does.
 */
export default function FiguredBassPage() {
  const { t } = useTranslation(['guide', 'curriculum'])
  const [params] = useSearchParams()

  // Reached from either exercise, so it goes back to the one it was opened
  // from — and to the setup screen, which is where the question mark is.
  const from = params.get('from') === 'realizing' ? 'realizing' : 'figuring'

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-7">
          <Link
            to={`/train/thoroughbass/${from}?screen=setup`}
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t('guide:back')}
          </Link>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            {t('curriculum:categories.thoroughbass.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:figures.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('guide:figures.intro')}
          </p>
        </header>

        <Section title={t('guide:figures.reading.title')}>
          <p>{t('guide:figures.reading.body')}</p>
          <p>{t('guide:figures.reading.key')}</p>
        </Section>

        <Section title={t('guide:figures.omission.title')}>
          <p>{t('guide:figures.omission.body')}</p>
          <Rules
            items={['plain', 'sixth', 'seventh', 'second', 'accidental']}
            prefix="figures.omission"
          />
        </Section>

        <Section title={t('guide:figures.table.title')}>
          <p>{t('guide:figures.table.body')}</p>
          <FigureTable />
        </Section>

        <Section title={t('guide:figures.accidentals.title')}>
          <p>{t('guide:figures.accidentals.body')}</p>
          <p>{t('guide:figures.accidentals.bare')}</p>
        </Section>

        <p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-ink-faint">
          {t('guide:figures.source')}
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

function Rules({ items, prefix }: { items: readonly string[]; prefix: string }) {
  const { t } = useTranslation('guide')

  return (
    <ul className="mt-1 grid gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          <span className="leading-relaxed text-ink-muted">{t(`${prefix}.${item}`)}</span>
        </li>
      ))}
    </ul>
  )
}
