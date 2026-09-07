import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { CATALOG, QUALITY_ORDER } from '@/lib/music/catalog'
import { CLEFS } from '@/lib/music/clef'
import { intervalKey, intervalName, numberName, qualityLabel } from '@/lib/music/interval'
import { KEY_SIGNATURES } from '@/lib/music/keySignature'
import { cn } from '@/lib/utils/cn'

import { ROUND_LENGTHS, type IntervalReadingSettings } from './settings'

export interface SetupScreenProps {
  settings: IntervalReadingSettings
  onChange: (settings: IntervalReadingSettings) => void
  onStart: () => void
}

/**
 * What to practise, before a round starts.
 *
 * A screen rather than a modal: choosing the material is part of deciding
 * what to work on, not an aside from it, and it keeps the round itself free
 * of chrome. Owns its own scrolling, because the app shell deliberately does
 * not scroll, and carries its own link back to the path, because exercises
 * run without the header.
 */
export function SetupScreen({ settings, onChange, onStart }: SetupScreenProps) {
  /** Toggle a value in one of the list settings, never emptying it. */
  function toggle<K extends 'clefs' | 'keySignatures' | 'intervals'>(
    field: K,
    value: IntervalReadingSettings[K][number],
  ) {
    const current = settings[field] as readonly string[]
    const next = current.includes(value as string)
      ? current.filter((item) => item !== value)
      : [...current, value as string]

    // An empty list would make a round with no questions in it.
    if (next.length === 0) return
    onChange({ ...settings, [field]: next })
  }

  const intervalNumbers = [...new Set(CATALOG.map((interval) => interval.number))]

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-safe mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        <header className="mb-6">
          <Link
            to="/"
            className="mb-1 -ml-2 inline-flex h-11 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
          >
            <Icon name="arrowBack" size={18} />
            Path
          </Link>

          <p className="text-sm tracking-wide text-ink-faint uppercase">
            Interval Training
          </p>
          <h1 className="mt-1 text-title">Interval Reading</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Name the interval on the staff. Choose what you want to be asked.
          </p>
        </header>

        <Section title="Clefs">
          <div className="flex flex-wrap gap-2">
            {CLEFS.map((clef) => (
              <Chip
                key={clef.id}
                selected={settings.clefs.includes(clef.id)}
                onClick={() => toggle('clefs', clef.id)}
              >
                {clef.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section
          title="Key signatures"
          hint="The signature is drawn on the staff; notes may still take any accidental."
        >
          <div className="flex flex-wrap gap-2">
            {KEY_SIGNATURES.map((signature) => (
              <Chip
                key={signature.id}
                selected={settings.keySignatures.includes(signature.id)}
                onClick={() => toggle('keySignatures', signature.id)}
                label={`${signature.major} major, ${signature.minor.replace('m', ' minor')}`}
              >
                {signature.major}
                <span className="ml-1 text-ink-faint">/{signature.minor}</span>
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Intervals">
          <div className="grid gap-1.5">
            {intervalNumbers.map((number) => (
              <div key={number} className="flex flex-wrap items-center gap-2">
                <span className="w-[4.5rem] shrink-0 font-serif text-[0.9375rem] font-semibold text-ink-muted">
                  {numberName(number)}
                </span>
                {QUALITY_ORDER.filter((quality) =>
                  CATALOG.some((i) => i.number === number && i.quality === quality),
                ).map((quality) => {
                  const key = intervalKey({ number, quality })
                  return (
                    <Chip
                      key={key}
                      selected={settings.intervals.includes(key)}
                      onClick={() => toggle('intervals', key)}
                      label={intervalName({ number, quality })}
                    >
                      {qualityLabel(quality)}
                    </Chip>
                  )
                })}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Questions per round">
          <div className="flex flex-wrap gap-2">
            {ROUND_LENGTHS.map((length) => (
              <Chip
                key={length}
                selected={settings.questionsPerRound === length}
                onClick={() => onChange({ ...settings, questionsPerRound: length })}
              >
                {length}
              </Chip>
            ))}
          </div>
        </Section>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 flex min-h-12 w-full items-center justify-center rounded-full bg-accent font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
        >
          Start round
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-rule py-5 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="mb-1 text-heading">{title}</h2>
      {hint !== undefined && (
        <p className="mb-3 text-sm leading-relaxed text-ink-faint">{hint}</p>
      )}
      <div className={hint === undefined ? 'mt-3' : undefined}>{children}</div>
    </section>
  )
}

function Chip({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean
  onClick: () => void
  label?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-3.5 text-[0.8125rem] font-medium',
        'transition-[background-color,border-color,color] duration-150',
        selected
          ? 'border-accent bg-accent-tint text-accent'
          : 'border-rule bg-paper-raised text-ink-muted hover:border-accent hover:text-accent',
      )}
    >
      {children}
    </button>
  )
}
