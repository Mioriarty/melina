import { useTranslation } from 'react-i18next'

import { PlayableScore } from '@/exercises/shared/PlayableScore'
import { PHRASE_SCORE_BOX } from '@/exercises/shared/scoreBox'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import type { Figure } from '@/lib/music/figuredBass'
import { getKeySignature, type KeySignatureId } from '@/lib/music/keySignature'
import type { Pitch } from '@/lib/music/pitch'
import { figureText } from '@/lib/notation/figureNotation'
import { thoroughbassMei } from '@/lib/notation/mei'
import { thoroughbassProfile } from '@/lib/notation/verovio'

/**
 * The grand staff: a bass line with its figures under it, and the chords above.
 *
 * The notation is the play button, as everywhere else — and as everywhere else
 * it is only pressable when everything is on screen. In the figuring direction
 * the chord *is* the question, so it can be sounded at any time; in the
 * realising direction it is the answer, so pressing it before answering would
 * give it away, and the caller withholds `onPlay` until then.
 *
 * The page is a fixed size for the whole question — see `thoroughbassProfile`.
 * That is what keeps the staff still while a figure is typed under it or a
 * chord onto it.
 */

export interface GrandStaffEvent {
  bass: Pitch
  figures: readonly Figure[]
  chord: readonly Pitch[]
}

export interface GrandStaffScoreProps {
  keySignature: KeySignatureId
  events: readonly GrandStaffEvent[]
  /** Engraved in place but not drawn, until the answer reveals them. */
  hideChords?: boolean
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

export function GrandStaffScore({
  keySignature,
  events,
  hideChords = false,
  onPlay,
  status,
}: GrandStaffScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const mei = thoroughbassMei({ keySignature, events, hideChords })

  // Never the answer: the bass and its figures are the question in one
  // direction and half of it in the other, and the chord is named only once it
  // is on the page to be seen.
  const spoken = events
    .map((event) => {
      const figured = event.figures.map(figureText).filter((text) => text !== '')
      return figured.length === 0
        ? t('thoroughbass.scoreLabel.plain', { bass: names.pitchSpoken(event.bass) })
        : t('thoroughbass.scoreLabel.figured', {
            bass: names.pitchSpoken(event.bass),
            figure: figured.join(' – '),
          })
    })
    .join('; ')

  return (
    <PlayableScore
      mei={mei}
      label={t('thoroughbass.scoreLabel.staff', {
        key: names.keyName(keySignature),
        events: spoken,
      })}
      profile={thoroughbassProfile(events.length, getKeySignature(keySignature).count)}
      // Two staves and a row of figures under them: taller than one staff, and
      // capped at a single staff's share of the screen it left a third of its
      // own box empty with the notation shrunk to fit the rest.
      box={PHRASE_SCORE_BOX}
      {...(onPlay === undefined ? {} : { onPlay })}
      {...(status === undefined ? {} : { status })}
    />
  )
}
