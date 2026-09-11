import { describe, expect, it } from 'vitest'

import {
  canonicalFigures,
  expandFigure,
  figureKey,
  figurePitches,
  isCanonical,
  parseFigureKey,
  preferredFigure,
  sameNotes,
  type Figure,
  type FigureAccidental,
} from './figuredBass'
import { KEY_SIGNATURES, type KeySignatureId } from './keySignature'
import { LETTERS, pitch, type Alteration, type Letter } from './pitch'
import { tonicKey, type PitchClass } from './scale'

const KEYS: readonly KeySignatureId[] = KEY_SIGNATURES.map((signature) => signature.id)

/** Every bass a question could stand on: each letter, natural or single accidental. */
const BASSES = LETTERS.flatMap((letter: Letter) =>
  ([-1, 0, 1] as const).map((alteration: Alteration) => pitch(letter, alteration, 3)),
)

const spell = (found: readonly PitchClass[] | undefined) =>
  found === undefined ? undefined : found.map(tonicKey).join(' ')

const figure = (key: string): Figure => parseFigureKey(key) as Figure

/** The figures v1 teaches, before accidentals are put on them. */
const V1_FIGURES = ['', '6', '6/4', '7', '6/5', '4/3', '2', '4/2']

describe('a figure resolves through the key signature', () => {
  it('reads a plain figure as the key spells it', () => {
    // 6 above D in C major is B, and the 3 it takes for granted is F.
    expect(spell(figurePitches(pitch('D', 0, 3), '0', figure('6')))).toBe('B F')
    // An unfigured bass is the common chord: "all Bass-notes unaccompanied by a
    // Figure are intended to bear Common Chords."
    expect(spell(figurePitches(pitch('C', 0, 3), '0', figure('')))).toBe('G E')
  })

  it('takes an accidental a semitone from what the key gives, not absolutely', () => {
    // Grove's own worked example: "With the Signature of G major, and E♭ for a
    // Bass-note … the German by 6/♭5". The fifth above E♭ is B, which G major
    // spells B♮, so ♭5 is B♭ — and not B𝄫, which an absolute reading would give
    // in a flat key.
    expect(spell(figurePitches(pitch('E', -1, 3), '1s', figure('b5/3')))).toBe('Bb G')
    // In a key that already flattens the letter, the same sign goes one further.
    expect(spell(figurePitches(pitch('E', -1, 3), '2f', figure('b5/3')))).toBe('Bbb G')
    // ♮ is the exception: it asks for the natural note whatever the key says.
    expect(spell(figurePitches(pitch('E', -1, 3), '2f', figure('n5/3')))).toBe('B G')
  })

  it('reads a lone accidental as the third', () => {
    // "A ♯, ♭, or ♮ used alone … indicates that the Third of the Chord is to be
    // raised or depressed a Semitone." The raised third of E in A minor is G♯:
    // the dominant, and the commonest figure in the repertoire after 6.
    expect(spell(figurePitches(pitch('E', 0, 3), '0', figure('#3')))).toBe('B G#')
  })

  it('never needs more than a double accidental, whatever is asked of it', () => {
    // Worth pinning because it is not obvious and it is what keeps the whole
    // vocabulary spellable: a key signature alters a letter by at most one, and
    // a figure's sign shifts it by at most one more, so a figured note lands
    // inside the double accidentals by construction. There is no equivalent
    // here of `transpose` returning `undefined` and the generator retrying, and
    // no level can be quietly narrower than it claims.
    for (const key of KEYS) {
      for (const bass of BASSES) {
        for (const written of ['#3', 'b3', 'n3', '#6/3', 'b5/3', '6/b5', '#4/3']) {
          const found = figurePitches(bass, key, figure(written))
          expect(found, `${written} on ${tonicKey(bass)} in ${key}`).toBeDefined()
          for (const note of found ?? []) {
            expect(Math.abs(note.alteration)).toBeLessThanOrEqual(2)
          }
        }
      }
    }
  })
})

