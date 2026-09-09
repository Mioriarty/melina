import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { TimeSignature } from '@/lib/music/meter'
import { rhythmMei } from '@/lib/notation/mei'
import type { RhythmNode } from '@/lib/notation/rhythmNotation'
import { rhythmProfile } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

/**
 * The bar being written into, and the button that plays the one to write.
 *
 * The one place in melina where the notation is **not** the play button. Every
 * other exercise puts the question on the staff, so pressing it to hear it is
 * the same gesture; here the staff is where the answer is going, and pressing
 * your own half-finished answer to hear the question would be backwards. So
 * the replay control stands on its own above it.
 */

export interface RhythmScoreProps {
  meter: TimeSignature
  /** What the player has typed so far, drawn as they typed it. */
  nodes: readonly RhythmNode[]
  /** The right answer, once it has been given and was wrong. */
  answer?: readonly RhythmNode[]
  onPlay: () => void
  status: PlaybackStatus
}

export function RhythmScore({ meter, nodes, answer, onPlay, status }: RhythmScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const comparing = answer !== undefined

  const mei = rhythmMei({
    meter,
    staves: comparing
      ? [
          { nodes, label: t('rhythm.staff.yours') },
          { nodes: answer, label: t('rhythm.staff.correct') },
        ]
      : [{ nodes }],
  })

  return (
    <>
      <button
        type="button"
        onClick={onPlay}
        disabled={status === 'failed'}
        className={cn(
          'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4',
          'border border-rule bg-paper-raised text-sm font-medium text-ink',
          // A press has to be visible where there is no hover to precede it.
          'transition-[color,border-color,transform] duration-150',
          'hover:border-accent hover:text-accent active:scale-95',
          'disabled:cursor-default disabled:opacity-50 disabled:hover:border-rule disabled:hover:text-ink disabled:active:scale-100',
        )}
      >
        <Icon name={status === 'failed' ? 'close' : 'volume'} size={16} />
        {status === 'failed'
          ? t('play.unavailable')
          : status === 'loading'
            ? t('play.loading')
            : t('rhythm.replay')}
      </button>

      <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center">
        <Score
          className={SCORE_BOX}
          mei={mei}
          profile={rhythmProfile(meter.beats, comparing ? 2 : 1)}
          label={
            comparing
              ? t('rhythm.scoreLabel.comparison', { meter: names.meter(meter) })
              : t('rhythm.scoreLabel.draft', { meter: names.meter(meter) })
          }
        />
      </div>
    </>
  )
}
