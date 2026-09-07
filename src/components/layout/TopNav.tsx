import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'

import { Wordmark } from './Wordmark'

/**
 * The header.
 *
 * Almost nothing: the path itself is the navigation — a nav bar duplicating
 * it earned nothing, and on mobile a hamburger opening a menu of the same
 * eight stations was pure ceremony.
 *
 * Settings sit at the far left and are the only way into that screen, so the
 * wordmark is centred and balanced by a spacer the same width as the button.
 * Centring with `absolute` instead would take the wordmark out of the flow
 * and let a long future control overlap it.
 */
export function TopNav() {
  const { t } = useTranslation()

  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="flex h-14 items-center px-4 sm:px-5">
        <Link
          to="/settings"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-accent-tint hover:text-accent"
        >
          <Icon name="settings" size={22} label={t('openSettings')} />
        </Link>

        <div className="flex flex-1 justify-center">
          <Wordmark />
        </div>

        {/* Balances the settings button so the wordmark sits on the centre. */}
        <span className="-mr-2 h-11 w-11 shrink-0" aria-hidden="true" />
      </div>
    </header>
  )
}
