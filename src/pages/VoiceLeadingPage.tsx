import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'

import { RuleTable } from '@/components/explain/RuleTable'
import { SatzExample } from '@/components/explain/VoiceLeadingExamples'
import { Icon } from '@/components/ui/Icon'
import { useMusicNames } from '@/hooks/useMusicNames'
import { SATB_RANGES, VOICES } from '@/lib/music/satbVoicing'
import { preloadEngraver } from '@/lib/notation/verovio'

import { CLEAN_EXAMPLE, FAULT_EXAMPLES } from './voiceLeadingExamples'

/**
 * What four-part writing is, and the rules a setting is held to.
 *
 * **A stop on the path rather than a question mark in a corner**, for the
 * reason the figured bass guide is one: some of what an exercise tests cannot
 * be learnt by being tested on it. Cadence writing marks a setting against a
 * list of prohibitions, and a player who was never shown the list is not being
 * asked a hard question but an unfair one. It keeps its question mark too, on
 * the rules section of the settings screen.
 *
 * **Every rule the exercise checks appears here**, because the table walks
 * `VOICE_LEADING_RULES` rather than repeating it — so a rule cannot be added to
 * the model without being explained. And every example is a *setting*, built by
 * the same `buildEvents` the generator uses and graded by the same
 * `satzFindings` the exercise grades with: `VoiceLeadingPage.test.ts` insists
 * each one shows exactly the fault it claims and no other, so the page can
 * never illustrate the wrong thing.
 *
 * **The faults are drawn as departures from one clean setting.** Every example
 * below the first is that setting with a single voice moved, which is what
 * makes them comparable — and pressing the two in turn is the fastest way
 * anyone learns why a rule is a rule, since a parallel fifth is a sound before
 * it is a picture.
 */
export default function VoiceLeadingPage() {
  const { t } = useTranslation(['guide', 'curriculum'])
  const names = useMusicNames()
  const [params] = useSearchParams()

  // Seven grand staves, and this may well be the first thing in a session to
  // want the engraver.
  useEffect(preloadEngraver, [])

  // Which exercise opened it, so reading it never costs the player their
  // place. An unrecognised value is treated as the path rather than trusted
  // into a route.
  const from = params.get('from')
  const back = from === 'harmony/cadence' ? '/train/harmony/cadence?screen=setup' : '/'

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <header className="mb-7">
          <Link
            to={back}
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            {t(from === null ? 'guide:backToPath' : 'guide:back')}
          </Link>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            {t('curriculum:categories.harmony.title')}
          </p>
          <h1 className="mt-1 text-title">{t('guide:voiceLeading.title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            {t('guide:voiceLeading.intro')}
          </p>
        </header>

        <Section title={t('guide:voiceLeading.what.title')}>
          <p>{t('guide:voiceLeading.what.body')}</p>
          <SatzExample example={CLEAN_EXAMPLE} className="mt-1" />
          <p>{t('guide:voiceLeading.what.after')}</p>
        </Section>

        <Section title={t('guide:voiceLeading.ranges.title')}>
          <p>{t('guide:voiceLeading.ranges.body')}</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {VOICES.map((voice) => (
              <li
                key={voice}
                className="flex items-baseline justify-between gap-3 rounded-xl border border-rule bg-paper-raised px-3 py-2"
              >
                <span className="font-medium text-ink">{names.voice(voice)}</span>
                <span className="tabular text-sm text-ink-muted">
                  {names.pitchSpoken(SATB_RANGES[voice].lowest)} –{' '}
                  {names.pitchSpoken(SATB_RANGES[voice].highest)}
                </span>
              </li>
            ))}
          </ul>
          <p>{t('guide:voiceLeading.ranges.after')}</p>
        </Section>

        <Section title={t('guide:voiceLeading.faults.title')}>
          <p>{t('guide:voiceLeading.faults.body')}</p>
          <div className="mt-1 grid gap-5">
            {FAULT_EXAMPLES.map((example) => (
              <figure key={example.id} className="grid gap-1.5">
                <figcaption className="grid gap-0.5">
                  <span className="font-serif text-[1.0625rem] font-semibold text-ink">
                    {names.rule(example.rule as NonNullable<typeof example.rule>)}
                  </span>
                  <span className="text-sm leading-snug text-ink-muted">
                    {t(`guide:voiceLeading.faults.${example.id}`)}
                  </span>
                </figcaption>
                <SatzExample example={example} />
              </figure>
            ))}
          </div>
          <p>{t('guide:voiceLeading.faults.after')}</p>
        </Section>

        <Section title={t('guide:voiceLeading.marking.title')}>
          <p>{t('guide:voiceLeading.marking.body')}</p>
          <p>{t('guide:voiceLeading.marking.after')}</p>
        </Section>

        <Section title={t('guide:voiceLeading.table.title')}>
          <p>{t('guide:voiceLeading.table.body')}</p>
          <RuleTable />
        </Section>

        <Section title={t('guide:voiceLeading.limits.title')}>
          <p>{t('guide:voiceLeading.limits.body')}</p>
          <p>{t('guide:voiceLeading.limits.after')}</p>
        </Section>

        <Section title={t('guide:voiceLeading.next.title')}>
          <p>{t('guide:voiceLeading.next.body')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Next
              to="/train/harmony/cadence"
              label={t('guide:voiceLeading.next.cadence')}
            />
            <Next to="/train/harmony/bass" label={t('guide:voiceLeading.next.bass')} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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
