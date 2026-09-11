import { describe, expect, it } from 'vitest'

import { attemptFacets, correctAnswer } from '@/lib/db/attemptQuestion'
import { matchesFilter } from '@/lib/db/progress'
import { closeChord, sameChord, type Chord } from '@/lib/music/chord'
import { parseTonicKey, type PitchClass } from '@/lib/music/scale'
import { createRandom } from '@/lib/utils/seededRandom'

import type { AttemptRow } from '@/lib/db/schema'

import { chordAttempt, chordFilter, chordQuestion } from './attempt'
import { CHORD_DIFFICULTIES } from './difficulties'
import { chordSpec, generateRound } from './generate'

/**
 * A chord question, into the attempt log and out again.
 *
 * The rule the whole log follows: a row keeps exactly enough to ask the
 * question again and nothing that could disagree with it. Everything else —
 * the notes, where they sit, the answer that would have been right — is
 * `chord.ts` applied to those four facts on the way back out.
 */

const C = parseTonicKey('C') as PitchClass

const spec = (settings: (typeof CHORD_DIFFICULTIES)[number]['settings']) =>
  chordSpec(settings, 'reading')

/** A logged answer, as the filter sees one. */
const row = (question: ReturnType<typeof chordAttempt>): AttemptRow => ({
  exerciseId: 'chords/reading',
  ts: 0,
  correct: true,
  question,
  answered: '',
  ms: 0,
})

describe('a chord in the attempt log', () => {
  it('round-trips every question a level can ask', () => {
    for (const level of CHORD_DIFFICULTIES) {
      const active = spec(level.settings)
      for (const question of generateRound(createRandom(2024), active)) {
        const row = chordAttempt(question)
        const back = chordQuestion(row, active)

        expect(back, level.id).toBeDefined()
        expect(sameChord(back!.chord, question.chord)).toBe(true)
        expect(back!.clef).toBe(question.clef)
        expect(back!.direction).toBe(question.direction)
        // Rebuilt rather than stored, and it has to come out the same: the
        // notes on the staff are what the row would draw again.
        expect(back!.pitches.map((note) => note.letter + note.octave)).toEqual(
          question.pitches.map((note) => note.letter + note.octave),
        )
      }
    }
  })

  it('names the whole answer, whether or not a round asked for all of it', () => {
    const chord: Chord = { root: C, quality: 'dominant-seventh', inversion: 2, top: 1 }
    const row = chordAttempt({
      chord,
      clef: 'treble',
      direction: 'harmonic',
      pitches: [],
      asks: { root: false, inversion: true, lage: true },
    })
    expect(correctAnswer(row)).toBe('C:dominant-seventh:2:1')
  })

  it('derives the dimensions a query can ask about', () => {
    const facets = attemptFacets(
      chordAttempt({
        chord: closeChord(C, 'minor-seventh', 1),
        clef: 'bass',
        direction: 'ascending',
        pitches: [],
        asks: { root: false, inversion: true, lage: false },
      }),
    )

    expect(facets.kind).toBe('chord')
    expect(facets.quality).toBe('minor-seventh')
    expect(facets.inversion).toBe('1')
    expect(facets.size).toBe('4')
    expect(facets.clef).toBe('bass')
    expect(facets.direction).toBe('ascending')
    // `root` is the dimension every exercise shares, so one query spans them.
    expect(facets.root).toBe('C')
    expect(facets.close).toBe(true)
    expect(facets.altered).toBe(true)
    expect(facets.doubled).toBe(false)
  })

  it('marks the one chord that needs a double accidental', () => {
    const facets = attemptFacets(
      chordAttempt({
        chord: closeChord(C, 'diminished-seventh'),
        clef: 'treble',
        direction: 'harmonic',
        pitches: [],
        asks: { root: false, inversion: false, lage: false },
      }),
    )
    expect(facets.doubled).toBe(true)
  })

  it("counts a level's own questions, and nothing a narrower level could not ask", () => {
    // A level's settings *are* a filter, which is what makes measuring one
    // need no machinery of its own.
    for (const level of CHORD_DIFFICULTIES) {
      const active = spec(level.settings)
      const filter = chordFilter(active, 'chords/reading')

      for (const question of generateRound(createRandom(31), active)) {
        expect(matchesFilter(row(chordAttempt(question)), filter), level.id).toBe(true)
      }
    }
  })

  it('keeps a stacked-up level from counting a chord voiced to a Lage', () => {
    const stacked = CHORD_DIFFICULTIES.find((level) => !level.settings.lage)!
    const filter = chordFilter(spec(stacked.settings), 'chords/reading')

    const voiced = chordAttempt({
      chord: { root: C, quality: 'major', inversion: 0, top: 1 },
      clef: 'treble',
      direction: 'ascending',
      pitches: [],
      asks: { root: false, inversion: false, lage: true },
    })
    expect(matchesFilter(row(voiced), filter)).toBe(false)
  })
})