describe('the lines a figure leaves out', () => {
  const expanded = (key: string) =>
    (expandFigure(figure(key)) as Figure).signs.map((sign) => sign.number).join('/')

  it('fills in what the convention takes for granted', () => {
    expect(expanded('')).toBe('5/3')
    expect(expanded('6')).toBe('6/3')
    expect(expanded('6/4')).toBe('6/4')
    expect(expanded('7')).toBe('7/5/3')
    expect(expanded('6/5')).toBe('6/5/3')
    expect(expanded('4/3')).toBe('6/4/3')
    expect(expanded('2')).toBe('6/4/2')
    expect(expanded('4/2')).toBe('6/4/2')
  })

  it('keeps the accidental that was written on a line it fills in around', () => {
    const found = expandFigure(figure('#3')) as Figure
    expect(found.signs.map((sign) => `${sign.accidental}${sign.number}`)).toEqual([
      'none5',
      'sharp3',
    ])
  })
})

describe('canonical figuring', () => {
  it('abbreviates, and prints the shortest form', () => {
    const shortest = (
      bass: ReturnType<typeof pitch>,
      key: KeySignatureId,
      from: string,
    ) =>
      figureKey(
        preferredFigure(
          bass,
          key,
          figurePitches(bass, key, figure(from)) ?? [],
        ) as Figure,
      )

    expect(shortest(pitch('C', 0, 3), '0', '')).toBe('')
    expect(shortest(pitch('E', 0, 3), '0', '6')).toBe('6')
    expect(shortest(pitch('G', 0, 3), '0', '6/4')).toBe('6/4')
    expect(shortest(pitch('G', 0, 3), '0', '7')).toBe('7')
    expect(shortest(pitch('B', 0, 3), '0', '6/5')).toBe('6/5')
    expect(shortest(pitch('D', 0, 3), '0', '4/3')).toBe('4/3')
    expect(shortest(pitch('F', 0, 3), '0', '2')).toBe('2')
  })

  it('suppresses the 3 and leaves the accidental standing in its place', () => {
    // "the Figure 3 being always suppressed in modern Thoroughbasses, and the
    // Accidental Sign alone inserted in its place". A plain triad abbreviates
    // to nothing at all, so an altered third leaves only its sign behind.
    const bass = pitch('E', 0, 3)
    const raised = figurePitches(bass, '0', figure('#3')) ?? []
    expect(figureKey(preferredFigure(bass, '0', raised) as Figure)).toBe('#3')
  })

  it('always writes a line that carries an accidental, however short the form', () => {
    // A first inversion whose third is raised cannot abbreviate to a bare 6:
    // the accidental is exactly the thing not taken for granted.
    const bass = pitch('C', 0, 3)
    const found = figurePitches(bass, '0', figure('6/#3')) ?? []
    expect(figureKey(preferredFigure(bass, '0', found) as Figure)).toBe('6/#3')
  })

  it('rejects a line the convention omits, and accepts both current forms of the third inversion', () => {
    const bass = pitch('F', 0, 3)
    const found = figurePitches(bass, '0', figure('2')) ?? []
    expect(isCanonical(bass, '0', found, figure('2'))).toBe(true)
    expect(isCanonical(bass, '0', found, figure('4/2'))).toBe(true)
    expect(isCanonical(bass, '0', found, figure('6/4/2'))).toBe(false)
  })

  it('writes the full form only where it follows another figure on the same bass', () => {
    // "It is only necessary to figure the Common Chord, when it follows some
    // other Harmony, on the same Bass-note." So 5/3 and 6/3 are a mistake under
    // one figure per bass note and correct as the resolution of a suspension —
    // and which it is comes from the question, not from a setting.
    const bass = pitch('C', 0, 3)
    const triad = figurePitches(bass, '0', figure('')) ?? []
    expect(isCanonical(bass, '0', triad, figure('5/3'))).toBe(false)
    expect(isCanonical(bass, '0', triad, figure('5/3'), { afterAnother: true })).toBe(
      true,
    )

    const sixth = figurePitches(pitch('E', 0, 3), '0', figure('6')) ?? []
    expect(isCanonical(pitch('E', 0, 3), '0', sixth, figure('6/3'))).toBe(false)
    expect(
      isCanonical(pitch('E', 0, 3), '0', sixth, figure('6/3'), { afterAnother: true }),
    ).toBe(true)
  })
})

