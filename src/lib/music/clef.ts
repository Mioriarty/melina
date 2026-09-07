import { parsePitch, type Pitch } from './pitch'

/**
 * Clefs, with the pitch range each one can show comfortably.
 *
 * The ranges matter as much as the glyphs: generating a question without them
 * produces notes stranded five ledger lines above the staff, which tests
 * counting lines rather than reading intervals. Each range is roughly the
 * staff itself plus two ledger lines either side.
 */

export type ClefId = 'treble' | 'bass' | 'alto' | 'tenor'

export interface ClefDef {
  id: ClefId
  label: string
  /** MEI clef shape and the staff line it sits on, counting from the bottom. */
  sign: 'G' | 'F' | 'C'
  line: number
  /** Lowest and highest pitch to place a note on, inclusive. */
  lowest: Pitch
  highest: Pitch
}

function required(text: string): Pitch {
  const value = parsePitch(text)
  if (value === undefined) throw new Error(`invalid clef range pitch: ${text}`)
  return value
}

export const CLEFS: readonly ClefDef[] = [
  {
    id: 'treble',
    label: 'Treble',
    sign: 'G',
    line: 2,
    // Staff runs E4-F5; two ledger lines either way.
    lowest: required('A3'),
    highest: required('C6'),
  },
  {
    id: 'bass',
    label: 'Bass',
    sign: 'F',
    line: 4,
    // Staff runs G2-A3.
    lowest: required('C2'),
    highest: required('E4'),
  },
  {
    id: 'alto',
    label: 'Alto',
    sign: 'C',
    line: 3,
    // Staff runs F3-G4.
    lowest: required('B2'),
    highest: required('C5'),
  },
  {
    id: 'tenor',
    label: 'Tenor',
    sign: 'C',
    line: 4,
    // Staff runs D3-E4.
    lowest: required('G2'),
    highest: required('A4'),
  },
]

export const DEFAULT_CLEF_IDS: readonly ClefId[] = ['treble', 'bass']

export function getClef(id: ClefId): ClefDef {
  const clef = CLEFS.find((entry) => entry.id === id)
  if (clef === undefined) throw new Error(`unknown clef: ${id}`)
  return clef
}

export function isClefId(value: string): value is ClefId {
  return CLEFS.some((clef) => clef.id === value)
}
