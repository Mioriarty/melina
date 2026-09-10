import { TICKS_PER_BEAT, ticksPerMeasure, type TimeSignature } from './meter'
import { isValidRhythm, sameRhythm, type Rhythm } from './rhythm'

/**
 * A run of bars in one metre — what melodic dictation asks for, and what
 * rhythmic dictation asks one of.
 *
 * **A phrase is a list of bars, not a long bar.** Storing it as one stretch of
 * ticks would have been fewer lines and would have cost the thing that makes
 * the whole exercise possible: a bar is the unit every existing function
 * already understands. `buildBar` fills one, `notateRhythm` spells one,
 * `maxDurationAt` knows what a note may cross inside one. Keeping the bar
 * whole means going from one to four of them changed none of them.
 *
 * **That is also why there are no ties.** A note may not cross a boundary
 * stronger than the one it starts on, and the barline is the strongest there
 * is — `maxDurationAt` already refuses it. So a sound running past a barline is
 * written as a note and then a rest in the next bar, which is exactly what a
 * single bar already does for any gap one value cannot span. Since impacts are
 * the whole of what is graded, and playback rings every note until the next
 * impact, the two spell the same sound and nothing is lost by not tying.
 *
 * The metre is held once rather than on every bar: a phrase does not change
 * metre part way through, and two copies of a fact are two facts that can
 * disagree.
 */
export interface Phrase {
  meter: TimeSignature
  /** Tick offsets from each bar's own barline, one list per bar. */
  bars: readonly (readonly number[])[]
}

/** How many bars there are. Never zero for a phrase anything generated. */
export function barCount(phrase: Phrase): number {
  return phrase.bars.length
}

/**
 * One bar, in the form everything else in the app already takes.
 *
 * This is the whole adapter: hand a bar to `notateRhythm`, `onsetsInBeat`,
 * `rhythmDivision` or anything else built for a single bar and it works
 * unchanged.
 */
export function barRhythm(phrase: Phrase, index: number): Rhythm {
  return { meter: phrase.meter, onsets: phrase.bars[index] ?? [] }
}

export function phraseRhythms(phrase: Phrase): readonly Rhythm[] {
  return phrase.bars.map((_, index) => barRhythm(phrase, index))
}

/** Ticks in the whole phrase. */
export function phraseTicks(phrase: Phrase): number {
  return ticksPerMeasure(phrase.meter) * phrase.bars.length
}

/**
 * Every impact, measured from the start of the phrase rather than from its own
 * barline.
 *
 * Playback and grading both want the line whole; the bars are what notation
 * and the metric hierarchy want. Deriving one from the other rather than
 * storing both is what keeps them from disagreeing.
 */
export function phraseOnsets(phrase: Phrase): readonly number[] {
  const perBar = ticksPerMeasure(phrase.meter)
  return phrase.bars.flatMap((onsets, bar) => onsets.map((tick) => tick + bar * perBar))
}

/** How many impacts the phrase has, which is how many notes a melody carries. */
export function impactCount(phrase: Phrase): number {
  return phrase.bars.reduce((total, onsets) => total + onsets.length, 0)
}

/** Which bar a tick from the start of the phrase falls in. */
export function barOfTick(phrase: Phrase, tick: number): number {
  return Math.floor(tick / ticksPerMeasure(phrase.meter))
}

/** The barline after a tick — the one boundary a written note may never cross. */
export function nextBarline(phrase: Phrase, tick: number): number {
  const perBar = ticksPerMeasure(phrase.meter)
  return (Math.floor(tick / perBar) + 1) * perBar
}

/**
 * Whether two phrases are the same — which is to say, the same impacts in the
 * same bars.
 *
 * The rhythmic half of being correct, and it is `sameRhythm` bar by bar: the
 * claim that a rhythm is its impacts does not change because there are more
 * bars of them.
 */
export function samePhrase(a: Phrase, b: Phrase): boolean {
  return (
    a.meter.beats === b.meter.beats &&
    a.bars.length === b.bars.length &&
    a.bars.every((_, index) => sameRhythm(barRhythm(a, index), barRhythm(b, index)))
  )
}

export function isValidPhrase(phrase: Phrase): boolean {
  return phrase.bars.length > 0 && phraseRhythms(phrase).every(isValidRhythm)
}

/* -------------------------------------------------------------------- keys

   The storable form. Bars are separated by a pipe, impacts within a bar by a
   comma — the same comma `onsetsKey` already uses, so a one-bar phrase reads
   exactly like the rhythm it is. */

const BAR_SEPARATOR = '|'

/** `0,60,120|0,90` — two bars, four impacts. */
export function phraseKey(phrase: Phrase): string {
  return phrase.bars.map((onsets) => onsets.join(',')).join(BAR_SEPARATOR)
}

/**
 * Read a phrase's impacts back.
 *
 * `undefined` for anything malformed, so a hand-edited row loses its derived
 * facets rather than throwing inside a statistics query. An empty bar is
 * legal — a phrase may hold a bar of silence in the middle of it — but a bar
 * whose impacts are out of order or negative is not.
 */
export function parsePhraseBars(key: string): (readonly number[])[] | undefined {
  const bars = key.split(BAR_SEPARATOR).map((bar) => {
    if (bar === '') return []

    const onsets = bar.split(',').map(Number)
    const usable = onsets.every(
      (tick, index) =>
        Number.isInteger(tick) &&
        tick >= 0 &&
        (index === 0 || tick > (onsets[index - 1] ?? 0)),
    )
    return usable ? onsets : undefined
  })

  return bars.every((bar): bar is number[] => bar !== undefined) ? bars : undefined
}

export function parsePhrase(key: string, meter: TimeSignature): Phrase | undefined {
  const bars = parsePhraseBars(key)
  if (bars === undefined) return undefined

  const phrase: Phrase = { meter, bars }
  return isValidPhrase(phrase) ? phrase : undefined
}

/**
 * Whether the phrase opens on its downbeat.
 *
 * Melodic dictation shows the first note, so the phrase has to have one to
 * show: beat one of bar one is always struck. Checked rather than assumed,
 * because a phrase that opened in silence would leave the given note nowhere
 * to sit and the draft with nothing to lock.
 */
export function opensOnDownbeat(phrase: Phrase): boolean {
  return phrase.bars[0]?.[0] === 0
}

/** Which beat of its own bar a phrase tick falls on, for the metric rules. */
export function beatInBar(phrase: Phrase, tick: number): number {
  const perBar = ticksPerMeasure(phrase.meter)
  return Math.floor((tick % perBar) / TICKS_PER_BEAT)
}
