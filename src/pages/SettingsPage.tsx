import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { useLanguage } from '@/hooks/useLanguage'
import { LANGUAGES } from '@/lib/i18n/languages'
import { cn } from '@/lib/utils/cn'

/**
 * Settings.
 *
 * Reached only from the button at the left of the header — there is no
 * station for it on the path, because it is not something you practise.
 *
 * One setting so far, and it takes effect on the tap rather than behind a
 * Save button: there is nothing to validate and nothing to submit, and a
 * language you can see applied is a language you can undo if it was the
 * wrong choice.
 */
export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common'])
  const { current, choose } = useLanguage()

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="pb-page mx-auto w-full max-w-lg px-4 pt-6 sm:px-6">
        <header className="mb-6">
          <h1 className="text-title">{t('settings:title')}</h1>
          <p className="mt-2 leading-relaxed text-ink-muted">{t('settings:blurb')}</p>
        </header>

        <section className="border-t border-rule pt-5">
          <h2 className="text-heading">{t('settings:language.title')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-faint">
            {t('settings:language.hint')}
          </p>

          <ul
            className="mt-4 grid gap-2"
            role="radiogroup"
            aria-label={t('settings:language.label')}
          >
            {LANGUAGES.map((language) => {
              const selected = language.id === current
              return (
                <li key={language.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(language.id)}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left',
                      'transition-colors duration-150',
                      selected
                        ? 'border-accent bg-accent-tint text-accent'
                        : 'border-rule bg-paper-raised text-ink hover:border-accent hover:text-accent',
                    )}
                  >
                    {/* Never colour alone: the choice also carries a glyph. */}
                    <span className="grid h-5 w-5 shrink-0 place-items-center">
                      {selected && <Icon name="correct" size={20} />}
                    </span>
                    <span className="font-medium">{language.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="mt-8 text-center">
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
