import { describe, expect, it } from 'vitest'

import { chordSummaries, chordSummary } from '@/components/explain/chordSeries'
import { degreeShorthand } from '@/components/explain/modeSeries'
import {
  CHORD_QUALITIES,
  chordNotes,
  inversionFigure,
  inversionsFor,
  isCleanChord,
  isSymmetric,
  topsFor,
} from '@/lib/music/chord'
import { intervalKey } from '@/lib/music/interval'
import { parseTonicKey, type PitchClass } from '@/lib/music/scale'

import {
  CHORD_EXAMPLES,
  POSITION_EXAMPLE,
  SEVENTH_EXAMPLES,
  SEVENTH_POSITION_EXAMPLE,
  TRIAD_EXAMPLES,
} from './chordExamples'

/**
 * The chords guide, held to the model it describes.
 *
 * The page draws every staff by evaluating `chord.ts`, so it cannot go stale on
 * its own. What it *can* do is illustrate a claim with an example that
 * contradicts it, which no type checker would notice — a page teaching "melina
 * never asks for a chord needing a double accidental" and then drawing one
 * would be worse than no page. So the examples are held to the same bar a
 * question has to clear, and the shortcuts the prose states are checked against
 * what the model actually says.
 */

const root = (key: string): PitchClass => parseTonicKey(key) as PitchClass

describe('the chords guide', () => {
  it('never draws a chord the exercises would refuse to ask for', () => {
    for (const example of CHORD_EXAMPLES) {
      expect(
        isCleanChord(root(example.root), example.quality),
        `${example.root} ${example.quality}`,
      ).toBe(true)
    }
    expect(isCleanChord(root(POSITION_EXAMPLE.root), POSITION_EXAMPLE.quality)).toBe(true)
    expect(
      isCleanChord(root(SEVENTH_POSITION_EXAMPLE.root), SEVENTH_POSITION_EXAMPLE.quality),
    ).toBe(true)
  })

  it('shows every quality exactly once', () => {
    const shown = CHORD_EXAMPLES.map((example) => example.quality)
    expect([...shown].sort()).toEqual([...CHORD_QUALITIES].sort())
    expect(new Set(shown).size).toBe(shown.length)
    expect(TRIAD_EXAMPLES).toHaveLength(4)
    expect(SEVENTH_EXAMPLES).toHaveLength(5)
  })

  it('draws every one of them on C, which is what makes the staves comparable', () => {
    // The root never moves, so the only difference from one staff to the next
    // is the accidentals — the same reason the modes guide draws all seven
    // modes on C. Nothing may quietly wander off it.
    for (const example of CHORD_EXAMPLES) {
      expect(example.root, example.quality).toBe('C')
    }

    // Including the one that needs a double flat to stand there. Drawing it
    // somewhere more comfortable would have been drawing around the thing the
    // page is teaching.
    expect(chordNotes(root('C'), 'diminished-seventh')?.at(-1)).toEqual({
      letter: 'B',
      alteration: -2,
    })
    expect(isCleanChord(root('C'), 'diminished-seventh')).toBe(true)
  })

  it('backs up the shortcut the page states about the four triads', () => {
    // "Major is a large third under a small one, minor the other way round,
    // diminished two small ones and augmented two large ones." That is the
    // claim the section makes, and it is the model measured rather than a
    // mnemonic somebody typed — so it has to keep coming out of the model.
    const thirds = (quality: (typeof CHORD_QUALITIES)[number]) =>
      chordSummary(quality).thirds.map(intervalKey)

    expect(thirds('major')).toEqual(['M3', 'm3'])
    expect(thirds('minor')).toEqual(['m3', 'M3'])
    expect(thirds('diminished')).toEqual(['m3', 'm3'])
    expect(thirds('augmented')).toEqual(['M3', 'M3'])
  })

  it('stacks every seventh chord from three thirds', () => {
    for (const { quality } of SEVENTH_EXAMPLES) {
      const thirds = chordSummary(quality).thirds
      expect(thirds, quality).toHaveLength(3)
      for (const third of thirds) expect(third.number).toBe(3)
    }
  })

  it('gives every row of the table something different to say', () => {
    // Two qualities spelling the same shorthand would be two rows saying the
    // same thing, which is either a duplicate in the vocabulary or a bug in
    // the measuring.
    const rows = chordSummaries()
    const written = rows.map((row) => row.degrees.map(degreeShorthand).join(' '))
    expect(new Set(written).size).toBe(rows.length)
    expect(written).toContain('1 3 5')
    expect(written).toContain('1 ♭3 ♭5 ♭♭7')
  })

  it('names exactly the two chords the ear cannot invert', () => {
    const symmetric = chordSummaries().filter((row) => row.symmetric)
    expect(symmetric.map((row) => row.id)).toEqual(['augmented', 'diminished-seventh'])
    for (const quality of CHORD_QUALITIES) {
      expect(isSymmetric(quality)).toBe(chordSummary(quality).symmetric)
    }
  })

  it('has a position to draw for every inversion it lists', () => {
    for (const example of [POSITION_EXAMPLE, SEVENTH_POSITION_EXAMPLE]) {
      const inversions = inversionsFor(example.quality)
      expect(inversions.length).toBe(chordSummary(example.quality).size)
      for (const inversion of inversions) {
        expect(inversionFigure(example.quality, inversion)).not.toBe('')
        expect(topsFor(example.quality, inversion).length).toBeGreaterThan(0)
      }
    }
    // The Lage section draws the same chord in the same inversion twice, so
    // there have to be two tops to draw it with.
    expect(topsFor(POSITION_EXAMPLE.quality, 0)).toEqual([1, 2])
  })

  it('labels the inversions with the figures thoroughbass writes them as', () => {
    expect(inversionsFor('major').map((i) => inversionFigure('major', i))).toEqual([
      '5/3',
      '6',
      '6/4',
    ])
    expect(
      inversionsFor('dominant-seventh').map((i) =>
        inversionFigure('dominant-seventh', i),
      ),
    ).toEqual(['7', '6/5', '4/3', '2'])
  })
})
