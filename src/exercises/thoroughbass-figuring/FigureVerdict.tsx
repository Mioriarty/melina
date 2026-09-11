import { useTranslation } from 'react-i18next'

import type { ThoroughbassQuestion } from '@/exercises/thoroughbass-shared/generate'
import { figurePitches, sameNotes, type Figure } from '@/lib/music/figuredBass'
import { figureText } from '@/lib/notation/figureNotation'

import type { FiguringAnswer } from './rules'

/**
 * Why that was wrong.
 *
 * **Canonical-required grading owes the player this line.** Most wrong answers
 * here are not wrong notes at all — they are the right chord written out in
 * full, or under a sign the convention does not use — and being told "no"
 * without being told which teaches nothing. So the two failures are named
 * apart: a figure that resolves to something else is a different chord, and a
 * figure that resolves to the same notes is the right chord spelled long.
 *
 * Its height is reserved whether or not it says anything, so revealing an
 * answer does not move the staff above it.
 */
export interface FigureVerdictProps {
  question: ThoroughbassQuestion
  chosen: FiguringAnswer | undefined
}

const printed = (figures: readonly Figure[] | undefined) =>
  figures === undefined || figures.length === 0 ? '' : figures.map(figureText).join(' – ')

export function FigureVerdict({ question, chosen }: FigureVerdictProps) {
  const { t } = useTranslation('exercise')

  const event = question.events[0]
  const written = chosen?.[0]

  if (event === undefined || chosen === undefined) {
    return <p className="min-h-9" />
  }

  const wrote = printed(written)
  const correct = printed(event.figures)

  // Right chord, wrong spelling: the abbreviation is the thing being taught.
  const notes = event.notes[0]
  const resolved = written?.[0]
  const sameChord =
    notes !== undefined &&
    resolved !== undefined &&
    written?.length === event.figures.length &&
    sameNotes(figurePitches(event.bass, question.keySignature, resolved) ?? [], notes)

  // A figure of no figure at all reads as a phrase mid-sentence, not as the
  // chip label the setup screen and the summary use.
  const named = (text: string) => (text === '' ? t('thoroughbass.nothing') : text)

  return (
    <p className="min-h-9 px-2 text-center text-sm leading-snug text-ink-muted">
      {t(sameChord ? 'figuring.verdict.spelling' : 'figuring.verdict.chord', {
        wrote: named(wrote),
        correct: named(correct),
      })}
    </p>
  )
}
