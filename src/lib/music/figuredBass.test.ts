import { describe, expect, it } from 'vitest'

import {
  canonicalFigures,
  expandFigure,
  figureKey,
  figurePitches,
  isCanonical,
  parseFigureKey,
  preferredFigure,
  type Figure,
  type FigureAccidental,
} from './figuredBass'
import { KEY_SIGNATURES, type KeySignatureId } from './keySignature'
import { LETTERS, pitch, type Alteration, type Letter } from './pitch'
import { sameNotes, tonicKey, type PitchClass } from './scale'

const KEYS: readonly KeySignatureId[] = KEY_SIGNATURES.map((signature) => signature.id)

/** Every bass a question could stand on: each letter, natural or single accidental. */
const BASSES = LETTERS.flatMap((letter: Letter) =>
  ([-1, 0, 1] as const).map((alteration: Alteration) => pitch(letter, alteration, 3)),
)

const spell = (found: readonly PitchClass[] | undefined) =>
  found === undefined ? undefined : found.map(tonicKey).join(' ')

const figure = (key: string): Figure => parseFigureKey(key) as Figure

/** Every figure the app teaches, before accidentals are put on them. */
const V1_FIGURES = ['', '6', '6/4', '7', '6/5', '4/3', '2', '4/2', '9', '9/7']

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
    // A bare 9 is a ninth over a plain triad; 9/7 is the ninth chord itself,
    // "taken by direct percussion".
    expect(expanded('9')).toBe('9/5/3')
    expect(expanded('9/7')).toBe('9/7/5/3')
    // The compound figures are written out in full: there is nothing in them
    // the convention takes for granted.
    expect(expanded('7/4/2')).toBe('7/4/2')
    expect(expanded('7/6/4')).toBe('7/6/4')
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
    expect(shortest(pitch('C', 0, 3), '0', '9')).toBe('9')
    expect(shortest(pitch('G', 0, 3), '0', '9/7')).toBe('9/7')
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
    // Over two thousand figures resolved and read back, which runs a few
    // seconds on a quiet machine and past the default timeout on a busy one.
    // The property is worth the seconds; failing on load is not.
  }, 30_000)

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

describe('a figure that follows another on the same bass', () => {
  const notesOf = (
    bass: ReturnType<typeof pitch>,
    key: KeySignatureId,
    written: string,
  ) => figurePitches(bass, key, figure(written)) ?? []

  it('writes only the lines that moved', () => {
    // **How a suspension is figured.** `4 3` is 5/4 then 5/3, and the second
    // is written `3` because the 5 did not go anywhere. Without this the
    // resolution would have to be written as an unfigured bass, which is not
    // something a dash can be followed by.
    const bass = pitch('G', 0, 3)
    const held = notesOf(bass, '0', '4')
    const resolved = notesOf(bass, '0', '')

    expect(
      figureKey(preferredFigure(bass, '0', resolved, { previous: held }) as Figure),
    ).toBe('3')
  })

  it('does the same for the other suspensions that keep one bass note', () => {
    const bass = pitch('C', 0, 3)
    const move = (from: string, to: string) =>
      figureKey(
        preferredFigure(bass, '0', notesOf(bass, '0', to), {
          previous: notesOf(bass, '0', from),
        }) as Figure,
      )

    expect(move('7', '6')).toBe('6')
    expect(move('9', '8')).toBe('8')
    expect(move('6', '5')).toBe('5')
  })

  it('still accepts the ordinary spellings alongside it', () => {
    // Writing the resolution out in full is what Grove allows after another
    // harmony on the same bass; the short form is only what gets *printed*.
    const bass = pitch('G', 0, 3)
    const held = notesOf(bass, '0', '4')
    const resolved = notesOf(bass, '0', '')
    const accepted = canonicalFigures(bass, '0', resolved, {
      previous: held,
      afterAnother: true,
    }).map(figureKey)

    expect(accepted).toContain('3')
    expect(accepted).toContain('5/3')
    expect(accepted).toContain('')
  })

  it('reads a bare 4 as a suspended fourth, not as a six-four', () => {
    // "4 3 is always understood to mean 5/4 then 5/3 … in contradistinction to
    // 6/4 then 5/3."
    expect((expandFigure(figure('4')) as Figure).signs.map((s) => s.number)).toEqual([
      5, 4,
    ])
    expect((expandFigure(figure('6/4')) as Figure).signs.map((s) => s.number)).toEqual([
      6, 4,
    ])
  })
})

describe('the compound figures, and the ones that cannot be told apart', () => {
  const notesOf = (written: string, key: KeySignatureId = '0') =>
    figurePitches(pitch('C', 0, 3), key, figure(written)) ?? []

  it('resolves an eleventh and a thirteenth as Grove figures them', () => {
    // "7/4/2 and 9/7/4" for the eleventh; "7/6/4 … " for the thirteenth.
    expect(spell(notesOf('7/4/2'))).toBe('B F D')
    expect(spell(notesOf('7/6/4'))).toBe('B A F')
  })

  it('offers one spelling of each, because a number names a letter', () => {
    // **9 and 2 name the same letter**, so `7/4/2` and `9/7/4` are the same
    // three notes differing only in which octave the second is written in —
    // and register is exactly what a figure does not say. Offering both would
    // make a chord that two canonical figures answer, which is a question with
    // two right answers and one of them marked wrong.
    //
    // The way that is enforced is simply that no stack holds the second
    // spelling, so it cannot be expanded and therefore cannot be asked for.
    const ninth = notesOf('9').find((note) => note.letter === 'D')
    const second = notesOf('2').find((note) => note.letter === 'D')
    expect(ninth).toBeDefined()
    expect(second).toEqual(ninth)

    expect(expandFigure(figure('9/7/4'))).toBeUndefined()
    expect(expandFigure(figure('7/6/4/2'))).toBeUndefined()
  })

  it('can read a historical numeral and has no chord to give for it', () => {
    // `10`–`14` mean reduplication in the octave above, so a `13` names the
    // same letter as a `6` and a `10` the same letter as a `3`. They are a
    // reading convention rather than something that can be graded: the guide
    // says so, and the model refuses them rather than inventing a sonority.
    for (const key of ['10', '11', '12', '13', '14']) {
      expect(parseFigureKey(key), key).toBeDefined()
      expect(expandFigure(figure(key)), key).toBeUndefined()
    }
  })
})
