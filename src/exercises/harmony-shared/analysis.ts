import type { Figure } from '@/lib/music/figuredBass'
import {
  eventFigure,
  eventStufe,
  stufeFunction,
  type HarmonicEvent,
} from '@/lib/music/harmony'
import type { Key } from '@/lib/music/key'
import type { Progression } from '@/lib/music/progression'
import { functionText, stufeText } from '@/lib/notation/harmonyNotation'

/**
 * The three rows a progression is written under.
 *
 * Karlsruhe's ear-training paper lets the candidate choose which of the three
 * to answer in — *"entweder in Generalbassziffern oder in Funktionszeichen
 * oder in Stufenzeichen"* — and all three are printed here at once, every one
 * of them derived from the same events. That is the argument for the model's
 * shape rather than a nicety: three parallel implementations could disagree
 * about what a chord was.
 *
 * **A suspension is labelled once, under the chord it belongs to.** The
 * cadential six-four reads as a second-inversion tonic if you only look at its
 * notes, and that is a true reading of the sonority — but the harmony is a
 * dominant with two lines hanging over it, which is what the *next* event
 * spells out. So the pair takes the resolution's symbol, printed under the
 * first of the two, and the figures carry the movement: `6/4` then `5/3`.
 * That is how a score is actually annotated.
 */

export interface AnalysisRows {
  figures: readonly (Figure | undefined)[]
  stufen: readonly string[]
  functions: readonly string[]
}

function labelsOf(key: Key, event: HarmonicEvent): { stufe: string; symbol: string } {
  const stufe = eventStufe(key, event)
  if (stufe === undefined) return { stufe: '', symbol: '' }

  const symbol = stufeFunction(key, stufe)
  return {
    stufe: stufeText(stufe),
    // A chord with no agreed function symbol prints none rather than an
    // invented one — the Stufen row always works, so nothing is lost.
    symbol: symbol === undefined ? '' : functionText(symbol),
  }
}

export function analysisRows(progression: Progression): AnalysisRows {
  const { key, events } = progression

  const figures = events.map((event, index) => eventFigure(key, event, events[index - 1]))
  const stufen: string[] = []
  const functions: string[] = []

  for (const [index, event] of events.entries()) {
    if (event.held === true) {
      // Already named under the suspension it resolves.
      stufen.push('')
      functions.push('')
      continue
    }

    const resolution = events[index + 1]
    const labelled = resolution?.held === true ? resolution : event
    const { stufe, symbol } = labelsOf(key, labelled)
    stufen.push(stufe)
    functions.push(symbol)
  }

  return { figures, stufen, functions }
}
