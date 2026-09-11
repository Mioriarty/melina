import { describe, expect, it } from 'vitest'

import { figureKey, sameNotes } from '@/lib/music/figuredBass'
import { getClef } from '@/lib/music/clef'
import { KEY_SIGNATURES, type KeySignatureId } from '@/lib/music/keySignature'
import { diatonicValue, pitchKey } from '@/lib/music/pitch'
import { tonicKey } from '@/lib/music/scale'
import { attemptFacets } from '@/lib/db/attemptQuestion'
import { createRandom } from '@/lib/utils/seededRandom'

import { thoroughbassAttempt, thoroughbassFilter, thoroughbassQuestion } from './attempt'
import { THOROUGHBASS_DIFFICULTIES } from './difficulties'
import { SUSPENSION_CHOICES } from './settings'
import {
  acceptsFigure,
  bassNotes,
  generateRound,
  type ThoroughbassQuestion,
  type ThoroughbassRoundSpec,
} from './generate'

const V1_FIGURES = ['', '6', '6/4', '7', '6/5', '4/3', '2', '#3', 'b3']

const spec = (over: Partial<ThoroughbassRoundSpec> = {}): ThoroughbassRoundSpec => ({
  keySignatures: ['0', '2s', '3f'],
  figures: V1_FIGURES,
  suspensions: [],
  events: 1,
  questionsPerRound: 10,
  ...over,
})

const rounds = (over: Partial<ThoroughbassRoundSpec> = {}) =>
  [1, 2, 3, 4, 5].flatMap((seed) => generateRound(createRandom(seed), spec(over)))

