import { useTranslation } from 'react-i18next'

import { voicesAt, type SatzDraft } from '@/exercises/satb-entry/draft'
import { PlayableScore } from '@/exercises/shared/PlayableScore'
import { PHRASE_SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { keySignatureOf } from '@/lib/music/key'
import { getKeySignature } from '@/lib/music/keySignature'
import { VOICES, type Satz, type VoiceId, type Voicing } from '@/lib/music/satbVoicing'
import { chromaticValue } from '@/lib/music/pitch'
import { cn } from '@/lib/utils/cn'
import { tonicKey } from '@/lib/music/scale'
import { figureText } from '@/lib/notation/figureNotation'
import { satbMei, type SatbEvent } from '@/lib/notation/satbMei'
import { markSlot, type ScoreCursor } from '@/lib/notation/scoreCursor'
import { satbProfile } from '@/lib/notation/verovio'

import { analysisRows } from './analysis'
import { CHANGED_NOTE } from './changedClasses'
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
 *
 * **A wrong setting can be shown mended** — see `correctedSetting` — in the
 * same place and at the same size as the player's own, switched between rather
 * than stacked: two grand staves on a phone are two thumbnails. It is *a*
 * correct setting, never *the* answer, because a cadence has many; and the
 * notes it had to change are drawn in the accent colour, so what was wrong can
 * be read off the page rather than found by comparing two pictures. Whichever
 * is shown is what the staff sounds.
 */

export interface SatzScoreProps {
  question: CadenceQuestion
  draft: SatzDraft
  revealed: boolean
  /** The chord the next press goes into, banded behind the music. */
  cursor?: ScoreCursor | undefined
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
  /** A correct setting close to the player's, once a wrong one is in. */
  correction?: Satz | undefined
  /** Whether the staff shows `correction` rather than what was written. */
  showCorrection?: boolean
  onPlayCorrection?: (() => void) | undefined
  correctionStatus?: PlaybackStatus
}

/** Which voices of each chord differ between two settings. */
function differences(
  from: readonly (Voicing | undefined)[],
  to: readonly Voicing[],
): readonly (readonly VoiceId[])[] {
  return to.map((voicing, index) => {
    const before = from[index]
    return VOICES.filter(
      (voice) =>
        before === undefined ||
        chromaticValue(before[voice]) !== chromaticValue(voicing[voice]) ||
        before[voice].letter !== voicing[voice].letter,
    )
  })
}

export function SatzScore({
  question,
  draft,
  revealed,
  cursor,
  onPlay,
  status,
  correction,
  showCorrection = false,
  onPlayCorrection,
  correctionStatus,
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

  const profile = satbProfile(progression.events.length, getKeySignature(signature).count)
  const written = progression.events.map((_, index) => {
    const voices = voicesAt(draft, index)
    return VOICES.every((voice) => voices[voice] !== undefined)
      ? (voices as Voicing)
      : undefined
  })
  const changes =
    correction === undefined ? [] : differences(written, correction.voicings)
  const correctionMei =
    correction === undefined
      ? undefined
      : satbMei({
          keySignature: signature,
          events: progression.events.map((event, index) => ({
            voicing: correction.voicings[index] as Voicing,
            ticks: event.ticks,
            ...(event.held === true ? { held: true } : {}),
            mark: changes[index] ?? [],
          })),
          analysis: rows,
        })
  const showing = showCorrection && correctionMei !== undefined
  const shownMei = showing ? correctionMei : mei

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
        mei={shownMei}
        label={
          showing
            ? t('satb.scoreLabel.corrected', {
                key: names.keyName(signature),
                count: changes.reduce((total, voices) => total + voices.length, 0),
              })
            : t('satb.scoreLabel.staff', {
                key: names.keyName(signature),
                lage: names.lage(lage),
                events: spoken,
              })
        }
        profile={profile}
        box={showing ? cn(PHRASE_SCORE_BOX, CHANGED_NOTE) : PHRASE_SCORE_BOX}
        {...(cursor === undefined
          ? {}
          : { decorate: (svg: string) => markSlot(svg, cursor) })}
        {...(showing
          ? {
              ...(onPlayCorrection === undefined ? {} : { onPlay: onPlayCorrection }),
              ...(correctionStatus === undefined ? {} : { status: correctionStatus }),
            }
          : {
              ...(onPlay === undefined ? {} : { onPlay }),
              ...(status === undefined ? {} : { status }),
            })}
      />
    </>
  )
}
