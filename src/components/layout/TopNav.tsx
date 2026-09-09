import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'

import { StreakButton } from './StreakButton'
import { Wordmark } from './Wordmark'

/**
 * The header.
 *
 * Almost nothing: the path itself is the navigation — a nav bar duplicating
 * it earned nothing, and on mobile a hamburger opening a menu of the same
 * eight stations was pure ceremony.
 *
 * Settings sit at the far left and Progress at the far right, and each is the
 * only way into its screen — neither is something you practise, so neither
 * has a station on the path. The wordmark sits between them in the flow
 * rather than being centred with `absolute`, which would let either control
 * overlap it once its label grew.
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

        <StreakButton />
      </div>
    </header>
  )
}
