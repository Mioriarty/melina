import { useTranslation } from 'react-i18next'

import { voicesAt, type SatzDraft } from '@/exercises/satb-entry/draft'
import { PlayableScore } from '@/exercises/shared/PlayableScore'
import { PHRASE_SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { keySignatureOf } from '@/lib/music/key'
import { getKeySignature } from '@/lib/music/keySignature'
import { VOICES, type VoiceId, type Voicing } from '@/lib/music/satbVoicing'
import { tonicKey } from '@/lib/music/scale'
import { figureText } from '@/lib/notation/figureNotation'
import { satbMei, type SatbEvent } from '@/lib/notation/satbMei'
import { markSlot, type ScoreCursor } from '@/lib/notation/scoreCursor'
import { satbProfile } from '@/lib/notation/verovio'

import { analysisRows } from './analysis'
import type { CadenceQuestion } from './generate'

/**
 * A cadence being written out, on a grand staff.
 *
 * The bass and the figures are the question and are drawn from the first
 * moment; the three voices above them are **engraved in place and not drawn**
 * until they are written. That is the reveal rule every hearing exercise here
 * follows, used for a different purpose: leaving an unwritten voice out would
 * re-engrave a different piece of music at every keypress, so the staff would
 * narrow and the notes already down would slide sideways under the player's
 * hand. What stands in for an unwritten voice is the search's own note, which
 * nothing paints.
 *
 * The Stufen and the function symbols arrive with the answer. They cost the
 * page nothing, because `satbProfile` reserves room for all three rows of
 * analysis whether or not they are printed — the same reason a rhythm is
 * engraved to a fixed page rather than fitted to its content.
 *
 * **The staff is not pressable until the answer is in.** Before that it would
 * sound the setting being asked for, which is the answer; afterwards it sounds
 * what the player actually wrote, which is most of why they wrote it down.
 */

export interface SatzScoreProps {
  question: CadenceQuestion
  draft: SatzDraft
  revealed: boolean
  /** The chord the next press goes into, banded behind the music. */
  cursor?: ScoreCursor | undefined
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

export function SatzScore({
  question,
  draft,
  revealed,
  cursor,
  onPlay,
  status,
}: SatzScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const { progression, model, lage } = question
  const { key } = progression
  const signature = keySignatureOf(key) ?? '0'

  const rows = analysisRows(progression)

  const events: SatbEvent[] = progression.events.map((event, index) => {
    const written = voicesAt(draft, index)
    const placeholder = model.voicings[index]
    const voicing = { ...placeholder, ...written } as Voicing
    const missing: readonly VoiceId[] = VOICES.filter(
      (voice) => written[voice] === undefined,
    )

    return {
      voicing,
      ticks: event.ticks,
      ...(event.held === true ? { held: true } : {}),
      ...(missing.length > 0 ? { hide: missing } : {}),
    }
  })

  const mei = satbMei({
    keySignature: signature,
    events,
    analysis: revealed ? rows : { figures: rows.figures },
  })

  const spoken = progression.events
    .map((event, index) => {
      const bass = names.pitchSpoken(
        model.voicings[index]?.bass ?? { ...event.bass, octave: 3 },
      )
      const figure = rows.figures[index]
      const text = figure === undefined ? '' : figureText(figure)
      return text === ''
        ? t('satb.scoreLabel.plain', { bass })
        : t('satb.scoreLabel.figured', { bass, figure: text })
    })
    .join('; ')

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink">
          {names.scaleName(tonicKey(key.tonic), key.mode)}
        </span>
        <span
          className="rounded-full border border-accent/40 bg-accent-tint px-3 py-1.5 text-sm font-medium text-accent"
          title={t('satb.lage', { lage: names.lage(lage) })}
        >
          {names.lage(lage)}
        </span>
      </div>

      <PlayableScore
        mei={mei}
        label={t('satb.scoreLabel.staff', {
          key: names.keyName(signature),
          lage: names.lage(lage),
          events: spoken,
        })}
        profile={satbProfile(progression.events.length, getKeySignature(signature).count)}
        box={PHRASE_SCORE_BOX}
        {...(cursor === undefined
          ? {}
          : { decorate: (svg: string) => markSlot(svg, cursor) })}
        {...(onPlay === undefined ? {} : { onPlay })}
        {...(status === undefined ? {} : { status })}
      />
    </>
  )
}
