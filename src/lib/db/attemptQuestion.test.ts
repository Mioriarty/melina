import { describe, expect, it } from 'vitest'

import { attemptFacets, correctAnswer } from './attemptQuestion'

/**
 * The derived half of an attempt.
 *
 * What a row stores is checked by the round-trip tests beside each exercise;
 * what it *implies* is checked here. A facet that is wrong is worse than one
 * that is missing, because it silently moves answers into and out of other
 * people's statistics.
 */

describe('interval facets', () => {
  it('derives the upper note rather than trusting a stored one', () => {
    // C4 plus an augmented fourth is F♯4 — the spelling, not "the tritone".
    expect(
      attemptFacets({
        kind: 'interval',
        lower: 'C4',
        interval: 'A4',
        clef: 'treble',
        keySignature: '0',
        direction: 'ascending',
      }),
    ).toMatchObject({ lower: 'C4', upper: 'F#4', root: 'C' })
  })

  it('keeps the root free of its octave, so it can be asked across clefs', () => {
    expect(
      attemptFacets({
        kind: 'interval',
        lower: 'Eb2',
        interval: 'm3',
        clef: 'bass',
        keySignature: '3f',
        direction: 'harmonic',
      }),
    ).toMatchObject({ root: 'Eb', upper: 'Gb2' })
  })

  it('works out whether the question needed ledger lines', () => {
    // The treble staff runs E4 to F5. A fifth from G4 sits inside it; the
    // same fifth from A3 hangs two ledger lines below.
    const onStaff = attemptFacets({
      kind: 'interval',
      lower: 'G4',
      interval: 'P5',
      clef: 'treble',
      keySignature: '0',
      direction: 'harmonic',
    })
    const below = attemptFacets({
      kind: 'interval',
      lower: 'A3',
      interval: 'P5',
      clef: 'treble',
      keySignature: '0',
      direction: 'harmonic',
    })

    expect(onStaff.staffOnly).toBe(true)
    expect(below.staffOnly).toBe(false)
  })

  it('survives a row it cannot spell', () => {
    // A statistics query must never throw over one unreadable row. It simply
    // matches nothing that asks about the notes.
    const facets = attemptFacets({
      kind: 'interval',
      lower: 'H9',
      interval: 'nonsense',
      clef: 'treble',
      keySignature: '0',
      direction: 'harmonic',
    })

    expect(facets.upper).toBeUndefined()
    expect(facets.staffOnly).toBeUndefined()
    expect(facets.clef).toBe('treble')
  })
})

describe('scale facets', () => {
  it('separates the tonic from the root, so a level can ignore the octave', () => {
    const facets = attemptFacets({
      kind: 'scale',
      tonic: 'Bb3',
      mode: 'dorian',
      clef: 'bass',
      direction: 'ascending',
    })

    expect(facets).toMatchObject({ tonic: 'Bb3', root: 'Bb', mode: 'dorian' })
  })

  it('survives a mode that no longer exists', () => {
    const facets = attemptFacets({
      kind: 'scale',
      tonic: 'C4',
      // A row written before a mode was renamed. It still says what it said.
      mode: 'hypolydian' as 'dorian',
      clef: 'treble',
      direction: 'ascending',
    })

    expect(facets.staffOnly).toBeUndefined()
    expect(facets.mode).toBe('hypolydian')
  })
})

describe('correctAnswer', () => {
  it('is derived from the question, so it can never disagree with it', () => {
    expect(
      correctAnswer({
        kind: 'interval',
        lower: 'C4',
        interval: 'M6',
        clef: 'treble',
        keySignature: '0',
        direction: 'ascending',
      }),
    ).toBe('M6')

    expect(
      correctAnswer({
        kind: 'scale',
        tonic: 'C4',
        mode: 'locrian',
        clef: 'treble',
        direction: 'ascending',
      }),
    ).toBe('locrian')
  })
})