describe('what the generator produces', () => {
  it('fills a round for every seed', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(generateRound(createRandom(seed), spec())).toHaveLength(10)
    }
  })

  it('asks only figures the level named, in the spelling the log stores', () => {
    // Both halves matter. The first is what makes a level a level; the second
    // is what lets `thoroughbassFilter` pin the figure at all — a level naming
    // `4/2` while the question stores the canonical `2` would show an accuracy
    // measured over nothing.
    for (const question of rounds()) {
      for (const event of question.events) {
        const written = event.figures.map(figureKey).join('-')
        expect(V1_FIGURES, written).toContain(written)
      }
    }
  })

  it('accepts the figure it asked for', () => {
    // Canonical-required grading makes this the difference between a question
    // and a trap: the generator derives the figure from the notes, so what it
    // asks is by construction one of the forms grading will take.
    for (const question of rounds()) {
      question.events.forEach((event, index) => {
        event.figures.forEach((figure, position) => {
          expect(acceptsFigure(question, index, position, figure)).toBe(true)
        })
      })
    }
  })

  it('puts the bass on the bass staff and the chord on the treble', () => {
    const bass = getClef('bass')
    const treble = getClef('treble')
    for (const question of rounds()) {
      for (const event of question.events) {
        expect(diatonicValue(event.bass)).toBeGreaterThanOrEqual(
          diatonicValue(bass.staffLowest),
        )
        expect(diatonicValue(event.bass)).toBeLessThanOrEqual(
          diatonicValue(bass.staffHighest),
        )
        for (const note of event.chords.flat()) {
          expect(diatonicValue(note)).toBeGreaterThanOrEqual(diatonicValue(treble.lowest))
          expect(diatonicValue(note)).toBeLessThanOrEqual(diatonicValue(treble.highest))
        }
      }
    }
  })

  it('stacks the chord upward with nothing sharing a staff position', () => {
    for (const question of rounds()) {
      for (const event of question.events) {
        const places = (event.chords[0] ?? []).map(diatonicValue)
        expect([...places].sort((a, b) => a - b)).toEqual(places)
        expect(new Set(places).size).toBe(places.length)
      }
    }
  })

  it('never spells a chord note with a double accidental', () => {
    for (const question of rounds({ keySignatures: KEY_SIGNATURES.map((s) => s.id) })) {
      for (const event of question.events) {
        for (const notes of event.notes) {
          for (const note of notes)
            expect(Math.abs(note.alteration)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('the bass a question can stand on', () => {
  it('offers only notes of the key, on the staff, in every signature', () => {
    // The whole of keeping a question sensible: a figure with no accidental
    // resolves to what the signature spells, so a bass drawn from the key can
    // never produce a sonority from nowhere.
    for (const signature of KEY_SIGNATURES) {
      const notes = bassNotes(signature.id)
      expect(notes.length, signature.id).toBeGreaterThan(6)
      const spelled = new Set(notes.map(tonicKey))
      expect(spelled.size, signature.id).toBe(7)
    }
  })
})

describe('the attempt log round trip', () => {
  it('reads a row back to the question that wrote it', () => {
    for (const question of rounds({ keySignatures: KEY_SIGNATURES.map((s) => s.id) })) {
      const row = thoroughbassAttempt(question)
      const again = thoroughbassQuestion(row)

      expect(again, JSON.stringify(row)).toBeDefined()
      expect(again?.keySignature).toBe(question.keySignature)
      expect(again?.events.map((event) => pitchKey(event.bass))).toEqual(
        question.events.map((event) => pitchKey(event.bass)),
      )
      expect(
        again?.events.map((event) => event.figures.map(figureKey).join('-')),
      ).toEqual(question.events.map((event) => event.figures.map(figureKey).join('-')))
      // Derived on the way back out rather than stored, so a row cannot
      // disagree with the notation it produces.
      expect(
        again?.events.map((event) => event.chords.map((c) => c.map(pitchKey))),
      ).toEqual(question.events.map((event) => event.chords.map((c) => c.map(pitchKey))))
    }
  })

  it('refuses a row it cannot read rather than guessing', () => {
    const bad = [
      { keySignature: '9s' as KeySignatureId, bass: 'C3', figures: '6' },
      { keySignature: '0' as KeySignatureId, bass: 'H3', figures: '6' },
      { keySignature: '0' as KeySignatureId, bass: 'C3,D3', figures: '6' },
      { keySignature: '0' as KeySignatureId, bass: 'C3', figures: 'x' },
    ]
    for (const row of bad) {
      expect(thoroughbassQuestion({ kind: 'figured-bass', ...row })).toBeUndefined()
    }
  })
})

describe('every shipped level', () => {
  it('fills a round, and only with the figures it names', () => {
    // A level too narrow to place its figures would serve a short round in
    // silence, which is what `difficulties.test.ts` guards for every other
    // exercise. Worth having here too, next to the generator it is about.
    for (const level of THOROUGHBASS_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        const round = generateRound(createRandom(seed), level.settings)
        expect(round, `${level.id} seed ${seed}`).toHaveLength(
          level.settings.questionsPerRound,
        )
        const vocabulary = [...level.settings.figures, ...level.settings.suspensions]
        for (const question of round) {
          expect(level.settings.keySignatures).toContain(question.keySignature)
          for (const event of question.events) {
            expect(vocabulary).toContain(event.figures.map(figureKey).join('-'))
          }
        }
      }
    }
  })

  it('covers every figure it names, given a long enough round', () => {
    // `dealEvenly` is what makes this true; without it a level offering ten
    // figures could spend a round of ten on three of them.
    for (const level of THOROUGHBASS_DIFFICULTIES) {
      const seen = new Set<string>()
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const question of generateRound(createRandom(seed), {
          ...level.settings,
          questionsPerRound: 30,
        })) {
          for (const event of question.events)
            seen.add(event.figures.map(figureKey).join('-'))
        }
      }
      expect([...seen].sort(), level.id).toEqual(
        [...level.settings.figures, ...level.settings.suspensions].sort(),
      )
    }
  })
})

describe('suspensions', () => {
  const held = (over: Partial<ThoroughbassRoundSpec> = {}) =>
    [1, 2, 3].flatMap((seed) =>
      generateRound(
        createRandom(seed),
        spec({ figures: [], suspensions: SUSPENSION_CHOICES, ...over }),
      ),
    )

  it('builds every suspension the app offers', () => {
    const seen = new Set(
      held({ questionsPerRound: 40 }).flatMap((question) =>
        question.events.map((event) => event.figures.map(figureKey).join('-')),
      ),
    )
    expect([...seen].sort()).toEqual([...SUSPENSION_CHOICES].sort())
  })

  it('puts two figures under one bass note, and two chords over it', () => {
    for (const question of held()) {
      for (const event of question.events) {
        expect(event.figures).toHaveLength(2)
        expect(event.notes).toHaveLength(2)
        expect(event.chords).toHaveLength(2)
      }
    }
  })

  it('moves something between the two, which is what a suspension is', () => {
    // A resolution that moved nothing has no difference form, so it could not
    // have come out as the figure that was asked for — but a suspension whose
    // chord stands still would be a question with nothing in it, so it is
    // worth saying out loud rather than relying on that.
    for (const question of held()) {
      for (const event of question.events) {
        const [before, after] = event.notes
        expect(before).toBeDefined()
        expect(after).toBeDefined()
        expect(sameNotes(before ?? [], after ?? [])).toBe(false)
      }
    }
  })

  it('accepts the resolution written as the line that moved', () => {
    for (const question of held()) {
      question.events.forEach((event, index) => {
        event.figures.forEach((figure, position) => {
          expect(
            acceptsFigure(question, index, position, figure),
            `${event.figures.map(figureKey).join('-')}`,
          ).toBe(true)
        })
      })
    }
  })

  it('lets a level claim the suspensions it asks for', () => {
    // The accuracy filter pins the figure a level bounds, and a suspension is
    // stored under the same dash-joined key the level names it with — so a
    // level of nothing but suspensions would otherwise measure itself over no
    // rows at all.
    const level = spec({ figures: [], suspensions: ['4-3', '7-6'] })
    const filter = thoroughbassFilter(level, 'thoroughbass/figuring')
    expect(filter.figure).toEqual(['4-3', '7-6'])

    for (const question of held({ suspensions: ['4-3', '7-6'] })) {
      const row = thoroughbassAttempt(question)
      expect(filter.figure).toContain(row.figures)
    }
  })

  it('reads a suspension back out of the attempt log', () => {
    for (const question of held()) {
      const row = thoroughbassAttempt(question)
      expect(row.figures).toMatch(/-/)
      const again = thoroughbassQuestion(row)
      expect(again?.events.map((e) => e.figures.map(figureKey).join('-'))).toEqual(
        question.events.map((e) => e.figures.map(figureKey).join('-')),
      )
    }
  })
})

describe('a bass line', () => {
  const line = (events: number) =>
    [1, 2, 3].flatMap((seed) =>
      generateRound(createRandom(seed), spec({ events, questionsPerRound: 6 })),
    )

  it('carries as many bass notes as the level asks for', () => {
    for (const count of [2, 3, 4]) {
      for (const question of line(count)) {
        expect(question.events).toHaveLength(count)
      }
    }
  })

  it('keeps every bass note in the key it was drawn from', () => {
    for (const question of line(3)) {
      const inKey = new Set(bassNotes(question.keySignature).map(pitchKey))
      for (const event of question.events) expect(inKey).toContain(pitchKey(event.bass))
    }
  })

  it('stores the line as one row and reads it back whole', () => {
    for (const question of line(3)) {
      const row = thoroughbassAttempt(question)
      expect(row.bass.split(',')).toHaveLength(3)
      expect(row.figures.split(',')).toHaveLength(3)

      const again = thoroughbassQuestion(row)
      expect(again?.events.map((e) => pitchKey(e.bass))).toEqual(
        question.events.map((e) => pitchKey(e.bass)),
      )
      // **Including where the chords sit.** They are voiced as a succession,
      // each following the one before it, so reading a row back has to thread
      // the same reference along or the notation comes out different from the
      // notation the row was written from.
      expect(again?.events.map((e) => e.chords.map((c) => c.map(pitchKey)))).toEqual(
        question.events.map((e) => e.chords.map((c) => c.map(pitchKey))),
      )
    }
  })

  it('claims no single root or figure, because it is built on neither', () => {
    // The documented behaviour of a filter naming a dimension an attempt does
    // not have: a line is built on no one note and carries no one figure, so
    // it drops out of every query that asks about either — exactly the way a
    // rhythm drops out of every query that asks about pitch.
    const filter = thoroughbassFilter(spec({ events: 3 }), 'thoroughbass/figuring')
    expect(filter.figure).toBeUndefined()
    expect(filter.bassNotes).toBe('3')

    const facets = attemptFacets(thoroughbassAttempt(line(3)[0] as ThoroughbassQuestion))
    expect(facets.root).toBeUndefined()
    expect(facets.figure).toBeUndefined()
    expect(facets.bassNotes).toBe('3')
  })

  it('still names a root and a figure when there is only one bass note', () => {
    const facets = attemptFacets(
      thoroughbassAttempt(
        generateRound(createRandom(1), spec({ events: 1 }))[0] as ThoroughbassQuestion,
      ),
    )
    expect(facets.root).toBeDefined()
    expect(facets.figure).toBeDefined()
    expect(facets.bassNotes).toBe('1')
  })
})
