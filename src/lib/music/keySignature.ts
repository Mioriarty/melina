import type { Alteration, Letter } from './pitch'

/**
 * Key signatures.
 *
 * These exist here for *engraving*, not for choosing notes: the generator is
 * free to pick any spelling, and the signature only decides whether a given
 * accidental has to be printed. In D major an F sharp needs no accidental
 * because the signature already says so, while an F natural needs a printed
 * natural sign. Getting that backwards produces notation that reads cleanly
 * and says the wrong thing, which no type checker will catch.
 */

export type KeySignatureId =
  | '0'
  | '1s'
  | '2s'
  | '3s'
  | '4s'
  | '5s'
  | '6s'
  | '7s'
  | '1f'
  | '2f'
  | '3f'
  | '4f'
  | '5f'
  | '6f'
  | '7f'

export interface KeySignatureDef {
  id: KeySignatureId
  /** How many accidentals, and which kind. */
  count: number
  kind: 'sharp' | 'flat' | 'natural'
  /** Major and relative minor key names, for the settings UI. */
  major: string
  minor: string
}

/** Sharps are always added in this order, flats in the reverse. */
const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

export const KEY_SIGNATURES: readonly KeySignatureDef[] = [
  { id: '7f', count: 7, kind: 'flat', major: 'C♭', minor: 'A♭m' },
  { id: '6f', count: 6, kind: 'flat', major: 'G♭', minor: 'E♭m' },
  { id: '5f', count: 5, kind: 'flat', major: 'D♭', minor: 'B♭m' },
  { id: '4f', count: 4, kind: 'flat', major: 'A♭', minor: 'Fm' },
  { id: '3f', count: 3, kind: 'flat', major: 'E♭', minor: 'Cm' },
  { id: '2f', count: 2, kind: 'flat', major: 'B♭', minor: 'Gm' },
  { id: '1f', count: 1, kind: 'flat', major: 'F', minor: 'Dm' },
  { id: '0', count: 0, kind: 'natural', major: 'C', minor: 'Am' },
  { id: '1s', count: 1, kind: 'sharp', major: 'G', minor: 'Em' },
  { id: '2s', count: 2, kind: 'sharp', major: 'D', minor: 'Bm' },
  { id: '3s', count: 3, kind: 'sharp', major: 'A', minor: 'F♯m' },
  { id: '4s', count: 4, kind: 'sharp', major: 'E', minor: 'C♯m' },
  { id: '5s', count: 5, kind: 'sharp', major: 'B', minor: 'G♯m' },
  { id: '6s', count: 6, kind: 'sharp', major: 'F♯', minor: 'D♯m' },
  { id: '7s', count: 7, kind: 'sharp', major: 'C♯', minor: 'A♯m' },
]

export const DEFAULT_KEY_SIGNATURE_IDS: readonly KeySignatureId[] = ['0']

export function getKeySignature(id: KeySignatureId): KeySignatureDef {
  const signature = KEY_SIGNATURES.find((entry) => entry.id === id)
  if (signature === undefined) throw new Error(`unknown key signature: ${id}`)
  return signature
}

export function isKeySignatureId(value: string): value is KeySignatureId {
  return KEY_SIGNATURES.some((signature) => signature.id === value)
}

/** The letters the signature alters, in the order they are written. */
export function alteredLetters(id: KeySignatureId): readonly Letter[] {
  const signature = getKeySignature(id)
  const order = signature.kind === 'flat' ? FLAT_ORDER : SHARP_ORDER
  return order.slice(0, signature.count)
}

/**
 * The alteration this signature already applies to a letter. A note whose
 * alteration equals this needs no printed accidental; anything else does.
 */
export function alterationInKey(letter: Letter, id: KeySignatureId): Alteration {
  const signature = getKeySignature(id)
  if (!alteredLetters(id).includes(letter)) return 0
  return signature.kind === 'flat' ? -1 : 1
}

/** MEI's `@keysig` value, which happens to match our ids apart from zero. */
export function meiKeySignature(id: KeySignatureId): string {
  return id === '0' ? '0' : id
}
