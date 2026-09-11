import type { FiguredBassAttempt } from '@/lib/db/attemptQuestion'
import type { AttemptFilter } from '@/lib/db/progress'
import { figureKey, parseFigureKey, type Figure } from '@/lib/music/figuredBass'
import { isKeySignatureId } from '@/lib/music/keySignature'
import { parsePitch, pitchKey } from '@/lib/music/pitch'

import { DEFAULT_REGISTER } from '@/lib/music/voicing'

import {
  describeEvent,
  type BassEvent,
  type ThoroughbassQuestion,
  type ThoroughbassRoundSpec,
} from './generate'

/**
 * A figured bass in the attempt log, and the way back out.
 *
 * The row keeps the bass line and the figures and nothing else, because
 * everything else is implied by them: the chord is what the figure resolves to,
 * the accepted spellings are what `canonicalFigures` derives, and the clef is
 * not a fact about the question at all — a grand staff is not in one.
 */

function bassKey(events: readonly BassEvent[]): string {
  return events.map((event) => pitchKey(event.bass)).join(',')
}

function figuresKey(events: readonly BassEvent[]): string {
  return events.map((event) => event.figures.map(figureKey).join('-')).join(',')
}

export function thoroughbassAttempt(question: ThoroughbassQuestion): FiguredBassAttempt {
  return {
    kind: 'figured-bass',
    keySignature: question.keySignature,
    bass: bassKey(question.events),
    figures: figuresKey(question.events),
  }
}

/** The question again, rebuilt from a row. `undefined` for a row that will not spell. */
export function thoroughbassQuestion(
  attempt: FiguredBassAttempt,
): ThoroughbassQuestion | undefined {
  if (!isKeySignatureId(attempt.keySignature)) return undefined

  const basses = attempt.bass.split(',')
  const columns = attempt.figures.split(',')
  if (basses.length !== columns.length) return undefined

  const events: BassEvent[] = []
  // The same reference the generator threaded when it built the question, or
  // the chords would come back voiced differently from the ones that were on
  // the page — a row disagreeing with the notation it produced.
  let near = DEFAULT_REGISTER
  for (const [index, text] of basses.entries()) {
    const bass = parsePitch(text)
    if (bass === undefined) return undefined

    const figures: Figure[] = []
    for (const part of (columns[index] ?? '').split('-')) {
      const figure = parseFigureKey(part)
      if (figure === undefined) return undefined
      figures.push(figure)
    }

    const event = describeEvent(bass, attempt.keySignature, figures, near)
    if (event === undefined) return undefined
    events.push(event)
    near = event.chords[event.chords.length - 1]?.[0] ?? near
  }

  return events.length === 0 ? undefined : { keySignature: attempt.keySignature, events }
}

/**
 * Which past answers count towards a level's accuracy.
 *
 * Only the dimensions a level genuinely **bounds**. Its figure list does bound
 * what comes up — a level offering 6 and 6/4 never asks a 7 — so it is pinned,
 * and it is pinned in the canonical spelling because that is what the row
 * stores. What is not pinned is anything the generator merely happened to
 * choose, which is the rule a rhythm level follows in leaving out its cell
 * weights: a level cannot claim the questions it did not ask.
 */
export function thoroughbassFilter(
  spec: ThoroughbassRoundSpec,
  exerciseId?: string,
): AttemptFilter {
  const events = Math.max(1, spec.events)

  return {
    ...(exerciseId === undefined ? {} : { exerciseId }),
    kind: 'figured-bass',
    keySignature: [...spec.keySignatures],
    bassNotes: String(events),
    // `figure` is only a facet where there is one bass note to carry it, and
    // it spans both vocabularies: a suspension is stored under the same
    // dash-joined key the level names it with.
    ...(events === 1 ? { figure: [...spec.figures, ...spec.suspensions] } : {}),
  }
}
