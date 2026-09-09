/**
 * Note and rest outlines, taken from Leland.
 *
 * **Generated — run `npm run glyphs` rather than editing this.**
 *
 * Leland is the notation font inside the Verovio WebAssembly, so there is no
 * file to subset; `scripts/extract-glyphs.mjs` lifts these out of Verovio's own
 * SVG output instead. They are baked in because the keyboard has to draw before
 * 7 MB of engraver has finished downloading, and a key that arrives late is a
 * key that moves under a thumb.
 *
 * Coordinates are the font's own, **y upwards**, so everything is drawn under a
 * `scale(1, -1)`. Each glyph keeps notation's own anchor rather than its
 * middle: a notehead's origin is its **left edge**, which is where a downward
 * stem meets it, and a rest's origin is the line it hangs from or sits on —
 * which is the entire difference between a whole rest and a half rest. `box`
 * is the measured ink, since a key has neither a staff nor a stem to place
 * them against.
 *
 * Leland is by MuseScore BVBA under the SIL Open Font License 1.1 — the same
 * font this app already ships inside Verovio.
 */

export interface Glyph {
  /** SMuFL codepoint, so a glyph can be checked against the standard. */
  code: string
  /** Path data in font units, y upwards. */
  d: string
  /** Where the ink falls, measured. See the note above about anchors. */
  box: { x0: number; x1: number; y0: number; y1: number }
}

/** A whole note has no stem: the head is the glyph. */
export const noteheadWhole: Glyph = {
  code: 'E0A2',
  d: 'M195 -102c41 0 75 8 75 57c0 25 -18 89 -32 116s-32 33 -60 33c-15 0 -31 -2 -43 -6c-24 -8 -34 -24 -32 -51c1 -27 19 -91 32 -116s32 -33 60 -33zM187 136c138 0 186 -70 186 -135s-48 -135 -186 -135s-187 70 -187 135s49 135 187 135z',
  box: { x0: 0, x1: 373, y0: -134, y1: 136 },
}

/** Hollow, and the only thing separating a half from a quarter. */
export const noteheadHalf: Glyph = {
  code: 'E0A3',
  d: 'M75 -86c46 0 215 85 215 135c0 22 -16 36 -40 36c-47 0 -215 -86 -215 -135c0 -9 7 -36 40 -36zM213 132c62 0 112 -33 112 -92c0 -88 -109 -173 -213 -173c-81 0 -112 48 -112 91c0 93 116 174 213 174z',
  box: { x0: 0, x1: 325, y0: -133, y1: 132 },
}

/** Every value from a quarter down. */
export const noteheadBlack: Glyph = {
  code: 'E0A4',
  d: 'M0 -42c0 92 116 174 213 174c62 0 112 -33 112 -92c0 -88 -109 -173 -213 -173c-81 0 -112 48 -112 91z',
  box: { x0: 0, x1: 325, y0: -133, y1: 132 },
}

/** Hangs off the bottom of a downward stem. */
export const flag8thDown: Glyph = {
  code: 'E241',
  d: 'M0 1v226c0 3 1 8 8 11c42 14 147 68 212 179c18 31 47 74 47 157c0 72 -16 125 -56 218c-2 4 -3 9 -3 12c0 6 2 10 7 12c1 1 3 1 5 1c6 0 12 -4 15 -11c53 -97 74 -173 74 -264c0 -88 -30 -154 -79 -224c-50 -70 -110 -117 -149 -182c-36 -59 -45 -97 -46 -101 c-1 -3 -10 -38 -10 -39c-1 -4 -7 -8 -12 -8c-7 0 -13 6 -13 13z',
  box: { x0: 0, x1: 309, y0: -12, y1: 817 },
}

