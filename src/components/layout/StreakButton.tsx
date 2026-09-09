import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Icon } from '@/components/ui/Icon'
import { useStreak } from '@/hooks/useStreak'
import { cn } from '@/lib/utils/cn'

/**
 * The way into Progress, and a nudge while it is there.
 *
 * The flame is lit and in the accent colour once something has been answered
 * today, and a grey outline until then — so the header says at a glance
 * whether the day still needs using. Filled against outline carries it as
 * well as the colour does, because a state a colour-blind player cannot see
 * is not a state.
 *
 * A streak of zero shows the flame alone: a nought beside it would read as a
 * score rather than as an invitation.
 */
export function StreakButton() {
  const { t } = useTranslation()
  const streak = useStreak()

  const days = streak?.current ?? 0
  const lit = streak?.practisedToday ?? false

  return (
    <Link
      to="/progress"
      aria-label={
        streak === undefined
          ? t('openProgress')
          : lit
            ? t('streak.today', { count: days })
            : t('streak.pending', { count: days })
      }
      className={cn(
        '-mr-2 flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2',
        'transition-colors hover:bg-accent-tint hover:text-accent',
        lit ? 'text-accent' : 'text-ink-faint',
      )}
    >
      <Icon name={lit ? 'flameLit' : 'flame'} size={20} />
      {days > 0 && (
        <span className="tabular text-sm font-semibold" aria-hidden="true">
          {days}
        </span>
      )}
    </Link>
  )
}
