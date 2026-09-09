import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ClefId } from '@/lib/music/clef'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import { tonicKey, type ModeId } from '@/lib/music/scale'
import { melodyMei } from '@/lib/notation/mei'
import { melodyProfile } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

/**
 * The melody being written down, the key it is in, and the button that plays it.
 *
 * **The key is named rather than played.** A tonic triad puts the key in the
 * ear, which is what the degrees are heard against, but a triad cannot tell E
 * phrygian from E aeolian — both are E minor triads — so the mode is simply
 * said here instead of being spelled out in sound. For major and minor the
 * label is barely noticed; for a mode it is what makes the question answerable.
 *
 * Like rhythmic dictation and unlike everything else, the staff is where the
 * *answer* goes, so the replay control stands on its own rather than being the
 * notation itself.
 */

export interface DegreeScoreProps {
  tonic: Pitch
  mode: ModeId
  clef: ClefId
  keySignature: KeySignatureId
  /** How many notes the melody had, so the staff keeps its width throughout. */
  slots: number
  /** The notes entered so far. */
  pitches: readonly Pitch[]
  /** The right answer, once it has been given and was wrong. */
  answer?: readonly Pitch[]
  onPlay: () => void
  status: PlaybackStatus
}

export function DegreeScore({
  tonic,
  mode,
  clef,
  keySignature,
  slots,
  pitches,
  answer,
  onPlay,
  status,
}: DegreeScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const comparing = answer !== undefined
  const key = names.scaleName(tonicKey(tonic), mode)

  const mei = melodyMei({
    clef,
    keySignature,
    slots,
    staves: comparing
      ? [
          { pitches, label: t('degrees.staff.yours') },
          { pitches: answer, label: t('degrees.staff.correct') },
        ]
      : [{ pitches }],
  })

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink">
          {key}
        </span>

        <button
          type="button"
          onClick={onPlay}
          disabled={status === 'failed'}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-full px-4',
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
              : t('degrees.replay')}
        </button>
      </div>

      <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center">
        <Score
          className={SCORE_BOX}
          mei={mei}
          profile={melodyProfile(slots, comparing ? 2 : 1)}
          label={
            comparing
              ? t('degrees.scoreLabel.comparison', { key })
              : t('degrees.scoreLabel.draft', { key })
          }
        />
      </div>
    </>
  )
}