/** Two hooks, drawn as one glyph rather than two. */
export const flag16thDown: Glyph = {
  code: 'E243',
  d: 'M37 240c146 39 226 114 230 268c-27 -48 -96 -104 -154 -149c-59 -45 -67 -82 -74 -107c0 -3 -1 -7 -2 -12zM0 -10v398c0 2 8 24 15 27c77 17 223 106 244 190l1 3c4 12 5 25 5 38c0 67 -26 101 -61 138c-4 4 -10 8 -10 11c0 5 13 8 17 8c6 0 12 -2 16 -5 c33 -26 79 -81 79 -160c0 -26 -2 -44 -6 -57c6 -37 9 -74 9 -107c0 -185 -140 -262 -193 -313c-40 -38 -71 -68 -86 -171c-2 -8 -7 -16 -15 -16s-15 8 -15 16z',
  box: { x0: 0, x1: 309, y0: -26, y1: 803 },
}

/** Hangs *below* its line. */
export const restWhole: Glyph = {
  code: 'E4E3',
  d: 'M14 5h297c8 0 14 -6 14 -14v-108c0 -8 -6 -14 -14 -14h-297c-8 0 -14 6 -14 14v108c0 8 6 14 14 14z',
  box: { x0: 0, x1: 325, y0: -131, y1: 5 },
}

/** Sits *on* its line — the only thing telling the two apart. */
export const restHalf: Glyph = {
  code: 'E4E4',
  d: 'M0 10v108c0 14 0 14 14 14h297c14 0 14 0 14 -14v-108c0 -14 0 -14 -14 -14h-297c-14 0 -14 0 -14 14z',
  box: { x0: 0, x1: 325, y0: -4, y1: 132 },
}

export const restQuarter: Glyph = {
  code: 'E4E5',
  d: 'M230 -166l2 -3c2 -3 3 -5 3 -8s-1 -5 -3 -9c-3 -4 -6 -5 -10 -5s-8 2 -8 2l-39 25c-8 5 -19 9 -32 9c-32 0 -56 -26 -56 -58c0 -18 7 -32 7 -32s32 -58 35 -63c1 -2 3 -5 3 -9s-2 -8 -7 -12c-2 -2 -4 -2 -6 -2c-7 0 -12 6 -12 6s-75 95 -96 127c-8 11 -11 25 -11 39 c0 51 40 93 91 93c12 0 21 -2 25 -3l-112 139c-2 2 -3 5 -3 8v9c0 2 1 6 2 8l101 154c2 3 3 8 3 12c0 5 -1 9 -3 12l-76 104s-3 5 -3 11c0 3 1 7 5 10c3 2 5 3 8 3c6 0 10 -6 10 -6l162 -219c2 -2 3 -5 3 -8v-9c0 -2 -1 -5 -2 -7l-102 -154c-1 -2 -2 -6 -2 -9 c0 -2 1 -5 2 -6l115 -142c3 -4 5 -6 6 -7z',
  box: { x0: 0, x1: 235, y0: -331, y1: 401 },
}

export const rest8th: Glyph = {
  code: 'E4E6',
  d: 'M267 203c6 -3 9 -7 9 -12c0 -2 0 -4 -1 -5l-140 -441l-27 8l114 356c-34 -37 -69 -62 -122 -62c-47 0 -100 25 -100 79c0 39 32 71 72 71c39 0 71 -32 71 -71c0 -19 -7 -35 -18 -48c16 3 32 10 45 20c45 33 76 92 80 98c2 5 7 8 13 8c1 0 3 -1 4 -1z',
  box: { x0: 0, x1: 276, y0: -255, y1: 204 },
}

export const rest16th: Glyph = {
  code: 'E4E7',
  d: 'M343 186l-195 -693l-27 7l102 365c-30 -39 -69 -64 -119 -66c-20 0 -37 2 -56 10c-26 9 -47 34 -47 64c0 40 30 74 70 74c39 0 73 -29 73 -69c0 -17 -6 -34 -17 -48c51 13 108 78 122 125l45 159c-30 -39 -69 -64 -119 -66c-47 0 -101 19 -103 75c0 39 29 72 69 74 c39 0 74 -30 74 -69c0 -18 -5 -34 -17 -48c55 14 95 68 119 116c3 5 7 8 13 8c1 0 3 0 5 -1c6 -2 9 -7 9 -12c0 -2 0 -3 -1 -5z',
  box: { x0: 1, x1: 344, y0: -507, y1: 204 },
}
