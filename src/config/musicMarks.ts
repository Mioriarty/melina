/**
 * Decorative musical glyphs scattered along the path.
 *
 * Authored as plain geometry rather than pulled from a SMuFL font: a real
 * music font (Bravura, Leland) is 200-400 kB, which is a poor trade for
 * decoration in an offline-first app that just had its font payload trimmed
 * to 92 kB. Real notation arrives with Verovio when the exercises do.
 *
 * Each glyph declares its own viewBox and intrinsic aspect ratio so it can be
 * placed at any size without distortion. Parts render in order.
 */

export type MarkPart =
  | { kind: 'fill'; d: string; transform?: string }
  | { kind: 'stroke'; d: string; width: number; cap?: 'round' | 'butt' }
  | { kind: 'text'; x: number; y: number; value: string; size: number }

export interface MusicMark {
  viewBox: string
  /** width / height, used to derive a height from a placed width. */
  aspect: number
  /**
   * Rendered width range in px. Per-glyph because these are not
   * interchangeable: a five-line staff needs real width to read as a staff,
   * while a flat sign at that width would shout.
   */
  size: readonly [number, number]
  parts: readonly MarkPart[]
}

/** A slanted notehead centred on (cx, cy). */
function notehead(cx: number, cy: number): MarkPart {
  return {
    kind: 'fill',
    d: 'M-7 0 a 7 5 0 1 0 14 0 a 7 5 0 1 0 -14 0 Z',
    transform: `translate(${cx} ${cy}) rotate(-22)`,
  }
}

/** A stem rising from (x, bottom) to (x, top). */
function stem(x: number, top: number, bottom: number): MarkPart {
  return { kind: 'stroke', d: `M${x} ${bottom} L${x} ${top}`, width: 2.2 }
}

export const MUSIC_MARKS = {
  /** Three beamed quavers under a triplet numeral — as in the sketch. */
  triplet: {
    viewBox: '0 0 84 84',
    aspect: 84 / 84,
    size: [64, 92],
    parts: [
      { kind: 'text', x: 45, y: 12, value: '3', size: 16 },
      { kind: 'fill', d: 'M16.5 22 L74.5 16 L74.5 25 L16.5 31 Z' },
      stem(16.5, 22, 62),
      stem(45.5, 19, 62),
      stem(74.5, 16, 62),
      notehead(10, 62),
      notehead(39, 62),
      notehead(68, 62),
    ],
  },

  /** Two beamed quavers. */
  beamedPair: {
    viewBox: '0 0 58 74',
    aspect: 58 / 74,
    size: [46, 66],
    parts: [
      { kind: 'fill', d: 'M16.5 18 L50.5 11 L50.5 20 L16.5 27 Z' },
      stem(16.5, 18, 58),
      stem(50.5, 11, 58),
      notehead(10, 58),
      notehead(44, 58),
    ],
  },

  /** A single crotchet. */
  quarterNote: {
    viewBox: '0 0 26 72',
    aspect: 26 / 72,
    size: [26, 38],
    parts: [stem(16.5, 8, 58), notehead(10, 58)],
  },

  /** F clef. */
  bassClef: {
    viewBox: '0 0 54 68',
    aspect: 54 / 68,
    size: [42, 60],
    parts: [
      {
        kind: 'fill',
        d: 'M12 16 C 26 6 46 12 44 30 C 42 50 22 60 8 64 C 22 52 34 42 34 28 C 34 18 24 14 18 22 C 15 26 10 22 12 16 Z',
      },
      { kind: 'fill', d: 'M48 19 a 2.8 2.8 0 1 0 0.1 0 Z' },
      { kind: 'fill', d: 'M48 31 a 2.8 2.8 0 1 0 0.1 0 Z' },
    ],
  },

  fermata: {
    viewBox: '0 0 48 32',
    aspect: 48 / 32,
    size: [40, 56],
    parts: [
      { kind: 'stroke', d: 'M4 27 C 4 5 44 5 44 27', width: 2.6, cap: 'round' },
      { kind: 'fill', d: 'M24 15 a 3.4 3.4 0 1 0 0.1 0 Z' },
    ],
  },

  flat: {
    viewBox: '0 0 24 58',
    aspect: 24 / 58,
    size: [24, 34],
    parts: [
      { kind: 'stroke', d: 'M6 4 L6 50', width: 2.4, cap: 'round' },
      { kind: 'fill', d: 'M6 29 C 17 21 24 31 16 41 C 12 46 8 50 6 52 Z' },
    ],
  },

  sharp: {
    viewBox: '0 0 30 54',
    aspect: 30 / 54,
    size: [28, 40],
    parts: [
      { kind: 'stroke', d: 'M11 9 L11 47', width: 2.2 },
      { kind: 'stroke', d: 'M21 5 L21 43', width: 2.2 },
      { kind: 'fill', d: 'M4 21 L27 17 L27 23 L4 27 Z' },
      { kind: 'fill', d: 'M4 33 L27 29 L27 35 L4 39 Z' },
    ],
  },

  /** Five staff lines — a fragment of ruled paper. */
  staff: {
    viewBox: '0 0 120 26',
    aspect: 120 / 26,
    size: [120, 190],
    parts: [
      { kind: 'stroke', d: 'M0 3 L120 3', width: 1.1 },
      { kind: 'stroke', d: 'M0 8.5 L120 8.5', width: 1.1 },
      { kind: 'stroke', d: 'M0 14 L120 14', width: 1.1 },
      { kind: 'stroke', d: 'M0 19.5 L120 19.5', width: 1.1 },
      { kind: 'stroke', d: 'M0 25 L120 25', width: 1.1 },
    ],
  },
} satisfies Record<string, MusicMark>

export type MusicMarkName = keyof typeof MUSIC_MARKS
