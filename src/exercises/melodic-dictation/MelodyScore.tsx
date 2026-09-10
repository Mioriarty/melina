import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { PHRASE_SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { ClefId } from '@/lib/music/clef'
import type { KeySignatureId } from '@/lib/music/keySignature'
import type { TimeSignature } from '@/lib/music/meter'
import type { Pitch } from '@/lib/music/pitch'
import { tonicKey, type ModeId } from '@/lib/music/scale'
import { melodicPhraseMei } from '@/lib/notation/mei'
import type { RhythmNode } from '@/lib/notation/rhythmNotation'
import { melodicPhraseProfile } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

import { PLACEHOLDER_LEDGERS, PLACEHOLDER_NOTE } from './placeholderClasses'

/**
 * The melody being written down, the key it is in, and the button that plays it.
 *
 * **The key is named rather than played.** A melody in E phrygian and one in E
 * aeolian open on the same note, and no amount of listening to the melody alone
 * says which key it was in — so the key is stated, and what is being asked is
 * the notes and where they fall.
 *
 * Like rhythmic dictation and scale degrees, and unlike everything else, the
 * staff is where the *answer* goes. So the replay control stands on its own
 * rather than being the notation itself: pressing your own half-written answer
 * to hear the question would be backwards.
 */

export interface MelodyScoreProps {
  meter: TimeSignature
  clef: ClefId
  keySignature: KeySignatureId
  tonic: Pitch
  mode: ModeId
  barsPerSystem: number
  /** What the player has written: the spelling, bar by bar, and its notes. */
  bars: readonly (readonly RhythmNode[])[]
  pitches: readonly Pitch[]
  /** The first note's pitch, shown greyed until something is written. */
  placeholder?: Pitch
  /** The right answer, once it has been given and was wrong. */
  answer?: { bars: readonly (readonly RhythmNode[])[]; pitches: readonly Pitch[] }
  onPlay: () => void
  status: PlaybackStatus
}

export function MelodyScore({
  meter,
  clef,
  keySignature,
  tonic,
  mode,
  barsPerSystem,
  bars,
  pitches,
  placeholder,
  answer,
  onPlay,
  status,
}: MelodyScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const comparing = answer !== undefined
  const key = names.scaleName(tonicKey(tonic), mode)
  const meterName = names.meter(meter)

  const mei = melodicPhraseMei({
    meter,
    clef,
    keySignature,
    barsPerSystem,
    staves: comparing
      ? [
          { bars, pitches, label: t('melody.staff.yours') },
          {
            bars: answer.bars,
            pitches: answer.pitches,
            label: t('melody.staff.correct'),
          },
        ]
      : [{ bars, pitches, ...(placeholder === undefined ? {} : { placeholder }) }],
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
              : t('melody.replay')}
        </button>
      </div>

      <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center">
        <Score
          // The placeholder is faded from here rather than coloured in the
          // MEI: `@type` reaches the rendered element as a class, so how faint
          // "faint" is stays with the rest of the styling. Its ledger lines
          // are a separate rule and are only faded while it is showing — see
          // `placeholderClasses.ts` for why both of those are true.
          className={cn(
            PHRASE_SCORE_BOX,
            PLACEHOLDER_NOTE,
            placeholder !== undefined && PLACEHOLDER_LEDGERS,
          )}
          mei={mei}
          profile={melodicPhraseProfile(
            meter.beats,
            bars.length,
            barsPerSystem,
            comparing ? 2 : 1,
          )}
          label={
            comparing
              ? t('melody.scoreLabel.comparison', { key, meter: meterName })
              : t('melody.scoreLabel.draft', { key, meter: meterName })
          }
        />
      </div>
    </>
  )
}
