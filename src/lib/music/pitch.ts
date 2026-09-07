/**
 * A pitch is a *spelling*, not a frequency.
 *
 * C sharp and D flat are the same key on a piano and different pitches here,
 * because every distinction melina teaches — a diminished second against a
 * perfect unison, an augmented fourth against a diminished fifth — lives in
 * the spelling and vanishes the moment you collapse to semitones.
 *
 * Two independent axes carry that: the diatonic axis (which letter, which
 * octave) and the chromatic axis (how many semitones). Keeping both is what
 * makes the hard cases fall out of the arithmetic instead of needing special
 * cases.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

export type Letter = (typeof LETTERS)[number]

/** Semitones above C for each natural letter. */
const NATURAL_SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const LETTER_INDEX: Record<Letter, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
}

/**
 * Double flat through double sharp. Notation beyond this exists but is
 * vanishingly rare, and refusing to spell it is how the question generator
 * knows to pick a different starting note.
 */
export type Alteration = -2 | -1 | 0 | 1 | 2

export const MIN_ALTERATION = -2
export const MAX_ALTERATION = 2

export interface Pitch {
  letter: Letter
  alteration: Alteration
  /** Scientific pitch notation: middle C is C4. */
  octave: number
}

export function pitch(letter: Letter, alteration: Alteration, octave: number): Pitch {
  return { letter, alteration, octave }
}

/**
 * Position on the diatonic ladder, counting only letter names.
 * C4 and C#4 share a value; C4 and Dbb4 do not.
 */
export function diatonicValue(value: Pitch): number {
  return LETTER_INDEX[value.letter] + 7 * value.octave
}

/**
 * Position in semitones. C4 and B#3 share a value; they are the same sound
 * spelled differently.
 */
export function chromaticValue(value: Pitch): number {
  return NATURAL_SEMITONES[value.letter] + value.alteration + 12 * value.octave
}

/** MIDI note number, where middle C (C4) is 60. */
export function midiNumber(value: Pitch): number {
  return chromaticValue(value) + 12
}

export function letterFromDiatonicValue(value: number): Letter {
  // Modulo that stays positive for pitches below C0.
  const index = ((value % 7) + 7) % 7
  return LETTERS[index] as Letter
}

export function octaveFromDiatonicValue(value: number): number {
  return Math.floor(value / 7)
}

const ALTERATION_SYMBOLS: Record<Alteration, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
}

/** Machine form: `F#4`, `Ebb3`, `C4`. Round-trips through `parsePitch`. */
export function pitchKey(value: Pitch): string {
  return `${value.letter}${ALTERATION_SYMBOLS[value.alteration]}${value.octave}`
}

/**
 * There is deliberately no display or spoken form here. German calls B "H"
 * and a sharp "Kreuz", so a pitch reads differently in every language and
 * its name belongs in the `music` translation namespace — see
 * `useMusicNames`.
 */

const PITCH_PATTERN = /^([A-G])(bb|b|#|##|)(-?\d+)$/

export function parsePitch(text: string): Pitch | undefined {
  const match = PITCH_PATTERN.exec(text.trim())
  if (match === null) return undefined

  const [, letter, symbol, octave] = match
  const alteration = (Object.entries(ALTERATION_SYMBOLS) as [string, string][]).find(
    ([, value]) => value === symbol,
  )?.[0]

  if (letter === undefined || alteration === undefined || octave === undefined) {
    return undefined
  }

  return {
    letter: letter as Letter,
    alteration: Number(alteration) as Alteration,
    octave: Number(octave),
  }
}

export function pitchesEqual(a: Pitch, b: Pitch): boolean {
  return a.letter === b.letter && a.alteration === b.alteration && a.octave === b.octave
}

/** Ordering by sound, then by spelling, so sorts are stable. */
export function comparePitch(a: Pitch, b: Pitch): number {
  return chromaticValue(a) - chromaticValue(b) || diatonicValue(a) - diatonicValue(b)
}

export function isAlteration(value: number): value is Alteration {
  return Number.isInteger(value) && value >= MIN_ALTERATION && value <= MAX_ALTERATION
}
