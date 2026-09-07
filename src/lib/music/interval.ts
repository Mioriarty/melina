import {
  chromaticValue,
  diatonicValue,
  isAlteration,
  letterFromDiatonicValue,
  octaveFromDiatonicValue,
  type Alteration,
  type Pitch,
} from './pitch'

/**
 * Intervals, modelled by spelling.
 *
 * An interval is a *number* (how many letter names it spans, counting both
 * ends) and a *quality* (how its size compares to the diatonic default for
 * that number). Both are needed: a diminished fifth and an augmented fourth
 * are both six semitones and are not the same interval, and telling them
 * apart is exactly the skill being trained.
 *
 * The arithmetic runs on the two axes from `pitch.ts`:
 *
 *   number    = |Δdiatonic| + 1
 *   deviation = |Δchromatic| − the default semitones for that number
 *
 * and the quality is read off the deviation, using a different mapping for
 * the perfect family (unisons, fourths, fifths, octaves) than for the rest.
 */

export type IntervalQuality =
  | 'doubly-diminished'
  | 'diminished'
  | 'minor'
  | 'perfect'
  | 'major'
  | 'augmented'
  | 'doubly-augmented'

export interface Interval {
  /** 1 is a unison, 2 a second, 8 an octave, 9 a ninth. Never 0. */
  number: number
  quality: IntervalQuality
}

export type Direction = 'up' | 'down'

/** Semitones spanned by each simple interval number at its default quality. */
const DEFAULT_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const

/**
 * Numbers whose default quality is "perfect" rather than "major". Fourths and
 * fifths join unisons here because they are the intervals that invert onto
 * themselves within the octave.
 */
const PERFECT_FAMILY = new Set([1, 4, 5])

/** Reduce a compound number to its simple equivalent: a ninth becomes a second. */
export function simpleNumber(number: number): number {
  return ((number - 1) % 7) + 1
}

/** How many whole octaves a compound interval spans on top of its simple part. */
export function octaveSpan(number: number): number {
  return Math.floor((number - 1) / 7)
}

export function isPerfectFamily(number: number): boolean {
  return PERFECT_FAMILY.has(simpleNumber(number))
}

/**
 * Semitones spanned by `number` at its default quality — perfect for the
 * perfect family, major for everything else. Compound numbers work with no
 * extra code, which is what keeps ninths and elevenths cheap to add later.
 */
export function defaultSemitones(number: number): number {
  const simple = DEFAULT_SEMITONES[simpleNumber(number) - 1] ?? 0
  return simple + 12 * octaveSpan(number)
}

/**
 * How far each quality sits from the default size, in semitones. The two
 * families differ because the imperfect one has an extra step — minor —
 * between diminished and major.
 */
const PERFECT_DEVIATIONS: Record<number, IntervalQuality> = {
  [-2]: 'doubly-diminished',
  [-1]: 'diminished',
  0: 'perfect',
  1: 'augmented',
  2: 'doubly-augmented',
}

const IMPERFECT_DEVIATIONS: Record<number, IntervalQuality> = {
  [-3]: 'doubly-diminished',
  [-2]: 'diminished',
  [-1]: 'minor',
  0: 'major',
  1: 'augmented',
  2: 'doubly-augmented',
}

function deviationTable(number: number): Record<number, IntervalQuality> {
  return isPerfectFamily(number) ? PERFECT_DEVIATIONS : IMPERFECT_DEVIATIONS
}

/**
 * Only called with a deviation derived from two real pitches, whose distance
 * is non-negative by construction, so the size rule below cannot be violated
 * here and is not re-checked.
 */
function qualityFromDeviation(
  number: number,
  deviation: number,
): IntervalQuality | undefined {
  return deviationTable(number)[deviation]
}

/**
 * An interval must span a non-negative number of semitones.
 *
 * Three name/number combinations the tables would otherwise produce fail
 * this: the diminished unison (−1), the doubly-diminished unison (−2) and
 * the doubly-diminished second (−1). None of them is a real interval —
 * shrinking a unison does not give a smaller interval, it turns the interval
 * round — and allowing them would break the guarantee that transposing by an
 * interval and then measuring the result gives that same interval back.
 *
 * Note this rejects only genuinely negative sizes. The *diminished second*
 * spans exactly zero semitones (C to D double flat) and is entirely real —
 * it is the interval that has to be told apart from a perfect unison, which
 * is one of the things this app exists to teach.
 */
function deviationFromQuality(
  number: number,
  quality: IntervalQuality,
): number | undefined {
  const table = deviationTable(number)
  for (const [deviation, candidate] of Object.entries(table)) {
    if (candidate !== quality) continue
    const size = defaultSemitones(number) + Number(deviation)
    return size >= 0 ? Number(deviation) : undefined
  }
  return undefined
}

