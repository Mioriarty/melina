import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PlayableExample } from '@/components/explain/PlayableExample'
import { Score } from '@/components/notation/Score'
import { satzSchedule } from '@/exercises/harmony-shared/schedule'
import { useMusicNames } from '@/hooks/useMusicNames'
import { playStruck } from '@/lib/audio/engine'
import { keySignatureOf } from '@/lib/music/key'
import { satbMei } from '@/lib/notation/satbMei'
import { SATB_EXAMPLE_PROFILE } from '@/lib/notation/verovio'
import { exampleSatz, type VoiceLeadingExample } from '@/pages/voiceLeadingExamples'
import { cn } from '@/lib/utils/cn'

/**
 * Engraved settings for the voice-leading guide.
 *
 * **Every staff is the model evaluated.** The chords come from `buildEvents`
 * and the faults are found by `satzFindings` — the same two functions the
 * exercise generates and grades with — so the page cannot come to illustrate
 * something the app no longer does. What is written by hand is only *where the
 * four voices go*, which is the thing being illustrated, and
 * `VoiceLeadingPage.test.ts` holds each one to showing exactly the fault it
 * claims.
 *
 * **Every staff is pressable, and here that matters more than anywhere else in
 * the app.** A parallel fifth is a *sound* — two voices collapsing into one
 * thickened line — and a reader who can only look at the noteheads is being
 * asked to take the whole page on trust. Pressing the clean example and then
 * the faulty one, which differ by a single note, is the fastest way anyone has
 * ever learnt why the rule exists.
 */

/** Fast enough to hear the two chords as a pair rather than as two events. */
const EXAMPLE_TEMPO = 60

export interface SatzExampleProps {
  example: VoiceLeadingExample
  className?: string
}

export function SatzExample({ example, className }: SatzExampleProps) {
  const { t } = useTranslation('guide')
  const names = useMusicNames()

  // Memoised so the sound keeps its identity across renders — see
  // `PlayableExample`, whose hook silences playback when it changes.
  const satz = useMemo(() => exampleSatz(example), [example])
  const sound = useCallback(
    () =>
      satz === undefined
        ? Promise.resolve()
        : playStruck(satzSchedule(satz, EXAMPLE_TEMPO)),
    [satz],
  )

  if (satz === undefined) return null

  const signature = keySignatureOf(satz.key) ?? '0'
  const label =
    example.rule === undefined
      ? t('voiceLeading.staff.clean')
      : t('voiceLeading.staff.fault', { rule: names.rule(example.rule) })

  return (
    <PlayableExample
      sound={sound}
      label={label}
      className={cn('block w-full', className)}
    >
      <Score
        className="max-h-52"
        mei={satbMei({
          keySignature: signature,
          events: satz.events.map((event, index) => ({
            voicing: satz.voicings[index] as NonNullable<(typeof satz.voicings)[number]>,
            ticks: event.ticks,
          })),
        })}
        profile={SATB_EXAMPLE_PROFILE}
        label={label}
      />
    </PlayableExample>
  )
}