describe('the property that makes figuring answerable', () => {
  /** Every figure v1 can ask, with every accidental it can carry, that spells. */
  function* askable() {
    const accidentals: readonly FigureAccidental[] = ['none', 'sharp', 'flat', 'natural']
    for (const key of KEYS) {
      for (const bass of BASSES) {
        for (const base of V1_FIGURES) {
          const plain = figure(base)
          for (const accidental of accidentals) {
            for (const line of [
              undefined,
              ...plain.signs.map((sign) => sign.number),
              3,
            ]) {
              const signs =
                line === undefined
                  ? plain.signs
                  : [
                      ...plain.signs.filter((sign) => sign.number !== line),
                      { number: line, accidental },
                    ]
              const written: Figure = { signs }
              const found = figurePitches(bass, key, written)
              if (found === undefined) continue
              yield { key, bass, written, found }
            }
          }
        }
      }
    }
  }

  it('reads every figure it can ask back to the figure that asked it', () => {
    // The same trick `modeOf` plays on the scale generator: the generator is
    // checked against the model rather than against a fixture somebody typed.
    let checked = 0
    for (const { key, bass, written, found } of askable()) {
      const canonical = canonicalFigures(bass, key, found)
      expect(
        canonical.length,
        `${figureKey(written)} on ${tonicKey(bass)} in ${key}`,
      ).toBeGreaterThan(0)
      for (const form of canonical) {
        expect(
          sameNotes(figurePitches(bass, key, form) ?? [], found),
          `${figureKey(form)} on ${tonicKey(bass)} in ${key}`,
        ).toBe(true)
      }
      checked += 1
    }
    expect(checked).toBeGreaterThan(2000)
  })

  it('never lets one written figure stand for two different chords on the same bass', () => {
    // **This is the whole of being answerable.** Under canonical-required
    // grading, a chord that admits two figurings is a question with two right
    // answers and one of them marked wrong — the same failure `catalog.test.ts`
    // guards against for hearable intervals, and it must be a property rather
    // than a list so a well-meant addition fails loudly.
    //
    // Spelling is what makes it hold: ♯5 over C is G♯ and ♭6 is A♭, one sound
    // under two written notes, and the staff says which.
    const seen = new Map<string, string>()
    for (const { key, bass, found } of askable()) {
      const chord = [...found].map(tonicKey).sort().join(' ')
      for (const form of canonicalFigures(bass, key, found)) {
        const id = `${key}|${tonicKey(bass)}|${figureKey(form)}`
        const already = seen.get(id)
        if (already === undefined) seen.set(id, chord)
        else expect(already, `${id} names two chords`).toBe(chord)
      }
    }
    expect(seen.size).toBeGreaterThan(1000)
  })
})

describe('the stored form', () => {
  it('reads back exactly what wrote it', () => {
    for (const key of [
      '',
      '6',
      '6/4',
      '7',
      '6/5',
      '4/3',
      '2',
      '#3',
      'b5/3',
      '6/#3',
      'n5/3',
    ]) {
      expect(figureKey(parseFigureKey(key) as Figure), key).toBe(key)
    }
  })

  it('sorts a column highest-first however it was written', () => {
    expect(figureKey(figure('3/5'))).toBe('5/3')
    expect(figureKey(figure('2/4'))).toBe('4/2')
  })

  it('refuses a key it cannot read rather than guessing', () => {
    for (const key of ['x', '6//4', '##3', '1', '15', '6/6', 'b']) {
      expect(parseFigureKey(key), key).toBeUndefined()
    }
  })
})
