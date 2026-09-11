import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { ChordExample, ChordPosition } from '@/components/explain/ChordExamples'
import { ChordTable } from '@/components/explain/ChordTable'
import { Icon } from '@/components/ui/Icon'
import { inversionsFor } from '@/lib/music/chord'
import { preloadEngraver } from '@/lib/notation/verovio'

import {
  POSITION_EXAMPLE,
  SEVENTH_EXAMPLES,
  SEVENTH_POSITION_EXAMPLE,
  TRIAD_EXAMPLES,
} from './chordExamples'

/**
 * What a chord is, which nine melina asks about, and how they are named.
 *
 * **A stop on the path rather than a question mark in a corner**, and the
 * figured bass guide is the precedent: some of what an exercise tests cannot
 * be learnt by being tested on it. The names are a convention — a Sextakkord is
 * a first inversion because that is what it has always been called — and a
 * player who has not been told them is not being asked a hard question but an
 * unfair one. It keeps its question mark too, on the Qualities setting.
 *
 * **Everything on it is `chord.ts` evaluated** — the staves through
 * `chordNotes` and `voiceChord`, the shorthand and the table through
 * `chordSeries.ts` — for the same reason the melodic shape guide plots
 * `contour.ts` rather than a drawing of it: a page that describes a model by
 * hand can come to describe something the app no longer does.
 */
export default function ChordsPage() {
  const { t } = useTranslation(['guide', 'curriculum'])
  const [params] = useSearchParams()

  // Fourteen staves, and this may well be the first thing in a session to want
  // the engraver — asked for on mount rather than by whichever `Score` renders
  // first.
  useEffect(preloadEngraver, [])

  // Which exercise opened it, so reading it never costs the player their
  // place: the settings survive the trip in Dexie but *which screen was
  // showing* is React state and does not. An unrecognised value is treated as
  // the path rather than trusted into a route.
  const from = params.get('from')
  const exercise =
    from === 'reading' || from === 'hearing' || from === 'writing' ? from : undefined
  const back = exercise === undefined ? '/' : `/train/chords/${exercise}?screen=setup`

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
            {t('curriculum:categories.chords.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:chords.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t('guide:chords.intro')}</p>
        </header>

        <Section title={t('guide:chords.what.title')}>
          <p>{t('guide:chords.what.body')}</p>
          <p>{t('guide:chords.what.after')}</p>
        </Section>

        <Section title={t('guide:chords.triads.title')}>
          <p>{t('guide:chords.triads.body')}</p>
          <div className="mt-1 grid gap-3">
            {TRIAD_EXAMPLES.map((example) => (
              <ChordExample key={example.quality} {...example} />
            ))}
          </div>
          <p>{t('guide:chords.triads.after')}</p>
        </Section>

        <Section title={t('guide:chords.sevenths.title')}>
          <p>{t('guide:chords.sevenths.body')}</p>
          <div className="mt-1 grid gap-3">
            {SEVENTH_EXAMPLES.map((example) => (
              <ChordExample key={example.quality} {...example} />
            ))}
          </div>
          <p>{t('guide:chords.sevenths.after')}</p>
        </Section>

        <Section title={t('guide:chords.table.title')}>
          <p>{t('guide:chords.table.body')}</p>
          <ChordTable />
        </Section>

        <Section title={t('guide:chords.inversion.title')}>
          <p>{t('guide:chords.inversion.body')}</p>
          <div className="mt-1 grid gap-3 sm:grid-cols-3">
            {inversionsFor(POSITION_EXAMPLE.quality).map((inversion) => (
              <ChordPosition
                key={inversion}
                {...POSITION_EXAMPLE}
                inversion={inversion}
              />
            ))}
          </div>
          <p>{t('guide:chords.inversion.sevenths')}</p>
          <div className="mt-1 grid gap-3 sm:grid-cols-4">
            {inversionsFor(SEVENTH_POSITION_EXAMPLE.quality).map((inversion) => (
              <ChordPosition
                key={inversion}
                {...SEVENTH_POSITION_EXAMPLE}
                inversion={inversion}
              />
            ))}
          </div>
          <p>{t('guide:chords.inversion.after')}</p>
        </Section>

        <Section title={t('guide:chords.lage.title')}>
          <p>{t('guide:chords.lage.body')}</p>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {/* The same chord in the same inversion, standing two ways. That is
                the whole argument of the section, so the two have to be drawn
                side by side or it is only an assertion. */}
            <ChordPosition {...POSITION_EXAMPLE} inversion={0} top={2} by="lage" />
            <ChordPosition {...POSITION_EXAMPLE} inversion={0} top={1} by="lage" />
          </div>
          <p>{t('guide:chords.lage.after')}</p>
        </Section>

        <Section title={t('guide:chords.ear.title')}>
          <p>{t('guide:chords.ear.body')}</p>
          <p>{t('guide:chords.ear.after')}</p>
        </Section>

        <Section title={t('guide:chords.spelling.title')}>
          <p>{t('guide:chords.spelling.body')}</p>
          <p>{t('guide:chords.spelling.after')}</p>
        </Section>

        <Section title={t('guide:chords.absent.title')}>
          <p>{t('guide:chords.absent.body')}</p>
          <p>{t('guide:chords.absent.after')}</p>
        </Section>

        <Section title={t('guide:chords.next.title')}>
          <p>{t('guide:chords.next.body')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Next to="/train/chords/reading" label={t('guide:chords.next.reading')} />
            <Next to="/train/chords/hearing" label={t('guide:chords.next.hearing')} />
            <Next to="/train/chords/writing" label={t('guide:chords.next.writing')} />
          </div>
        </Section>

        <p className="mt-8 border-t border-rule pt-5 text-sm leading-relaxed text-ink-faint">
          {t('guide:chords.source')}
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
      <Icon name="chevronForward" size={16} />
    </Link>
  )
}
