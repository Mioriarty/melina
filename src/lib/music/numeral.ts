import { chordNotes, chordSize, type ChordQuality } from './chord'
import {
  appliedKey,
  eventChord,
  specChord,
  type ChordSpec,
  type HarmonicEvent,
} from './harmony'
import { isMinor, type Key } from './key'
import { chromaticValue } from './pitch'
import type { PitchClass } from './scale'

/**
 * A chord as a player names it: a step of the key, and what is done to it.
 *
 * The answer vocabulary of Stufen dictation, and deliberately **a name rather
 * than a spelling**. It resolves to notes through `specChord` — the same
 * function the generator builds its chords with — so a name means exactly the
 * chord the app would have built from it, and grading compares *sounds*:
 * `V7/III` and `VII7` in natural minor are one chord under two readings, and
 * a player who hears it has heard it whichever they press.
 *
 * Every field but `degree` is something a key or a switch on the keyboard
 * adds:
 *
 * - `plain` — the natural minor's own chord where the key ordinarily raises
 *   the leading note: `v` rather than `V`, `VII` rather than `vii°`. A
 *   sequence stays in the mode, so the generator produces both.
 * - `neapolitan` — `♭II`, the one altered root the vocabulary has.
 * - `of` — an applied dominant: `{ degree: 5, of: 2 }` is `V/ii`.
 * - `seventh`, `inversion` — as named.
 */
export interface Numeral {
  /** 1 to 7. For an applied chord, always 5: the dominant *of* `of`. */
  degree: number
  plain?: true
  neapolitan?: true
  of?: number
  seventh?: true
  /** 0 to 3; 0 on a level that does not ask for it. */
  inversion: number
}

/**
 * The chord keys a key offers, in root position and without a seventh.
 *
 * Minor has two more than major, because the natural and the raised
 * seventh degree both occur: a cadence raises it and a sequence does not.
 */
export function numeralChoices(key: Key): readonly Numeral[] {
  const neapolitan: Numeral = { degree: 2, neapolitan: true, inversion: 0 }

  if (!isMinor(key)) {
    return [1, 2, 3, 4, 5, 6, 7]
      .map((degree): Numeral => ({ degree, inversion: 0 }))
      .concat(neapolitan)
  }

  return [
    { degree: 1, inversion: 0 },
    { degree: 2, inversion: 0 },
    { degree: 3, inversion: 0 },
    { degree: 4, inversion: 0 },
    { degree: 5, plain: true, inversion: 0 },
    { degree: 5, inversion: 0 },
    { degree: 6, inversion: 0 },
    { degree: 7, plain: true, inversion: 0 },
    { degree: 7, inversion: 0 },
    neapolitan,
  ]
}

/** The same numeral as a spec the harmony model can build. */
export function numeralSpec(numeral: Numeral): ChordSpec {
  const base = {
    inversion: numeral.inversion,
    beats: 1,
    ...(numeral.seventh === true ? { seventh: true } : {}),
  }

  if (numeral.of !== undefined) return { ...base, degree: 5, of: numeral.of }
  if (numeral.neapolitan === true) {
    return { ...base, degree: 2, alteration: -1, quality: 'major' }
  }
  return {
    ...base,
    degree: numeral.degree,
    ...(numeral.plain === true ? { plain: true } : {}),
  }
}

/**
 * Whether a numeral names a chord at all.
 *
 * An applied dominant needs a region to be the dominant *of* — a major or
 * minor triad, never the tonic itself, whose dominant is just `V` — and the
 * Neapolitan has no seventh here.
 */
export function isNumeral(key: Key, numeral: Numeral): boolean {
  if (numeral.of !== undefined) {
    if (numeral.of === 1 || appliedKey(key, numeral.of) === undefined) return false
  }
  if (numeral.neapolitan === true && numeral.seventh === true) return false

  const chord = numeralChord(key, numeral)
  return chord !== undefined && numeral.inversion < chordSize(chord.quality)
}

/** The chord a numeral names, spelled. */
export function numeralChord(
  key: Key,
  numeral: Numeral,
): { root: PitchClass; quality: ChordQuality } | undefined {
  return specChord(key, numeralSpec(numeral))
}

function pitchClassOf(note: PitchClass): number {
  return ((chromaticValue({ ...note, octave: 4 }) % 12) + 12) % 12
}

function soundOf(
  root: PitchClass,
  quality: ChordQuality,
  inversion: number,
): { notes: ReadonlySet<number>; bass: number } | undefined {
  const notes = chordNotes(root, quality)
  const bass = notes?.[inversion]
  if (notes === undefined || bass === undefined) return undefined
  return { notes: new Set(notes.map(pitchClassOf)), bass: pitchClassOf(bass) }
}

