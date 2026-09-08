import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

import type { PlaybackStatus } from './usePlayback'

/**
 * The notation, which is also the play button.
 *
 * Pressing the notes sounds them, rather than a separate control sitting
 * beside the staff: the notation *is* the thing being played, and a button
 * next to it was one more piece of furniture to explain.
 *
 * It is only pressable when every note is on screen — a hearing question can
 * be replayed at any time, a reading question only once its answer is out,
 * since before that the sound would give it away. When it is not, the staff
 * is a plain image and says nothing about playing.
 *
 * The caption below carries the affordance, and doubles as the place to say
 * that the samples are still downloading or that playback is unavailable —
 * which is what the old button used its own colours for.
 */

export interface PlayableScoreProps {
  mei: string
  /** What the notation shows, for screen readers. Never the answer. */
  label: string
  noteSpacing?: number
  /** Sound the notes. Omitted while the answer is still hidden. */
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

export function PlayableScore({
  mei,
  label,
  noteSpacing,
  onPlay,
  status = 'idle',
}: PlayableScoreProps) {
  const { t } = useTranslation('exercise')

  const caption =
    onPlay === undefined
      ? undefined
      : status === 'failed'
        ? t('play.unavailable')
        : status === 'loading'
          ? t('play.loading')
          : t('play.hint')

  return (
    <>
      <div className="flex min-h-0 w-full max-w-full flex-1 items-center justify-center">
        {onPlay === undefined ? (
          <Score
            className="max-h-[34dvh] min-h-0 flex-1"
            mei={mei}
            label={label}
            {...(noteSpacing === undefined ? {} : { noteSpacing })}
          />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            disabled={status === 'failed'}
            // Both halves in one name: what is on the staff, and what
            // pressing it does. A button takes its name from this rather
            // than from the image inside it, so the description has to be
            // here or it is lost.
            aria-label={t('play.scoreLabel', { notes: label })}
            className={cn(
              'flex min-h-0 max-w-full flex-1 items-center justify-center',
              'rounded-2xl px-2 py-1 transition-[background-color,transform] duration-150',
              'hover:bg-accent-tint/70 active:scale-[0.99]',
              'disabled:cursor-default disabled:bg-transparent disabled:active:scale-100',
            )}
          >
            <Score
              className="max-h-[34dvh] min-h-0"
              mei={mei}
              label={label}
              {...(noteSpacing === undefined ? {} : { noteSpacing })}
            />
          </button>
        )}
      </div>

      {/* Reserved whether or not there is anything to say, so the staff does
          not move when a reading answer is revealed and the caption appears. */}
      <p className="flex h-5 shrink-0 items-center gap-1 text-[0.8125rem] text-ink-faint">
        {caption !== undefined && (
          <>
            <Icon name={status === 'failed' ? 'close' : 'volume'} size={14} />
            {caption}
          </>
        )}
      </p>
    </>
  )
}
