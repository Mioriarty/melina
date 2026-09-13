import { inversionFigure } from '@/lib/music/chord'
import type { FunctionSymbol, Stufe } from '@/lib/music/harmony'

/**
 * Printing a Stufe and a function symbol.
 *
 * Here rather than in `lib/music` for the reason a figure's text is in
 * `figureNotation.ts` rather than in `figuredBass.ts`: the model holds the
 * fact and this holds the **notation**. And notation is what these are — `V7`
 * and `D7` are written the same way in every language that teaches them, so
 * unlike a mode's name or an interval's quality they do not go through i18n.
 * What *is* translated is the spoken form, "Dominantseptakkord" against
 * "dominant seventh", which lives in the `harmony` namespace.
 */

const NUMERALS: readonly string[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Qualities that are written in lower case, which is to say the minor ones. */
const LOWER: readonly string[] = [
  'minor',
  'minor-seventh',
  'diminished',
  'diminished-seventh',
  'half-diminished-seventh',
]

/** The mark a numeral carries after it: ° for diminished, ø for half, + for augmented. */
const MARKS: Readonly<Record<string, string>> = {
  diminished: '°',
  'diminished-seventh': '°',
  'half-diminished-seventh': 'ø',
  augmented: '+',
}

const ALTERATIONS: Readonly<Record<number, string>> = { [-1]: '♭', 0: '', 1: '♯' }

/**
 * A Stufe as it is written: `V7`, `vii°`, `♭II6`, `V6/5`.
 *
 * The inversion comes from `inversionFigure` — the table `chord.ts` already
 * keeps, because the abbreviation is a convention rather than arithmetic. Root
 * position prints nothing at all, which is the same *"any Figure not
 * absolutely necessary"* rule a figured bass follows.
 */
export function stufeText(stufe: Stufe): string {
  const numeral = NUMERALS[stufe.number - 1] ?? '?'
  const cased = LOWER.includes(stufe.quality) ? numeral.toLowerCase() : numeral
  const sign = ALTERATIONS[stufe.alteration] ?? ''
  const mark = MARKS[stufe.quality] ?? ''

  const figure = inversionFigure(stufe.quality, stufe.inversion)
  // A plain triad in root position is the one figure nobody writes.
  const position = figure === '5/3' ? '' : figure

  return `${sign}${cased}${mark}${position}`
}

/**
 * **The stroke through a rootless dominant.**
 *
 * Funktionstheorie reads the diminished triad on the seventh degree as a
 * dominant seventh with its root missing, and writes it with a stroke through
 * the D. A combining overlay is the only way to type it, and whether a font
 * draws it is not something the markup can promise — `satbVerovio.test.ts`
 * checks that it survives the engraver rather than assuming it.
 */
const INCOMPLETE = '̸'

/**
 * A function symbol as it is written: `T`, `D7`, `Tp`, `sP`, `D̸7`.
 *
 * The case of the `p` is not decoration. Riemann's convention is that the
 * parallel of a *major* chord takes a lower-case p (`Tp`) and the parallel of
 * a *minor* one an upper-case P (`tP`) — so the case says which chord you
 * started from, and the two are different chords.
 */
export function functionText(symbol: FunctionSymbol): string {
  const base = symbol.minor ? symbol.base.toLowerCase() : symbol.base
  const stroke = symbol.incomplete === true ? INCOMPLETE : ''
  const parallel = symbol.parallel === true ? (symbol.minor ? 'P' : 'p') : ''
  const seventh = symbol.seventh === true ? '7' : ''

  return `${base}${stroke}${parallel}${seventh}`
}
