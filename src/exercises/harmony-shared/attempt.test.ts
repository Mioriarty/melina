import { describe, expect, it } from 'vitest'

import { attemptFacets, correctAnswer } from '@/lib/db/attemptQuestion'
import { matchesFilter } from '@/lib/db/progress'
import { degreesKey } from '@/lib/music/degree'
import { KEY_CHOICES } from '@/lib/music/key'
import { eventNotes } from '@/lib/music/harmony'
import { tonicKey } from '@/lib/music/scale'
import { createRandom } from '@/lib/utils/seededRandom'

import { isCadenceCorrect } from '@/exercises/cadence-writing/rules'
import { CHORD_MEMBERS } from '@/lib/music/chord'
import { pitchKey } from '@/lib/music/pitch'
import { voicingPitches } from '@/lib/music/satbVoicing'

import {
  cadenceAttempt,
  cadenceFilter,
  cadenceQuestion,
  harmonyAttempt,
  harmonyFilter,
  harmonyQuestion,
} from './attempt'
import {
  bassDegrees,
  cadenceSpec,
  generateCadenceRound,
  generateRound,
  harmonySpec,
} from './generate'
import { DEFAULT_CADENCE_SETTINGS, DEFAULT_SETTINGS } from './settings'

/**
 * A progression into the log and back out.
 *
 * **Stored as a figured bass**, so the chords, the Stufen, the functions, the
 * four voices and the correct answer are all derived on the way back. What
 * this holds is that the derivation really does return what went in — the same
 * round trip `modeOf` plays on the scale generator.
 */

const SPEC = harmonySpec({
  ...DEFAULT_SETTINGS,
  keys: KEY_CHOICES.map((key) => `${tonicKey(key.tonic)}:${key.mode}`),
  chords: [5, 6, 7],
  cadences: [
    'ganzschluss-vollkommen',
    'kadenz-quartsext',
    'trugschluss',
    'phrygischer-halbschluss',
  ],
  blocks: ['tonika-prolongation', 'zwischendominante', 'quintfall', 'neapolitaner'],
  questionsPerRound: 15,
})

const round = generateRound(createRandom(31337), SPEC)

describe('harmonyAttempt', () => {
  it('generated a round to check against', () => {
    expect(round).toHaveLength(SPEC.questionsPerRound)
  })

  it('rebuilds exactly the notes that went in', () => {
    for (const question of round) {
      const row = harmonyAttempt(question)
      const read = harmonyQuestion(row, false)
      expect(read, row.bass).toBeDefined()
      if (read === undefined) continue

      expect(
        read.progression.events.map((event) => eventNotes(event).map(tonicKey)),
      ).toEqual(
        question.progression.events.map((event) => eventNotes(event).map(tonicKey)),
      )
      expect(read.progression.events.map((event) => event.ticks)).toEqual(
        question.progression.events.map((event) => event.ticks),
      )
      expect(read.progression.events.map((event) => event.held === true)).toEqual(
        question.progression.events.map((event) => event.held === true),
      )
    }
  })

  it('rebuilds the same four voices, because they are derived rather than stored', () => {
    for (const question of round) {
      const read = harmonyQuestion(harmonyAttempt(question), false)
      expect(read?.satz.voicings).toEqual(question.satz.voicings)
    }
  })

  it('keeps the reading that cannot be recovered', () => {
    // `I–IV–V–I` may be a cadence or the tail of a sequence, and telling those
    // apart is itself a future exercise — so the analysis is the one thing
    // stored rather than derived.
    for (const question of round) {
      const read = harmonyQuestion(harmonyAttempt(question), false)
      expect(read?.progression.analysis).toEqual(question.progression.analysis)
    }
  })

  it('derives the right answer from the row alone', () => {
    for (const question of round) {
      const wanted = bassDegrees(question.progression)
      expect(wanted).toBeDefined()
      expect(correctAnswer(harmonyAttempt(question))).toBe(degreesKey(wanted ?? []))
    }
  })
})

describe('harmonyFilter', () => {
  it('matches the rows its own level produced', () => {
    // A level whose filter does not match its own attempts would show no
    // accuracy at all, however much the player practised it.
    const filter = harmonyFilter(SPEC, 'harmony/bass')
    for (const question of round) {
      const row = {
        exerciseId: 'harmony/bass',
        ts: 0,
        correct: true,
        question: harmonyAttempt(question),
        answered: '',
        ms: 0,
      }
      expect(matchesFilter(row, filter), harmonyAttempt(question).bass).toBe(true)
    }
  })

  it('does not reach a level in other keys', () => {
    const elsewhere = harmonyFilter({ ...SPEC, keys: ['F#:ionian'] }, 'harmony/bass')
    const rows = round.map((question) => ({
      exerciseId: 'harmony/bass',
      ts: 0,
      correct: true,
      question: harmonyAttempt(question),
      answered: '',
      ms: 0,
    }))
    expect(rows.every((row) => matchesFilter(row, elsewhere))).toBe(false)
  })
})

