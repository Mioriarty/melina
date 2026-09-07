import { describe, expect, it } from 'vitest'

import {
  KEY_SIGNATURES,
  alterationInKey,
  alteredLetters,
  getKeySignature,
  isKeySignatureId,
} from './keySignature'
import { LETTERS } from './pitch'

describe('key signatures', () => {
  it('covers all fifteen signatures', () => {
    expect(KEY_SIGNATURES).toHaveLength(15)
    expect(new Set(KEY_SIGNATURES.map((s) => s.id)).size).toBe(15)
  })

  it('adds sharps in the order F C G D A E B', () => {
    expect(alteredLetters('1s')).toEqual(['F'])
    expect(alteredLetters('3s')).toEqual(['F', 'C', 'G'])
    expect(alteredLetters('7s')).toEqual(['F', 'C', 'G', 'D', 'A', 'E', 'B'])
  })

  it('adds flats in the reverse order B E A D G C F', () => {
    expect(alteredLetters('1f')).toEqual(['B'])
    expect(alteredLetters('3f')).toEqual(['B', 'E', 'A'])
    expect(alteredLetters('7f')).toEqual(['B', 'E', 'A', 'D', 'G', 'C', 'F'])
  })

  it('alters exactly as many letters as it claims', () => {
    for (const signature of KEY_SIGNATURES) {
      expect(alteredLetters(signature.id), signature.id).toHaveLength(signature.count)
    }
  })

  it('reports the alteration each signature applies, for every letter', () => {
    for (const signature of KEY_SIGNATURES) {
      const altered = alteredLetters(signature.id)
      for (const letter of LETTERS) {
        const expected = altered.includes(letter)
          ? signature.kind === 'flat'
            ? -1
            : 1
          : 0
        expect(
          alterationInKey(letter, signature.id),
          `${letter} in ${signature.id}`,
        ).toBe(expected)
      }
    }
  })

  it('alters nothing in C major', () => {
    for (const letter of LETTERS) {
      expect(alterationInKey(letter, '0')).toBe(0)
    }
  })

  it('alters everything in the seven-accidental keys', () => {
    for (const letter of LETTERS) {
      expect(alterationInKey(letter, '7s')).toBe(1)
      expect(alterationInKey(letter, '7f')).toBe(-1)
    }
  })

  it('names the relative major and minor', () => {
    expect(getKeySignature('2s').major).toBe('D')
    expect(getKeySignature('2s').minor).toBe('Bm')
    expect(getKeySignature('0').major).toBe('C')
  })

  it('validates ids', () => {
    expect(isKeySignatureId('3f')).toBe(true)
    expect(isKeySignatureId('8s')).toBe(false)
  })
})
