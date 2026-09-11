import type { Figure, FigureAccidental, FigureSign } from '@/lib/music/figuredBass'

/**
 * Writing a figure down.
 *
 * This is the **spelling** half of a figure; `lib/music/figuredBass.ts` holds
 * the facts. Nothing decided here is ever graded — a figure is graded on the
 * notes it resolves to and on whether it is one of the conventional forms, both
 * of which are settled before anything reaches this file.
 *
 * It is not translated, and that is deliberate rather than an oversight: a
 * figure is notation, not language. `♯6` is `♯6` in German too.
 */

/**
 * The accidental glyphs, as the characters Verovio maps to SMuFL's **figured
 * bass** accidentals — U+EA65..U+EA67 — rather than to the ordinary ones it
 * draws in front of a notehead. They are narrower and sit on the figure's own
 * baseline, which is what makes a column of them read as figures rather than as
 * notation that has fallen off the staff.
 */
const ACCIDENTAL_GLYPHS: Record<FigureAccidental, string> = {
  none: '',
  sharp: '♯',
  flat: '♭',
  natural: '♮',
}

/**
 * One line of a figure, as it is printed.
 *
 * **A 3 carrying an accidental loses its digit**: "the Figure 3 being always
 * suppressed in modern Thoroughbasses, and the Accidental Sign alone inserted
 * in its place when the Third of the Chord is to be altered." So the raised
 * third of a dominant in a minor key prints as a bare ♯, which is how it
 * appears on every page of continuo ever engraved — and a plain 3, which is
 * only ever written as the resolution of a suspension, keeps its digit.
 */
export function signText(sign: FigureSign): string {
  const glyph = ACCIDENTAL_GLYPHS[sign.accidental]
  return sign.number === 3 && sign.accidental !== 'none'
    ? glyph
    : `${glyph}${sign.number}`
}

/** A whole figure, top line first — the order it is read down the column in. */
export function figureLines(figure: Figure): readonly string[] {
  return [...figure.signs].sort((a, b) => b.number - a.number).map(signText)
}

/** The same thing on one line, for a label or a summary chip: `6/5`, `♯`. */
export function figureText(figure: Figure): string {
  return figureLines(figure).join('/')
}
