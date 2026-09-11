import type { ReactNode } from 'react'
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
 *
 * **Given `answer`, it draws the two side by side instead of one.** A wrong
 * chord replaced by the right one tells you that you were wrong and nothing
 * else; the useful thing is which note moved, and that is only visible when
 * both are on the page at once. They are separate renders rather than two
 * measures of one, so each caption sits under its own staff: the first measure
 * of a system starts after the clef and the signature, so two measures are not
 * evenly split and a caption row under them would not line up.
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
  /**
   * What was wanted, drawn beside what was written. Given only once an answer
   * is in and was wrong — before that there is nothing to compare it with.
   */
  answer?: readonly GrandStaffEvent[]
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}

export function GrandStaffScore({
  keySignature,
  events,
  hideChords = false,
  answer,
  onPlay,
  status,
}: GrandStaffScoreProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  // Never the answer: the bass and its figures are the question in one
  // direction and half of it in the other, and the chord is named only once it
  // is on the page to be seen.
  const spoken = (shown: readonly GrandStaffEvent[]) =>
    shown
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

  const staff = (shown: readonly GrandStaffEvent[], hidden: boolean) => ({
    mei: thoroughbassMei({ keySignature, events: shown, hideChords: hidden }),
    label: t('thoroughbass.scoreLabel.staff', {
      key: names.keyName(keySignature),
      events: spoken(shown),
    }),
    // Two staves and a row of figures under them: taller than one staff, and
    // capped at a single staff's share of the screen it left a third of its
    // own box empty with the notation shrunk to fit the rest.
    profile: thoroughbassProfile(shown.length, getKeySignature(keySignature).count),
    box: PHRASE_SCORE_BOX,
  })

  if (answer === undefined) {
    return (
      <PlayableScore
        {...staff(events, hideChords)}
        {...(onPlay === undefined ? {} : { onPlay })}
        {...(status === undefined ? {} : { status })}
      />
    )
  }

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center gap-3">
      <Compared caption={t('realizing.staff.yours')}>
        <PlayableScore {...staff(events, false)} />
      </Compared>
      {/*
        The play button goes on the right one only. Realising sounds nothing
        while the question is up — the chord *is* the answer — so after a wrong
        one what the player has not yet heard is the chord that was wanted, and
        two play buttons side by side would be two ways to ask which.
      */}
      <Compared caption={t('realizing.staff.correct')}>
        <PlayableScore
          {...staff(answer, false)}
          {...(onPlay === undefined ? {} : { onPlay })}
          {...(status === undefined ? {} : { status })}
        />
      </Compared>
    </div>
  )
}

/** One staff of a comparison, named underneath so the two can be told apart. */
function Compared({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0 flex min-h-0 min-w-0 flex-1 flex-col items-stretch">
      {children}
      <figcaption className="mt-1 shrink-0 text-center text-[0.8125rem] font-medium text-ink-muted">
        {caption}
      </figcaption>
    </figure>
  )
}
