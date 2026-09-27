import { inversionFigure } from '@/lib/music/chord'
import {
  appliedKey,
  buildEvents,
  eventStufe,
  stufeFunction,
  type FunctionSymbol,
  type Stufe,
} from '@/lib/music/harmony'
import type { Key } from '@/lib/music/key'
import { numeralSpec, type Numeral } from '@/lib/music/numeral'

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

/** Riemann's sign for the Neapolitan: the minor subdominant with a minor sixth. */
const NEAPOLITAN_FUNCTION = 'sN'

/**
 * A named chord in both notations at once: `{ stufe: 'V7/ii', func: '(D7)Sp' }`.
 *
 * Built by **building the chord and reading it back** — through `buildEvents`
 * and the same `eventStufe` and `stufeFunction` the analysis rows under a
 * setting are printed with — so a key on the keyboard and the row under the
 * revealed answer can never name one chord two ways. `func` is empty where
 * Funktionstheorie has no agreed symbol, as it is in those rows.
 *
 * An applied dominant is written the way both traditions write it: the
 * dominant read in its own region, then what it is the dominant *of*. The
 * dominant of the dominant has a name of its own, `DD`.
 */
export function numeralText(key: Key, numeral: Numeral): { stufe: string; func: string } {
  if (numeral.of !== undefined) {
    const region = appliedKey(key, numeral.of)
    // The dominant itself, read in the region it belongs to.
    const dominant =
      region === undefined
        ? undefined
        : readNumeral(region, {
            degree: 5,
            inversion: numeral.inversion,
            ...(numeral.seventh === true ? { seventh: true } : {}),
          })
    // What it is the dominant of, as the key names that chord — the natural
    // seventh degree in minor, since that is the only one that is a region.
    const target = readNumeral(key, {
      degree: numeral.of,
      inversion: 0,
      ...(numeral.of === 7 ? { plain: true } : {}),
    })
    if (dominant === undefined || target === undefined) return { stufe: '', func: '' }

    const seventh = numeral.seventh === true ? '7' : ''
    const targetFunction = target.symbol === undefined ? '' : functionText(target.symbol)
    return {
      stufe: `${stufeText(dominant.stufe)}/${stufeText(target.stufe)}`,
      func:
        numeral.of === 5
          ? `DD${seventh}`
          : targetFunction === ''
            ? ''
            : `(D${seventh})${targetFunction}`,
    }
  }

  const read = readNumeral(key, numeral)
  if (read === undefined) return { stufe: '', func: '' }
  return {
    stufe: stufeText(read.stufe),
    func:
      numeral.neapolitan === true
        ? NEAPOLITAN_FUNCTION
        : read.symbol === undefined
          ? ''
          : functionText(read.symbol),
  }
}

/** A chord that is not applied, built and read back. */
function readNumeral(
  key: Key,
  numeral: Numeral,
): { stufe: Stufe; symbol: FunctionSymbol | undefined } | undefined {
  const [event] = buildEvents(key, numeralSpec(numeral)) ?? []
  const stufe = event === undefined ? undefined : eventStufe(key, event)
  if (stufe === undefined) return undefined
  return { stufe, symbol: stufeFunction(key, stufe) }
}
