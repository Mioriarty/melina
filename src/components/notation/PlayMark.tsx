import { useTranslation } from 'react-i18next'

import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import type { PlaybackStatus } from '@/exercises/shared/usePlayback'

/**
 * The speaker in the corner of a staff that can be pressed, and what it turns
 * into.
 *
 * **The affordance is a mark on the staff, not a caption under it.** A line
 * reading "tap the notes to hear them" spent a whole row on something learnt
 * once, and on a short screen that row came out of the notation's height — the
 * scarcest thing on a round screen. This says the same where the thing it
 * describes already is, absolutely placed so it takes no height at all, and
 * faint so it cannot be mistaken for part of the music.
 *
 * It still carries the two states the caption did — that the samples are on
 * their way, and that playback has failed — because those are the moments a
 * press does not do what it looks like it will.
 *
 * `title` rather than a label: the button around it is already named, and a
 * second name inside would be read out twice.
 *
 * It lives here rather than beside `PlayableScore` because a guide's examples
 * are pressable too, and they are not an exercise — the same reason the strings
 * it reads moved to the `common` namespace.
 */

/**
 * Big enough to read at a glance and to be understood as a control rather than
 * a speck. It sits over the staff's own top-right corner, where notation never
 * reaches — the highest a note goes is the top line plus its ledger lines, and
 * those are drawn at the note, not at the end of the bar.
 */
const MARK = 'absolute top-1 right-1 grid h-7 w-7 place-items-center'

export interface PlayMarkProps {
  status: PlaybackStatus
}

export function PlayMark({ status }: PlayMarkProps) {
  const { t } = useTranslation('common')

  if (status === 'loading') {
    return (
      <span className={MARK} title={t('play.loading')}>
        <span
          // Gated the CSS way rather than through `useReducedMotion`, so a
          // presentational component needs no prop for it.
          className="h-6 w-6 animate-spin rounded-full border-2 border-ink-faint/25 border-t-ink-faint/80 motion-reduce:animate-none"
        />
      </span>
    )
  }

  return (
    <span
      className={cn(
        MARK,
        status === 'failed' ? 'text-ink-faint/75' : 'text-ink-faint/55',
      )}
      title={status === 'failed' ? t('play.unavailable') : t('play.hint')}
    >
      <Icon name={status === 'failed' ? 'close' : 'volume'} size={26} />
    </span>
  )
}
