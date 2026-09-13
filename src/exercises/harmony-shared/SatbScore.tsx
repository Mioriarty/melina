import { useTranslation } from 'react-i18next'

import { Score } from '@/components/notation/Score'
import { Icon } from '@/components/ui/Icon'
import { PHRASE_SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { getKeySignature } from '@/lib/music/keySignature'
import { keySignatureOf } from '@/lib/music/key'
import type { HarmonicEvent } from '@/lib/music/harmony'
import type { Pitch } from '@/lib/music/pitch'
import { tonicKey } from '@/lib/music/scale'
import type { VoiceId } from '@/lib/music/voiceLeading'
import { satbMei, type SatbEvent } from '@/lib/notation/satbMei'
import { satbProfile } from '@/lib/notation/verovio'
import { cn } from '@/lib/utils/cn'

import { analysisRows } from './analysis'
import type { HarmonyQuestion } from './generate'

/**
 * The progression on a grand staff, and the button that plays it.
 *
 * **The staff is where the answer goes, so the replay control stands on its
 * own** — the same exception rhythmic dictation makes. Everywhere else in
 * melina the notation *is* the play button, because the notation is what is
 * being played; here it is the player's own half-written bass line, and
 * pressing that to hear the question would be backwards.
 *
 * While the question is open only the bass is drawn, and only as far as it has
 * been written. The other three voices are **engraved in place and not drawn**,
 * so the staff is exactly the size it will be when the answer arrives and
 * nothing moves at the moment the player looks at it.
 */

const UPPER: readonly VoiceId[] = ['soprano', 'alto', 'tenor']
const ALL: readonly VoiceId[] = ['soprano', 'alto', 'tenor', 'bass']

/**
 * Which bass note each event belongs to — a held one shares the one before it.
 *
 * The player writes one degree per *bass note*, not per sonority, so a
 * suspension's two chords both read from the same slot of the draft.
 */
function bassSlots(events: readonly HarmonicEvent[]): readonly number[] {
  return events.map(
    (_, index) =>
      events.slice(0, index + 1).filter((event) => event.held !== true).length - 1,
  )
}

export interface SatbScoreProps {
  question: HarmonyQuestion
  /** The bass notes written so far. */
  written: readonly Pitch[]
  revealed: boolean
  onPlay: () => void
  status: PlaybackStatus
}

export function SatbScore({
  question,
  written,
  revealed,
  onPlay,
  status,
}: SatbScoreProps) {
  const { t } = useTranslation(['exercise', 'common'])
  const names = useMusicNames()

  const { progression, satz } = question
  const { key } = progression
  const signature = keySignatureOf(key) ?? '0'
  const keyName = names.scaleName(tonicKey(key.tonic), key.mode)

  const slots = bassSlots(satz.events)
  const events: SatbEvent[] = satz.events.map((event, index) => {
    const voicing = satz.voicings[index]
    if (voicing === undefined)
      return { voicing: satz.voicings[0] as never, ticks: event.ticks }

    if (revealed) {
      return {
        voicing,
        ticks: event.ticks,
        ...(event.held === true ? { held: true } : {}),
      }
    }

    const entered = written[slots[index] ?? 0]
    return {
      voicing: entered === undefined ? voicing : { ...voicing, bass: entered },
      ticks: event.ticks,
      ...(event.held === true ? { held: true } : {}),
      hide: entered === undefined ? ALL : UPPER,
    }
  })

  const rows = analysisRows(progression)

  const mei = satbMei({
    keySignature: signature,
    events,
    ...(revealed ? { analysis: rows } : {}),
  })

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink">
          {keyName}
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
            ? t('common:play.unavailable')
            : status === 'loading'
              ? t('common:play.loading')
              : t('harmony.replay')}
        </button>
      </div>

      <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center">
        <Score
          className={PHRASE_SCORE_BOX}
          mei={mei}
          profile={satbProfile(satz.events.length, getKeySignature(signature).count)}
          label={
            revealed
              ? t('harmony.scoreLabel.revealed', { key: keyName })
              : t('harmony.scoreLabel.draft', { key: keyName })
          }
        />
      </div>
    </>
  )
}
