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
}

/**
 * Key names are translated, not stored: German writes B♭ major as "B-Dur"
 * and B major as "H-Dur", so a hardcoded letter here would be wrong for half
 * the audience. See `useMusicNames`.
 */

/** Sharps are always added in this order, flats in the reverse. */
const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

export const KEY_SIGNATURES: readonly KeySignatureDef[] = [
  { id: '7f', count: 7, kind: 'flat' },
  { id: '6f', count: 6, kind: 'flat' },
  { id: '5f', count: 5, kind: 'flat' },
  { id: '4f', count: 4, kind: 'flat' },
  { id: '3f', count: 3, kind: 'flat' },
  { id: '2f', count: 2, kind: 'flat' },
  { id: '1f', count: 1, kind: 'flat' },
  { id: '0', count: 0, kind: 'natural' },
  { id: '1s', count: 1, kind: 'sharp' },
  { id: '2s', count: 2, kind: 'sharp' },
  { id: '3s', count: 3, kind: 'sharp' },
  { id: '4s', count: 4, kind: 'sharp' },
  { id: '5s', count: 5, kind: 'sharp' },
  { id: '6s', count: 6, kind: 'sharp' },
  { id: '7s', count: 7, kind: 'sharp' },
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
