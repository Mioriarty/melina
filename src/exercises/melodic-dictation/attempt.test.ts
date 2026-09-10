import { describe, expect, it } from 'vitest'

import { attemptFacets } from '@/lib/db/attemptQuestion'
import { matchesFilter } from '@/lib/db/progress'
import { degreeKey } from '@/lib/music/degree'
import { pitchKey } from '@/lib/music/pitch'
import { phraseKey } from '@/lib/music/phrase'
import { createRandom } from '@/lib/utils/seededRandom'

import { melodyAttempt, melodyFilter, melodyQuestion } from './attempt'
import { MELODY_DIFFICULTIES } from './difficulties'
import { generateRound, type MelodyRoundSpec } from './generate'
import { DEFAULT_SETTINGS } from './settings'

/**
 * A row keeps exactly enough to ask the question again, and no more.
 *
 * The round trip is what proves both halves of that at once: too little and
 * the question cannot be rebuilt, too much and the row holds a second copy of
 * something derived, which is a fact that can come to disagree with itself.
 */

const spec = (over: Partial<MelodyRoundSpec> = {}): MelodyRoundSpec => ({
  ...DEFAULT_SETTINGS,
  ...over,
})

function round(over: Partial<MelodyRoundSpec> = {}, seed = 5) {
  return generateRound(createRandom(seed), spec(over))
}

describe('a melody in the attempt log', () => {
  it('comes back as the question that was asked', () => {
    for (const question of round()) {
      const back = melodyQuestion(melodyAttempt(question))
      expect(back).toBeDefined()

      expect(pitchKey(back!.tonic)).toBe(pitchKey(question.tonic))
      expect(back!.mode).toBe(question.mode)
      expect(back!.clef).toBe(question.clef)
      expect(back!.keySignature).toBe(question.keySignature)
      expect(phraseKey(back!.phrase)).toBe(phraseKey(question.phrase))
      expect(back!.degrees.map(degreeKey)).toEqual(question.degrees.map(degreeKey))
      expect(back!.pitches.map(pitchKey)).toEqual(question.pitches.map(pitchKey))
      expect(back!.tempo).toBe(question.tempo)
    }
  })

  it('survives a melody that leaves the tonic octave', () => {
    // The reason a degree grew an octave at all: `1` and `1'` are different
    // notes, and a row that lost the difference would rebuild a different
    // melody.
    for (const question of round({ low: '5_', high: "1'", bars: 1 })) {
      const back = melodyQuestion(melodyAttempt(question))
      expect(back?.pitches.map(pitchKey)).toEqual(question.pitches.map(pitchKey))
    }
  })

  it('keeps which bar each note fell in', () => {
    // `0,60|0,90` is not the same melody as one long bar with the same gaps,
    // so the bars cannot be flattened on the way in.
    const [question] = round({ bars: 2 })
    expect(question).toBeDefined()

    const row = melodyAttempt(question!)
    expect(row.onsets).toContain('|')
    expect(melodyQuestion(row)?.phrase.bars).toHaveLength(2)
  })

  it('refuses a row it cannot read rather than inventing one', () => {
    const [question] = round()
    const row = melodyAttempt(question!)

    expect(melodyQuestion({ ...row, tonic: 'H4' })).toBeUndefined()
    expect(melodyQuestion({ ...row, meter: '7/8' })).toBeUndefined()
    expect(melodyQuestion({ ...row, onsets: 'nonsense' })).toBeUndefined()
    expect(melodyQuestion({ ...row, degrees: '9' })).toBeUndefined()
  })

  it('refuses a row whose notes and impacts disagree', () => {
    // One note per impact, or the row is describing two different melodies.
    const [question] = round()
    const row = melodyAttempt(question!)
    expect(melodyQuestion({ ...row, degrees: '1' })).toBeUndefined()
  })
})

describe('what a melody can be asked about afterwards', () => {
  const rowOf = (question: ReturnType<typeof round>[number]) => ({
    exerciseId: 'dictation/short-melodies',
    ts: 1,
    correct: true,
    question: melodyAttempt(question),
    answered: '',
    ms: 1000,
  })

  it('derives the dimensions of both halves at once', () => {
    const [question] = round({ bars: 2 })
    const facets = attemptFacets(melodyAttempt(question!))

    // The pitch half, from scale degrees.
    expect(facets.mode).toBe(question!.mode)
    expect(facets.clef).toBe(question!.clef)
    expect(facets.root).toBeDefined()
    expect(facets.length).toBe(String(question!.degrees.length))
    // The rhythm half, from rhythmic dictation.
    expect(facets.meter).toBeDefined()
    expect(facets.tempo).toBe(String(question!.tempo))
    expect(facets.division).toBeDefined()
    expect(facets.impacts).toBe(String(question!.pitches.length))
    // And the two things only a phrase has.
    expect(facets.bars).toBe('2')
    expect(facets.span).toBeDefined()
  })

  it('is matched by a filter that names a dimension it shares with another exercise', () => {
    // `root` is deliberately shared: an interval's lower note, a scale's tonic
    // and a melody's tonic are one dimension, which is what lets a single query
    // span the whole app.
    const [question] = round()
    const row = rowOf(question!)
    const facets = attemptFacets(row.question)

    expect(matchesFilter(row, { root: facets.root as string })).toBe(true)
    expect(matchesFilter(row, { root: 'no-such-note' })).toBe(false)
  })

  it('drops out of a filter naming a dimension it does not have', () => {
    const [question] = round()
    expect(matchesFilter(rowOf(question!), { interval: 'M3' })).toBe(false)
  })

  it('matches the level that could have asked it', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      const filter = melodyFilter(settings as MelodyRoundSpec, 'dictation/short-melodies')
      for (const question of generateRound(
        createRandom(11),
        settings as MelodyRoundSpec,
      )) {
        expect(matchesFilter(rowOf(question), filter), id).toBe(true)
      }
    }
  })

  it('does not claim a level that pins a different metre or tempo', () => {
    const [question] = round({ meters: ['4/4'], tempo: 80 })
    const row = rowOf(question!)

    expect(matchesFilter(row, melodyFilter(spec({ meters: ['3/4'] })))).toBe(false)
    expect(matchesFilter(row, melodyFilter(spec({ tempo: 60 })))).toBe(false)
  })
})
