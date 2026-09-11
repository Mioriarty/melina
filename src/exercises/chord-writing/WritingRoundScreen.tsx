import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChordKeyboard } from '@/components/input/ChordKeyboard'
import {
  chordPitches as draftChordPitches,
  emptyChordDraft,
  isFull,
  removeLast,
  type ChordDraft,
} from '@/exercises/chord-entry/draft'
import type { ChordQuestion } from '@/exercises/chord-shared/generate'
import { PlayableScore } from '@/exercises/shared/PlayableScore'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import type { ActivePhase } from '@/exercises/shared/round'
import type { PlaybackStatus } from '@/exercises/shared/usePlayback'
import { useMusicNames } from '@/hooks/useMusicNames'
import { chordSize, memberAt } from '@/lib/music/chord'
import type { Pitch } from '@/lib/music/pitch'
import { tonicKey } from '@/lib/music/scale'
import { chordMei } from '@/lib/notation/mei'
import { CHORD_ANSWER_PROFILE } from '@/lib/notation/verovio'

import type { WritingAnswer } from './rules'

export interface WritingRoundScreenProps {
  phase: ActivePhase<ChordQuestion, WritingAnswer>
  total: number
  question: ChordQuestion
  reducedMotion: boolean
  onPlay: () => void
  playStatus: PlaybackStatus
  onAnswer: (chosen: WritingAnswer, ms: number) => void
  onNext: () => void
  onQuit: () => void
}

/**
 * One question of writing a chord down.
 *
 * The name is the question and the staff is where the answer goes — the same
 * shape rhythmic dictation and realising a figured bass have, and the reason
 * this screen supplies its own `score` rather than letting `RoundScreen` draw
 * the notation: what is on the staff is the player's, not the question's.
 *
 * **There is no confirm key**, because a chord is exactly fillable: three notes
 * for a triad and four for a seventh, every key that would overfill disabled,
 * and the last press left is the one that completes it.
 *
 * The staff cannot be pressed while the answer is being written. It would sound
 * the player's own half-written chord, which is backwards — and before that,
 * the chord it would sound is the answer.
 */
export function WritingRoundScreen({
  phase,
  total,
  question,
  reducedMotion,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: WritingRoundScreenProps) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  const size = chordSize(question.chord.quality)
  const [draft, setDraft] = useState<ChordDraft>(() => emptyChordDraft([size]))

  const revealed = phase.name === 'revealed'
  const wrong = revealed && !phase.answer.correct

  const written = draftChordPitches(draft, 0, question.clef)

  // The name is the question, so it says everything the verdict will read: the
  // chord, which member is in the bass, and — only where the level asks for
  // one — which is on top.
  const asked = [
    names.chordName(tonicKey(question.chord.root), question.chord.quality),
    names.inversionName(question.chord.inversion, size),
    ...(question.asks.lage ? [names.lage(memberAt(question.chord.top))] : []),
  ].join(t('chord.summary.join'))

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('chord.prompt.writing', { chord: asked })}
      correct={question.pitches}
      reducedMotion={reducedMotion}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        wrong ? (
          <div className="flex min-h-0 w-full max-w-full flex-1 items-stretch justify-center gap-3">
            {/* **A wrong chord is not replaced by the right one.** Swapping
                one for the other says you were wrong and says nothing else;
                what is worth seeing is which note moved, and that needs both
                on the page at once. */}
            <Compared caption={t('chord.staff.yours')}>
              <Staff pitches={written} question={question} />
            </Compared>
            <Compared caption={t('chord.staff.correct')}>
              <Staff
                pitches={question.pitches}
                question={question}
                onPlay={onPlay}
                status={playStatus}
              />
            </Compared>
          </div>
        ) : (
          <Staff
            pitches={revealed ? question.pitches : written}
            question={question}
            {...(revealed ? { onPlay, status: playStatus } : {})}
          />
        )
      }
      keyboard={(binding) => (
        <ChordKeyboard
          draft={draft}
          // Keyless, so every letter starts natural and the switches move it.
          keySignature="0"
          alterations
          doubles
          clef={question.clef}
          state={binding.state}
          onChange={(next) => {
            setDraft(next)
            if (isFull(next)) binding.onAnswer(next.chords[0] ?? [])
          }}
          onRemove={() => setDraft(removeLast)}
        />
      )}
    />
  )
}

function Staff({
  pitches,
  question,
  onPlay,
  status,
}: {
  pitches: readonly Pitch[]
  question: ChordQuestion
  onPlay?: (() => void) | undefined
  status?: PlaybackStatus
}) {
  const { t } = useTranslation('exercise')
  const names = useMusicNames()

  return (
    <PlayableScore
      mei={chordMei({ pitches, clef: question.clef })}
      // The reserve is what the player may still write, so the page is fixed
      // and a note already placed never moves as the next one arrives.
      profile={CHORD_ANSWER_PROFILE}
      label={
        pitches.length === 0
          ? t('chord.score.empty', { clef: names.clefSpoken(question.clef) })
          : t('chord.score.shown', {
              clef: names.clefSpoken(question.clef),
              pitches: pitches.map((note) => names.pitchSpoken(note)).join(', '),
            })
      }
      onPlay={onPlay}
      {...(status === undefined ? {} : { status })}
    />
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
