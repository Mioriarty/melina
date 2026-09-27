import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StufenKeyboard } from '@/components/input/StufenKeyboard'
import type { HarmonyRoundProps } from '@/exercises/harmony-shared/HarmonyDictation'
import { SatbScore } from '@/exercises/harmony-shared/SatbScore'
import { RoundScreen } from '@/exercises/shared/RoundScreen'
import { bassNoteEvents, type Numeral } from '@/lib/music/numeral'

import { NumeralRow } from './NumeralRow'
import { stufenAnswer, stufenVerdicts, type StufenAnswer } from './rules'

/**
 * Hear a progression, name every chord in it.
 *
 * The staff stays blank until the answer is in — there is nothing of the
 * answer to draw on it, since a name is not a note — and the names go into a
 * row of slots underneath. Revealed, the staff shows all four voices with the
 * figures, Stufen and functions printed under them, which is the answer in
 * every notation at once.
 *
 * **The last chord named is the answer**, the way a bass line answers itself
 * on its last note: every key goes dead once there is a name for every bass
 * note, and backspace covers everything before that.
 */
export function StufenRoundScreen({
  phase,
  total,
  question,
  onPlay,
  playStatus,
  onAnswer,
  onNext,
  onQuit,
}: HarmonyRoundProps<StufenAnswer>) {
  const { t } = useTranslation('exercise')
  const [written, setWritten] = useState<readonly Numeral[]>([])

  const { key, events } = question.progression
  const length = bassNoteEvents(events).length
  const revealed = phase.name === 'revealed'
  const chosen = revealed ? phase.answer.chosen : written

  return (
    <RoundScreen
      phase={phase}
      total={total}
      prompt={t('round.prompt.stufen')}
      correct={stufenAnswer(question) ?? []}
      onAnswer={onAnswer}
      onNext={onNext}
      onQuit={onQuit}
      score={
        <>
          <SatbScore
            question={question}
            revealed={revealed}
            onPlay={onPlay}
            status={playStatus}
          />
          <NumeralRow
            keyOf={key}
            length={length}
            written={chosen}
            {...(revealed ? { verdicts: stufenVerdicts(question, chosen) } : {})}
          />
        </>
      }
      keyboard={(binding) => (
        <StufenKeyboard
          keyOf={key}
          inversions={question.inversions === true}
          canAppend={written.length < length}
          canRemove={written.length > 0}
          state={binding.state}
          onAppend={(numeral) => {
            // Computed here rather than inside an updater: an updater has to be
            // pure, and React runs it twice in development — which would answer
            // the question twice.
            const next = [...written, numeral]
            setWritten(next)
            if (next.length === length) binding.onAnswer(next)
          }}
          onRemove={() => setWritten((current) => current.slice(0, -1))}
        />
      )}
    />
  )
}
