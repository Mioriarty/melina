/**
 * How the placeholder first note is faded back.
 *
 * **Opacity, not a colour.** Two things make that the only workable choice
 * rather than merely the tidier one:
 *
 * - Verovio ships its own stylesheet inside every render, and it contains
 *   `#<id> path { stroke: currentColor }`. That is an *ID* selector, so it
 *   beats any class rule of ours — and a stem is a `<path>` with no stroke of
 *   its own, inheriting from that rule rather than from the note group around
 *   it. Setting `stroke` on the group therefore reached the noteheads and left
 *   every stem full black. Opacity is not a property that rule touches.
 * - It is what "greyed out" actually means here: the placeholder is the ink of
 *   a real note, faded, rather than ink of a different colour. Nothing has to
 *   invent a value that then has to be kept in step with the palette.
 *
 * **Ledger lines are a separate rule because they are a separate element.**
 * Verovio draws them as `<g class="ledgerLines below">` inside the *staff*, as
 * a sibling of the layer — not inside the note that needs them — so nothing
 * scoped to the note can reach them. Fading every ledger line on the staff is
 * exact rather than approximate, and only because of when it is applied: while
 * the placeholder is showing, it is the only note on that staff, so every
 * ledger line drawn belongs to it. The caller applies this only then.
 */

/** The note itself: notehead, stem and any accidental, faded together. */
export const PLACEHOLDER_NOTE = '[&_.placeholder]:opacity-30'

/** The ledger lines it needs. Only while the placeholder is the only note. */
export const PLACEHOLDER_LEDGERS = '[&_.ledgerLines]:opacity-30'
