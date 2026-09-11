import { useTranslation } from 'react-i18next'

import { PlayableScore } from '@/exercises/shared/PlayableScore'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { chordMei } from '@/lib/notation/mei'
import type { VerovioOptions } from 'verovio/esm'

import type { ChordQuestion } from './generate'

export interface ChordScoreProps {
  question: ChordQuestion
  /**
   * Engraved in place but not drawn. The hearing question is an empty staff
   * until the answer is in — leaving the notes out instead would re-engrave a
   * different piece of music, and the staff would resize the moment the chord
   * appeared.
   */
  hidden?: boolean
  profile?: VerovioOptions
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

/**
 * The chord on its staff.
 *
 * **The notation is the play button**, as everywhere else, and it is only
 * pressable when every note is on screen: a hearing question at any time,
 * because sounding it *is* the question, and a reading question only once its
 * answer is out, since before that the sound would answer it.
 *
 * The spoken label never gives the chord away. Before the answer it says there
 * is a chord to be heard; after it, the notes that are actually drawn — which
 * is what a screen reader needs from notation and is not the same thing as the
 * answer, since naming the chord is still the player's job.
 */
export function ChordScore({
  question,
  hidden = false,
  profile,
  onPlay,
  status,
}: ChordScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const label = hidden
    ? t('chord.score.hidden', { clef: names.clefSpoken(question.clef) })
    : t('chord.score.shown', {
        clef: names.clefSpoken(question.clef),
        pitches: question.pitches.map((note) => names.pitchSpoken(note)).join(', '),
      })

  return (
    <PlayableScore
      mei={chordMei({ pitches: question.pitches, clef: question.clef, hidden })}
      label={label}
      {...(profile === undefined ? {} : { profile })}
      onPlay={onPlay}
      {...(status === undefined ? {} : { status })}
    />
  )
}
