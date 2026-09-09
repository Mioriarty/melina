import { describe, expect, it } from 'vitest'

import {
  attemptFacets,
  correctAnswer,
  type DegreeAttempt,
  type RhythmAttempt,
} from './attemptQuestion'

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

describe('a rhythm question', () => {
  const bar: RhythmAttempt = {
    kind: 'rhythm',
    meter: '4/4',
    onsets: '0,60,90,120',
    tempo: 80,
  }

  it('answers with the impacts, which is the whole of what was asked', () => {
    expect(correctAnswer(bar)).toBe('0,60,90,120')
  })

  it('works out how hard it was rather than storing it', () => {
    const facets = attemptFacets(bar)

    expect(facets.kind).toBe('rhythm')
    expect(facets.meter).toBe('4/4')
    expect(facets.division).toBe('eighth')
    expect(facets.offBeat).toBe(true)
    expect(facets.impacts).toBe('4')
  })

  it('calls a bar of plain beats what it is', () => {
    const facets = attemptFacets({ ...bar, onsets: '0,60,120,180' })
    expect(facets.division).toBe('quarter')
    expect(facets.offBeat).toBe(false)
  })

  it('names a triplet bar for its triplet', () => {
    expect(attemptFacets({ ...bar, onsets: '0,20,40,60' }).division).toBe('triplet')
  })

  it('is built on no note, so it drops out of every question about pitch', () => {
    // The documented behaviour of a filter naming a dimension an attempt does
    // not have — and exactly right here, since a rhythm has no root.
    const facets = attemptFacets(bar)
    expect(facets.root).toBeUndefined()
    expect(facets.clef).toBeUndefined()
  })

  it('keeps its bearings when the row cannot be read', () => {
    // Hand-edited, or written by a version that stored something else. It
    // loses its derived facets rather than throwing inside a statistics query.
    const broken = attemptFacets({ ...bar, onsets: '60,0' })
    expect(broken.kind).toBe('rhythm')
    expect(broken.division).toBeUndefined()

    expect(attemptFacets({ ...bar, meter: '9/16' }).division).toBeUndefined()
  })
})

describe('a scale degree question', () => {
  const melody: DegreeAttempt = {
    kind: 'degree',
    tonic: 'E4',
    mode: 'ionian',
    clef: 'treble',
    degrees: '1,3,b6,5',
  }

  it('answers with the degrees, which is the whole of what was asked', () => {
    expect(correctAnswer(melody)).toBe('1,3,b6,5')
  })

  it('works out what it was like rather than storing it', () => {
    const facets = attemptFacets(melody)

    expect(facets.kind).toBe('degree')
    expect(facets.mode).toBe('ionian')
    expect(facets.tonic).toBe('E4')
    // The octave is dropped, so a question on E is a question on E whichever
    // clef put it there — the dimension it shares with intervals and scales.
    expect(facets.root).toBe('E')
    expect(facets.length).toBe('4')
    expect(facets.altered).toBe(true)
  })

  it('knows a melody that stayed inside its key', () => {
    expect(attemptFacets({ ...melody, degrees: '1,3,5' }).altered).toBe(false)
    expect(attemptFacets({ ...melody, degrees: '1,3,5' }).length).toBe('3')
  })

  it('keeps its bearings when the row cannot be read', () => {
    const broken = attemptFacets({ ...melody, degrees: '1,9' })
    expect(broken.kind).toBe('degree')
    expect(broken.length).toBeUndefined()
    expect(broken.altered).toBeUndefined()
  })
})