/**
 * Whether a numeral names the chord an event sounds.
 *
 * **By sound**: the same pitch classes, and — where the inversion is asked —
 * the same one in the bass. Two readings of one chord are both right, and a
 * spelling nobody can hear is never what is being graded.
 */
export function namesChord(
  key: Key,
  numeral: Numeral,
  event: HarmonicEvent,
  withInversion: boolean,
): boolean {
  const heard = eventChord(event)
  const named = numeralChord(key, numeral)
  if (heard === undefined || named === undefined) return false
  if (!isNumeral(key, numeral)) return false

  const a = soundOf(heard.root, heard.quality, heard.inversion)
  const b = soundOf(named.root, named.quality, withInversion ? numeral.inversion : 0)
  if (a === undefined || b === undefined) return false

  if (a.notes.size !== b.notes.size) return false
  for (const note of a.notes) if (!b.notes.has(note)) return false

  return !withInversion || a.bass === b.bass
}

/**
 * Every numeral the keyboard can type in this key, plainest first.
 *
 * Diatonic before applied, triads before sevenths, root position first — so
 * where one chord has two names, the one found is the one a textbook would
 * write: `VII7` in natural minor rather than `V7/III`.
 */
export function typeableNumerals(key: Key): readonly Numeral[] {
  const found: Numeral[] = []
  const add = (numeral: Numeral) => {
    if (isNumeral(key, numeral)) found.push(numeral)
  }

  for (const seventh of [false, true]) {
    for (const choice of numeralChoices(key)) {
      for (let inversion = 0; inversion < 4; inversion += 1) {
        add({ ...choice, inversion, ...(seventh ? { seventh: true } : {}) })
      }
    }
  }
  for (const seventh of [false, true]) {
    for (let of = 2; of <= 7; of += 1) {
      for (let inversion = 0; inversion < 4; inversion += 1) {
        add({ degree: 5, of, inversion, ...(seventh ? { seventh: true } : {}) })
      }
    }
  }

  return found
}

/**
 * The name the keyboard would give a chord it heard, or `undefined` if the
 * keyboard cannot name it.
 *
 * Found by searching what can be typed rather than by reading the chord, which
 * is the point: the answer is defined by the same `namesChord` that grades it,
 * so a question can never want a name the keyboard does not have. A test holds
 * every generated chord to having one.
 */
export function numeralOf(
  key: Key,
  event: HarmonicEvent,
  withInversion: boolean,
): Numeral | undefined {
  const found = typeableNumerals(key).find((numeral) =>
    namesChord(key, numeral, event, withInversion),
  )
  if (found === undefined) return undefined
  return withInversion ? found : { ...found, inversion: 0 }
}

/**
 * The chord each bass note carries — what a player names, one per bass note.
 *
 * **A suspension is named by what it resolves to.** The cadential six-four
 * reads as a second-inversion tonic if you only look at its notes, but the
 * harmony is a dominant with two lines hanging over it, which is how
 * Funktionstheorie reads it and how the analysis rows under a setting label it
 * (`analysis.ts`). So a held bass contributes the *last* sonority over it.
 */
export function bassNoteEvents(
  events: readonly HarmonicEvent[],
): readonly HarmonicEvent[] {
  const chords: HarmonicEvent[] = []
  for (const event of events) {
    if (event.held === true && chords.length > 0) chords[chords.length - 1] = event
    else chords.push(event)
  }
  return chords
}

/** A whole progression's names, one per bass note — what Stufen dictation asks. */
export function progressionNumerals(
  key: Key,
  events: readonly HarmonicEvent[],
  withInversion: boolean,
): readonly Numeral[] | undefined {
  const numerals: Numeral[] = []
  for (const event of bassNoteEvents(events)) {
    const found = numeralOf(key, event, withInversion)
    if (found === undefined) return undefined
    numerals.push(found)
  }
  return numerals
}

/* ------------------------------------------------------------ stored form */

/**
 * `5`, `5p`, `2n`, `5/2`, with `7` for a seventh and `.1` for an inversion:
 * `5/5-7.1` is V6/5 of V.
 */
export function numeralKey(numeral: Numeral): string {
  const body =
    numeral.of !== undefined
      ? `5/${numeral.of}`
      : `${numeral.degree}${numeral.plain === true ? 'p' : ''}${numeral.neapolitan === true ? 'n' : ''}`
  const seventh = numeral.seventh === true ? '-7' : ''
  const inversion = numeral.inversion > 0 ? `.${numeral.inversion}` : ''
  return `${body}${seventh}${inversion}`
}

export function numeralsKey(numerals: readonly Numeral[]): string {
  return numerals.map(numeralKey).join(',')
}
