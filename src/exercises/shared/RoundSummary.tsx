import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import type { Answered } from './round'

export interface RoundSummaryProps<TQuestion, TAnswer> {
  answers: readonly Answered<TQuestion, TAnswer>[]
  /**
   * Short, stable label for what was asked — `M3`, `dor`. Groups the misses
   * and labels the chips, so it has to fit in a very small square.
   */
  subjectKey: (question: TQuestion) => string
  /** The same thing spelled out: `Major third`. */
  subjectName: (question: TQuestion) => string
  /** What the player said instead. */
  answerName: (chosen: TAnswer) => string
  /** Tooltip on a chip: what was asked, and in what context. */
  chipTitle: (question: TQuestion) => string
  /** Where to go next when nothing was missed. Exercise-specific advice. */
  allCorrect: string
  onPlayAgain: () => void
  onChangeSettings: () => void
}

/**
 * What just happened, and what to do about it.
 *
 * The score is the least useful thing here, so it is stated once and the
 * space goes to the misses instead — grouped by subject, because "you missed
 * the diminished fifth three times" is a practice instruction and "85%" is
 * not.
 *
 * Generic over what the exercise asks about: it never looks inside a
 * question, it only asks the exercise to name one.
 */
export function RoundSummary<TQuestion, TAnswer>({
  answers,
  subjectKey,
  subjectName,
  answerName,
  chipTitle,
  allCorrect,
  onPlayAgain,
  onChangeSettings,
}: RoundSummaryProps<TQuestion, TAnswer>) {
  const { t } = useTranslation(['exercise', 'common'])

  const correct = answers.filter((answer) => answer.correct).length
  const total = answers.length
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100)

  // Keyed by the short label, but the question is kept so its full name can
  // be rendered without parsing the key back apart.
  const misses = new Map<
    string,
    { question: TQuestion; count: number; answered: Set<string> }
  >()

  for (const answer of answers) {
    if (answer.correct) continue
    const key = subjectKey(answer.question)
    const entry = misses.get(key) ?? {
      question: answer.question,
      count: 0,
      answered: new Set<string>(),
    }
    entry.count += 1
    entry.answered.add(answerName(answer.chosen))
    misses.set(key, entry)
  }

  const ranked = [...misses.entries()]
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => b.count - a.count)

  return (
    // Owns its scrolling: the app shell deliberately does not scroll.
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-lg px-4 pt-8 sm:px-6">
        <div className="text-center">
          <span
            className={cn(
              'mx-auto grid h-16 w-16 place-items-center rounded-full',
              accuracy === 100 ? 'bg-correct text-white' : 'bg-accent-tint text-accent',
            )}
          >
            <Icon name={accuracy === 100 ? 'trophy' : 'checkmark'} size={30} />
          </span>

          <h1 className="mt-5 text-title">{t('exercise:summary.title')}</h1>
          <p className="mt-2 text-ink-muted">
            <span className="tabular text-[1.75rem] font-semibold text-ink">
              {correct}
            </span>
            <span className="text-ink-faint"> / {total}</span>
            <span className="text-ink-faint"> · {accuracy}%</span>
          </p>
        </div>

        {ranked.length > 0 && (
          <section className="mt-8 border-t border-rule pt-6">
            <h2 id="summary-work-on" className="text-heading">
              {t('exercise:summary.workOn')}
            </h2>
            {/* Two lists on one screen: without a name, a screen reader
                announces "list, 3 items" twice and neither one says which. */}
            <ul aria-labelledby="summary-work-on" className="mt-3 grid gap-2">
              {ranked.map((entry) => (
                <li
                  key={entry.key}
                  className="flex items-start gap-3 rounded-2xl border border-rule bg-paper-raised p-3"
                >
                  <span className="tabular grid h-9 w-9 shrink-0 place-items-center rounded-full bg-wrong/10 text-[0.8125rem] font-semibold text-wrong">
                    {t('exercise:summary.missCount', { times: entry.count })}
                  </span>
                  <span className="min-w-0">
                    <span className="font-serif text-[1.0625rem] font-semibold">
                      {subjectName(entry.question)}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                      {t('exercise:summary.youAnswered', {
                        answers: [...entry.answered].join(', '),
                      })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ranked.length === 0 && total > 0 && (
          <p className="mt-8 text-center leading-relaxed text-ink-muted">{allCorrect}</p>
        )}

        <section className="mt-8 border-t border-rule pt-6">
          <h2 id="summary-this-round" className="mb-3 text-heading">
            {t('exercise:summary.thisRound')}
          </h2>
          <ol aria-labelledby="summary-this-round" className="flex flex-wrap gap-1.5">
            {answers.map((answer, index) => (
              <li
                key={index}
                title={chipTitle(answer.question)}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg text-[0.6875rem] font-semibold',
                  answer.correct
                    ? 'bg-correct/12 text-correct'
                    : 'bg-wrong/12 text-wrong',
                )}
              >
                {subjectKey(answer.question)}
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent font-medium text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
          >
            <Icon name="refresh" size={18} />
            {t('exercise:summary.playAgain')}
          </button>
          <button
            type="button"
            onClick={onChangeSettings}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-rule bg-paper-raised font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            <Icon name="options" size={18} />
            {t('exercise:summary.changeSettings')}
          </button>
        </div>

        <div className="mt-3 text-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-accent"
          >
            <Icon name="arrowBack" size={16} />
            {t('common:backToPath')}
          </Link>
        </div>
      </div>
    </div>
  )
}
