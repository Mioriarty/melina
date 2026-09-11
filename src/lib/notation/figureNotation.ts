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
/**
 * The dash that joins a figure to the one after it under the same bass note.
 *
 * `4 – 3` is how a suspension is printed, and it is what the keyboard's dash
 * key types — so it has to be drawn, or pressing that key changes nothing a
 * player can see.
 *
 * **It has to be part of the text.** MEI has `@extender` on an `<f>` for
 * exactly this, Verovio accepts it, and it draws nothing: the figures come out
 * as two bare numbers with a gap between them, in context and out of it.
 * `thoroughbassVerovio.test.ts` pins that, so the day the engraver grows a real
 * extender this can stop faking it.
 */
/**
 * The dash that joins a figure to the one after it under the same bass note.
 *
 * Exported because the render has to be able to tell a figure that continues
 * from one that does not: a continuing figure is aligned to the *start* of its
 * bass note so the dash can run rightward from it, where a figure standing on
 * its own is centred. See `figureAlignment.ts`.
 */
export const CONTINUES = ' –'

/**
 * A whole figure, top line first — the order it is read down the column in.
 *
 * `followed` appends the dash to **every** line rather than to the column as a
 * whole, which is the only thing a stacked `<fb>` can express. For the
 * suspensions the app teaches that is exactly right, because both halves are a
 * single line; on a taller column it reads as "each of these moves", which is
 * at worst more emphatic than an engraver would be.
 */
export function figureLines(figure: Figure, followed = false): readonly string[] {
  return [...figure.signs]
    .sort((a, b) => b.number - a.number)
    .map((sign) => `${signText(sign)}${followed ? CONTINUES : ''}`)
}

/** The same thing on one line, for a label or a summary chip: `6/5`, `♯`. */
export function figureText(figure: Figure): string {
  return figureLines(figure).join('/')
}