/** Whether a quality can exist on a given number at all. */
export function isValidInterval({ number, quality }: Interval): boolean {
  return number >= 1 && deviationFromQuality(number, quality) !== undefined
}

/** Semitones spanned by a specific interval. */
export function intervalSemitones(interval: Interval): number | undefined {
  const deviation = deviationFromQuality(interval.number, interval.quality)
  if (deviation === undefined) return undefined
  return defaultSemitones(interval.number) + deviation
}

/**
 * The interval between two pitches, as an absolute size — direction is the
 * caller's business, since a descending major third and an ascending one are
 * the same interval.
 *
 * Returns `undefined` only for spellings so extreme that no standard quality
 * name applies (a triply-augmented fourth, say).
 */
export function intervalBetween(a: Pitch, b: Pitch): Interval | undefined {
  const diatonicSteps = Math.abs(diatonicValue(b) - diatonicValue(a))
  const semitones = Math.abs(chromaticValue(b) - chromaticValue(a))

  const number = diatonicSteps + 1
  const deviation = semitones - defaultSemitones(number)
  const quality = qualityFromDeviation(number, deviation)

  return quality === undefined ? undefined : { number, quality }
}

/** Which way `b` lies from `a`. Enharmonic unisons count as neither. */
export function directionBetween(a: Pitch, b: Pitch): Direction | undefined {
  const steps = diatonicValue(b) - diatonicValue(a)
  if (steps !== 0) return steps > 0 ? 'up' : 'down'

  const semitones = chromaticValue(b) - chromaticValue(a)
  if (semitones !== 0) return semitones > 0 ? 'up' : 'down'
  return undefined
}

/**
 * Move a pitch by an interval.
 *
 * Returns `undefined` when the result would need a triple accidental — an
 * augmented fourth above B♯ is E♯♯♯, which is not notation anyone wants to
 * read. The question generator treats that as "pick a different starting
 * note" rather than as an error.
 */
export function transpose(
  from: Pitch,
  interval: Interval,
  direction: Direction = 'up',
): Pitch | undefined {
  const semitones = intervalSemitones(interval)
  if (semitones === undefined) return undefined

  const sign = direction === 'up' ? 1 : -1
  const targetDiatonic = diatonicValue(from) + sign * (interval.number - 1)
  const targetChromatic = chromaticValue(from) + sign * semitones

  const letter = letterFromDiatonicValue(targetDiatonic)
  const octave = octaveFromDiatonicValue(targetDiatonic)

  // Whatever alteration makes the natural letter land on the target sound.
  const natural = chromaticValue({ letter, alteration: 0, octave })
  const alteration = targetChromatic - natural

  return isAlteration(alteration)
    ? { letter, alteration: alteration as Alteration, octave }
    : undefined
}

export function intervalsEqual(a: Interval, b: Interval): boolean {
  return a.number === b.number && a.quality === b.quality
}

/* ------------------------------------------------------------------ keys */

/**
 * Only the machine form lives here. Anything a player reads — "Perfect
 * fifth", "reine Quinte" — comes from the `music` translation namespace
 * through `useMusicNames`, because the quality adjective and the ordinal
 * inflect differently in different languages and cannot be concatenated
 * from English parts.
 */

const QUALITY_ABBREVIATIONS: Record<IntervalQuality, string> = {
  'doubly-diminished': 'dd',
  diminished: 'd',
  minor: 'm',
  perfect: 'P',
  major: 'M',
  augmented: 'A',
  'doubly-augmented': 'AA',
}

/**
 * Storable, sortable form: `P5`, `m3`, `d5`, `A4`, `dd7`. Used in settings
 * and in the attempt log, so it must round-trip exactly.
 */
export function intervalKey(interval: Interval): string {
  return `${QUALITY_ABBREVIATIONS[interval.quality]}${interval.number}`
}

const KEY_PATTERN = /^(dd|d|m|P|M|A|AA)(\d+)$/

export function parseIntervalKey(key: string): Interval | undefined {
  const match = KEY_PATTERN.exec(key.trim())
  if (match === null) return undefined

  const [, abbreviation, number] = match
  const quality = (
    Object.entries(QUALITY_ABBREVIATIONS) as [IntervalQuality, string][]
  ).find(([, value]) => value === abbreviation)?.[0]

  if (quality === undefined || number === undefined) return undefined

  const interval = { number: Number(number), quality }
  return isValidInterval(interval) ? interval : undefined
}