describe('the facets a progression is queryable on', () => {
  it('shares `root` with every other exercise', () => {
    // The design being tested a fifth time: `{ root: 'Eb' }` meant "every
    // question built on an E flat" before harmony existed, and did not have to
    // learn that it now does.
    for (const question of round) {
      const facets = attemptFacets(harmonyAttempt(question))
      expect(facets.root).toBe(tonicKey(question.progression.key.tonic))
      expect(facets.mode).toBe(question.progression.key.mode)
      expect(facets.kind).toBe('harmony')
    }
  })

  it('names the cadence, which is the weakness worth having', () => {
    for (const question of round) {
      const facets = attemptFacets(harmonyAttempt(question))
      expect(typeof facets.cadence).toBe('string')
      expect(SPEC.cadences).toContain(facets.cadence)
    }
  })

  it('degrades to nothing rather than throwing on a row it cannot read', () => {
    const facets = attemptFacets({
      kind: 'harmony',
      key: 'C:ionian',
      bass: 'not-a-note',
      figures: '',
      beats: '',
      analysis: '',
      tempo: 72,
    })
    expect(facets.kind).toBe('harmony')
    expect(facets.cadence).toBeUndefined()
  })
})

/* ------------------------------------------------ writing one down, in four parts */

const CADENCE_SPEC = cadenceSpec({
  ...DEFAULT_CADENCE_SETTINGS,
  keys: ['C:ionian', 'Eb:ionian', 'A:aeolian', 'F#:ionian'],
  chords: [4, 5],
  cadences: ['ganzschluss-vollkommen', 'kadenz-quartsext', 'trugschluss'],
  blocks: ['tonika-prolongation', 'zwischendominante'],
  questionsPerRound: 12,
})

const cadences = generateCadenceRound(createRandom(4711), CADENCE_SPEC)

describe('cadenceAttempt', () => {
  it('generated a round to check against', () => {
    expect(cadences).toHaveLength(CADENCE_SPEC.questionsPerRound)
  })

  it('rebuilds the same question, in the same places', () => {
    // **The round trip the row's shape rests on.** The Lage is stored because
    // no reading of the chords can recover it; everything else is derived. And
    // the setting has to be rebuilt under the *same* constraints — a row voiced
    // without the prompt's Lage puts the same chords in different places, which
    // is a row disagreeing with the notation it produced.
    for (const question of cadences) {
      const row = cadenceAttempt(question)
      const read = cadenceQuestion(row, question.rules)
      expect(read, row.bass).toBeDefined()
      if (read === undefined) continue

      expect(read.lage).toBe(question.lage)
      expect(read.model.voicings.map((v) => voicingPitches(v).map(pitchKey))).toEqual(
        question.model.voicings.map((v) => voicingPitches(v).map(pitchKey)),
      )
    }
  })

  it('keeps the setting it rebuilt answerable', () => {
    // A row read back has to still be a question: the answer that was right
    // when it was asked is still right when it is asked again.
    for (const question of cadences) {
      const read = cadenceQuestion(cadenceAttempt(question), question.rules)
      expect(read).toBeDefined()
      if (read === undefined) continue
      expect(isCadenceCorrect(read.model.voicings, read)).toBe(true)
    }
  })

  it('says there is no single right answer', () => {
    // A four-part setting has a dozen of them, which is the whole reason it is
    // graded by rules. Printing one would be printing a model answer as though
    // it were *the* answer.
    expect(correctAnswer(cadenceAttempt(cadences[0] as (typeof cadences)[number]))).toBe(
      '',
    )
  })

  it('is reached by the Lage, in the same dimension a chord is', () => {
    // `top` rather than a facet of its own: which member stands on top is a
    // dimension chord questions already have, and sharing it is what lets one
    // query span both.
    for (const question of cadences) {
      const row = cadenceAttempt(question)
      const facets = attemptFacets(row)
      expect(facets.top).toBe(String(CHORD_MEMBERS.indexOf(question.lage)))

      const spec = { ...CADENCE_SPEC, lagen: [question.lage] }
      expect(
        matchesFilter(
          {
            id: 1,
            exerciseId: 'harmony/cadence',
            ts: 0,
            correct: true,
            question: row,
            answered: '',
            ms: 0,
          },
          cadenceFilter(spec),
        ),
      ).toBe(true)
    }
  })
})
