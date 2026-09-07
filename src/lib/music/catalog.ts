import {
  intervalKey,
  isValidInterval,
  parseIntervalKey,
  type Interval,
  type IntervalQuality,
} from './interval'

/**
 * Which intervals the app offers, and in what order.
 *
 * The keyboard is built from this: rows are numbers, columns are qualities.
 * Qualities are listed smallest-first so a given quality always occupies the
 * same column on every row — a keyboard used hundreds of times earns its
 * muscle memory from stable positions.
 */

/** Column order on the interval keyboard, smallest interval first. */
export const QUALITY_ORDER: readonly IntervalQuality[] = [
  'doubly-diminished',
  'diminished',
  'minor',
  'perfect',
  'major',
  'augmented',
  'doubly-augmented',
]

/** Rows on the interval keyboard: unison through octave. */
export const CATALOG_NUMBERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Doubly-augmented and doubly-diminished intervals are real but effectively
 * never read from a score, so they are modelled but kept out of the offered
 * catalog. Widening this list is all it takes to surface them.
 */
const CATALOG_QUALITIES: readonly IntervalQuality[] = [
  'diminished',
  'minor',
  'perfect',
  'major',
  'augmented',
]

/** Every interval the keyboard can show, in row-then-column order. */
export const CATALOG: readonly Interval[] = CATALOG_NUMBERS.flatMap((number) =>
  QUALITY_ORDER.filter(
    (quality) =>
      CATALOG_QUALITIES.includes(quality) && isValidInterval({ number, quality }),
  ).map((quality) => ({ number, quality })),
)

/**
 * On by default: the intervals of ordinary tonal music, plus both spellings
 * of the tritone. A4 and d5 are in from the start on purpose — separating
 * them is the point of reading practice rather than a bonus round.
 *
 * The perfect unison is included: Verovio engraves it as two noteheads side
 * by side on the same line, so it is not mistakable for a single note.
 */
export const DEFAULT_INTERVAL_KEYS: readonly string[] = [
  'P1',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'A4',
  'd5',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
]

export const CATALOG_KEYS: readonly string[] = CATALOG.map(intervalKey)

/** Catalog entries for a keyboard row, already in column order. */
export function catalogRow(number: number): readonly Interval[] {
  return CATALOG.filter((interval) => interval.number === number)
}

/**
 * The intervals a *hearing* exercise may ask.
 *
 * The ear can only tell apart what actually sounds different, and spelling is
 * inaudible. An augmented second and a minor third are both three semitones;
 * a diminished second and a perfect unison are both zero; an augmented fourth
 * and a diminished fifth are both six. Offering both spellings of the same
 * sound would make the question unanswerable however well you listen, so
 * hearing offers **exactly one interval per semitone count** — the plain
 * spelling wherever one exists.
 *
 * Six semitones is the one gap: there is no perfect, major or minor fourth or
 * fifth of that size, so the tritone is represented by the augmented fourth
 * and the diminished fifth is left out. That keeps the tritone available
 * without ever asking which of its two names you heard.
 *
 * Reading is unaffected — there the spelling is on the page to be read.
 */
export const HEARABLE_INTERVAL_KEYS: readonly string[] = [
  'P1',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'A4',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
]

export const HEARABLE_CATALOG: readonly Interval[] = HEARABLE_INTERVAL_KEYS.map((key) => {
  const interval = parseIntervalKey(key)
  if (interval === undefined) throw new Error(`invalid hearable interval: ${key}`)
  return interval
})

/** Whether a given interval can be told apart by ear from the rest of the set. */
export function isHearable(interval: Interval): boolean {
  return HEARABLE_INTERVAL_KEYS.includes(intervalKey(interval))
}
