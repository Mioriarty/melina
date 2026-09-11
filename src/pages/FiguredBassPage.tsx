import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { FigureExample, FigurePair, FigureRow } from '@/components/explain/FigureExamples'
import { FigureTable } from '@/components/explain/FigureTable'
import { Icon } from '@/components/ui/Icon'
import { preloadEngraver } from '@/lib/notation/verovio'

import { GUIDE_EXAMPLES } from './figuredBassExamples'

/**
 * The article every rule on this page is taken from.
 *
 * The first link in the app that leaves it, which is why it carries the icon
 * that says so: a citation the reader cannot follow is a citation they have to
 * take on trust, and this page asks them to take a good deal on trust already.
 * It will not open offline, which is the honest cost of citing something that
 * lives elsewhere.
 */
const SOURCE =
  'https://en.wikisource.org/wiki/A_Dictionary_of_Music_and_Musicians/Thoroughbass'

/**
 * How a figure is read.
 *
 * A stop on the path in its own right, and also the question mark in the corner
 * of either exercise's Figures setting. It exists because **canonical-required
 * grading owes the player the conventions it grades against**: being marked
 * wrong for writing `6/3` where `6` is idiomatic is only fair if the rule of
 * omission is stated somewhere, and a one-line hint under a setting cannot
 * state it.
 *
 * **It is built around engraved examples rather than around prose**, and the
 * order is the order the ideas depend on each other in: what a figured bass
 * *is*, then counting up from the bass, then the key signature deciding which
 * note that lands on, then what the figure leaves out, then the accidentals.
 * Every one of those is a thing you can only really see, so every one of them
 * has a staff under it — and the staves are `figuredBass.ts` evaluated, so the
 * page cannot come to describe something the app no longer does.
 */
export default function FiguredBassPage() {
  const { t } = useTranslation(['guide', 'curriculum'])
  const [params] = useSearchParams()

  // The page is most of a dozen engraved staves and may well be the first
  // thing in a session to want the engraver, so it is asked for on mount
  // rather than by the first `Score` that happens to render.
  useEffect(preloadEngraver, [])

  // **Two ways in, so two ways back.** It is a stop on the path in its own
  // right, and it is also the question mark in the corner of either exercise's
  // Figures setting. `?from=` says which, so reading it never costs the player
  // their place — and with no `?from=` at all it came from the path, which is
  // where it goes back to.
  const from = params.get('from')
  const exercise = from === 'figuring' || from === 'realizing' ? from : undefined
  const back =
    exercise === undefined ? '/' : `/train/thoroughbass/${exercise}?screen=setup`

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
            {t('curriculum:categories.thoroughbass.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:figures.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('guide:figures.intro')}
          </p>
        </header>

        <Section title={t('guide:figures.what.title')}>
          <p>{t('guide:figures.what.body')}</p>
          <FigurePair {...GUIDE_EXAMPLES.printedPlayed} />
          <p>{t('guide:figures.what.after')}</p>
        </Section>

        <Section title={t('guide:figures.reading.title')}>
          <p>{t('guide:figures.reading.body')}</p>
          <FigureRow>
            <FigureExample
              {...GUIDE_EXAMPLES.overC}
              sounding
              caption={t('guide:figures.reading.overC')}
            />
            <FigureExample
              {...GUIDE_EXAMPLES.overE}
              sounding
              caption={t('guide:figures.reading.overE')}
            />
          </FigureRow>
          <p>{t('guide:figures.reading.after')}</p>
        </Section>

        <Section title={t('guide:figures.signature.title')}>
          <p>{t('guide:figures.signature.body')}</p>
          <FigureRow>
            <FigureExample
              {...GUIDE_EXAMPLES.inC}
              sounding
              caption={t('guide:figures.signature.inC')}
            />
            <FigureExample
              {...GUIDE_EXAMPLES.inF}
              sounding
              caption={t('guide:figures.signature.inF')}
            />
          </FigureRow>
          <p>{t('guide:figures.signature.after')}</p>
        </Section>

        <Section title={t('guide:figures.omission.title')}>
          <p>{t('guide:figures.omission.body')}</p>
          <FigurePair
            {...GUIDE_EXAMPLES.unfigured}
            writtenCaption={t('guide:figures.omission.bare')}
            playedCaption={t('guide:figures.omission.triad')}
          />
          <p>{t('guide:figures.omission.after')}</p>
          <Rules items={['plain', 'sixth', 'seventh', 'second', 'accidental']} />
          <FigurePair
            {...GUIDE_EXAMPLES.seventh}
            writtenCaption={t('guide:figures.omission.sevenWritten')}
            playedCaption={t('guide:figures.omission.sevenPlayed')}
          />
        </Section>

        <Section title={t('guide:figures.accidentals.title')}>
          <p>{t('guide:figures.accidentals.body')}</p>
          <FigureRow>
            <FigureExample
              {...GUIDE_EXAMPLES.plainThird}
              sounding
              caption={t('guide:figures.accidentals.plain')}
            />
            <FigureExample
              {...GUIDE_EXAMPLES.raisedThird}
              sounding
              caption={t('guide:figures.accidentals.raised')}
            />
          </FigureRow>
          <p>{t('guide:figures.accidentals.bare')}</p>
          <FigureExample
            {...GUIDE_EXAMPLES.groveFifth}
            sounding
            caption={t('guide:figures.accidentals.grove')}
            className="mt-2 rounded-2xl border border-rule bg-paper-raised p-4"
          />
        </Section>

        <Section title={t('guide:figures.suspensions.title')}>
          <p>{t('guide:figures.suspensions.body')}</p>
          <FigurePair
            {...GUIDE_EXAMPLES.suspension}
            writtenCaption={t('guide:figures.suspensions.held')}
            playedCaption={t('guide:figures.suspensions.resolved')}
          />
          <p>{t('guide:figures.suspensions.after')}</p>
        </Section>

        <Section title={t('guide:figures.table.title')}>
          <p>{t('guide:figures.table.body')}</p>
          <FigureTable />
        </Section>

        <Section title={t('guide:figures.historical.title')}>
          <p>{t('guide:figures.historical.body')}</p>
          <ul className="mt-1 grid gap-2.5">
            {['stroke', 'numerals'].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span className="leading-relaxed text-ink-muted">
                  {t(`guide:figures.historical.${item}`)}
                </span>
              </li>
            ))}
          </ul>
          <p>{t('guide:figures.historical.why')}</p>
        </Section>

        <Section title={t('guide:figures.next.title')}>
          <p>{t('guide:figures.next.body')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Next
              to="/train/thoroughbass/figuring"
              label={t('guide:figures.next.figuring')}
            />
            <Next
              to="/train/thoroughbass/realizing"
              label={t('guide:figures.next.realizing')}
            />
          </div>
        </Section>

        <p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-ink-faint">
          {t('guide:figures.source')}{' '}
          <a
            href={SOURCE}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
          >
            {t('guide:figures.sourceLink')}
            <Icon name="open" size={13} />
          </a>
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

function Rules({ items }: { items: readonly string[] }) {
  const { t } = useTranslation('guide')

  return (
    <ul className="mt-1 grid gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          <span className="leading-relaxed text-ink-muted">
            {t(`figures.omission.${item}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Where to go once it has been read — which is the point of reading it. */
function Next({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-rule bg-paper-raised px-4 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
    >
      {label}
      <Icon name="chevronForward" size={18} />
    </Link>
  )
}
