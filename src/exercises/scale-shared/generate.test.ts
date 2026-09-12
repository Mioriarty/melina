import { describe, expect, it } from 'vitest'

import { CLEFS, getClef } from '@/lib/music/clef'
import { chromaticValue, pitchKey, type Pitch } from '@/lib/music/pitch'
import { MODE_IDS, TONIC_KEYS, modeOf, tonicKey, type ModeId } from '@/lib/music/scale'
import { createRandom } from '@/lib/utils/seededRandom'

import {
  buildQuestion,
  firstNote,
  generateRound,
  playOrder,
  type ScaleQuestion,
  type ScaleRoundSpec,
} from './generate'

const FULL: ScaleRoundSpec = {
  clefs: ['treble', 'bass', 'alto', 'tenor'],
  modes: MODE_IDS,
  tonics: TONIC_KEYS,
  directions: ['ascending', 'descending'],
  questionsPerRound: 30,
}

const SEEDS = [1, 2, 3, 17, 99, 4242]

function everyQuestion(spec: ScaleRoundSpec): ScaleQuestion[] {
  return SEEDS.flatMap((seed) => generateRound(createRandom(seed), spec))
}

describe('generateRound', () => {
  it('fills the round', () => {
    for (const seed of SEEDS) {
      expect(generateRound(createRandom(seed), FULL)).toHaveLength(30)
    }
  })

  it('gives every question notes that really spell its mode', () => {
    // The load-bearing assertion: a question whose notes disagree with its
    // own answer is unanswerable, and nothing else in the app would notice.
    for (const question of everyQuestion(FULL)) {
      expect(
        modeOf(question.pitches),
        `${pitchKey(question.tonic)} ${question.mode}`,
      ).toBe(question.mode)
      expect(question.pitches[0]).toEqual(question.tonic)
      expect(question.pitches).toHaveLength(8)
    }
  })

  it('keeps the whole scale inside the clef', () => {
    // Not just the tonic: a scale that starts comfortably and ends three
    // ledger lines up is a reading of ledger lines, not of a mode.
    for (const question of everyQuestion(FULL)) {
      const clef = getClef(question.clef)
      for (const pitch of question.pitches) {
        expect(
          chromaticValue(pitch),
          `${question.clef}: ${pitchKey(pitch)}`,
        ).toBeGreaterThanOrEqual(chromaticValue(clef.lowest))
        expect(
          chromaticValue(pitch),
          `${question.clef}: ${pitchKey(pitch)}`,
        ).toBeLessThanOrEqual(chromaticValue(clef.highest))
      }
    }
  })

  it('never writes a double accidental', () => {
    // The tonics that would need one are skipped rather than spelled: no one
    // writes G♯ lydian, they write A♭ lydian.
    for (const question of everyQuestion(FULL)) {
      for (const pitch of question.pitches) {
        expect(Math.abs(pitch.alteration), pitchKey(pitch)).toBeLessThan(2)
      }
    }
  })

  it('asks only what the settings allow', () => {
    const spec: ScaleRoundSpec = {
      clefs: ['bass'],
      modes: ['dorian', 'lydian'],
      tonics: ['C', 'Bb'],
      directions: ['descending'],
      questionsPerRound: 20,
    }

    for (const question of everyQuestion(spec)) {
      expect(question.clef).toBe('bass')
      expect(spec.modes).toContain(question.mode)
      expect(spec.tonics).toContain(
        tonicKey({
          letter: question.tonic.letter,
          alteration: question.tonic.alteration,
        }),
      )
      expect(question.direction).toBe('descending')
    }
  })

  it('spreads the modes evenly rather than sampling them', () => {
    // Uniform sampling over nine modes reliably leaves one unasked, which
    // makes a round feel arbitrary rather than thorough. Three each, so the
    // round length follows the count rather than being typed in beside it.
    const perMode = 3
    const counts = new Map<ModeId, number>()
    for (const question of generateRound(createRandom(5), {
      ...FULL,
      questionsPerRound: MODE_IDS.length * perMode,
    })) {
      counts.set(question.mode, (counts.get(question.mode) ?? 0) + 1)
    }

    expect(counts.size).toBe(MODE_IDS.length)
    for (const [mode, count] of counts) expect(count, mode).toBe(perMode)
  })

  it('never asks melodic minor downwards, however the spec is written', () => {
    // Coming down, melodic minor *is* the natural minor — the classical form
    // lowers the sixth and seventh again — so a descending one is a question
    // with two right answers. The round may offer both directions; this one
    // scale still only ever comes out ascending.
    for (const question of everyQuestion(FULL)) {
      if (question.mode !== 'melodicMinor') continue
      expect(question.direction, pitchKey(question.tonic)).toBe('ascending')
    }
  })

  it('leaves melodic minor out of a round that only goes down', () => {
    // Not turned round quietly: the direction is what the attempt log records
    // and what a level's own accuracy filter looks for, so an ascending
    // question in a descending level would be a row the level could never
    // count. There is no descending melodic minor to ask about, and the round
    // says so by not asking.
    const falling = everyQuestion({ ...FULL, directions: ['descending'] })
    expect(falling.length).toBeGreaterThan(0)
    expect(falling.some((question) => question.mode === 'melodicMinor')).toBe(false)
    for (const question of falling) expect(question.direction).toBe('descending')

    // Every other scale is still there, so nothing else was swept up.
    expect(new Set(falling.map((question) => question.mode)).size).toBe(
      MODE_IDS.length - 1,
    )
  })

  it('returns nothing rather than a broken round when nothing is allowed', () => {
    expect(generateRound(createRandom(1), { ...FULL, modes: [] })).toEqual([])
    expect(generateRound(createRandom(1), { ...FULL, tonics: [] })).toEqual([])
    expect(generateRound(createRandom(1), { ...FULL, clefs: [] })).toEqual([])
    expect(generateRound(createRandom(1), { ...FULL, directions: [] })).toEqual([])
  })

  it('skips a mode that cannot be spelled on the only tonic offered', () => {
    // A♭ locrian needs a B double flat, so there is no question to build.
    const random = createRandom(3)
    expect(
      buildQuestion(
        random,
        'locrian',
        'treble',
        [{ letter: 'A', alteration: -1 }],
        'ascending',
      ),
    ).toBeUndefined()
  })

  it('finds a home for every mode in every clef', () => {
    // A scale needs a whole octave, which is most of what a clef can show, so
    // this is not a given.
    for (const clef of CLEFS) {
      for (const mode of MODE_IDS) {
        const question = buildQuestion(
          createRandom(11),
          mode,
          clef.id,
          [
            { letter: 'C', alteration: 0 },
            { letter: 'G', alteration: 0 },
          ],
          'ascending',
        )
        expect(question, `${mode} in ${clef.id}`).toBeDefined()
      }
    }
  })
})

describe('direction', () => {
  it('plays a descending scale from the top down', () => {
    const question = buildQuestion(
      createRandom(2),
      'aeolian',
      'treble',
      [{ letter: 'A', alteration: 0 }],
      'descending',
    ) as ScaleQuestion

    const order = playOrder(question)
    expect(order.map(pitchKey)).toEqual([...question.pitches].reverse().map(pitchKey))
    // The note heard first is the note shown first, so a descending scale
    // reveals the octave it falls from — never the tonic.
    expect(firstNote(question)).toEqual(question.pitches[7])
  })

  it('plays an ascending scale from the tonic up', () => {
    const question = buildQuestion(
      createRandom(2),
      'aeolian',
      'treble',
      [{ letter: 'A', alteration: 0 }],
      'ascending',
    ) as ScaleQuestion

    expect(playOrder(question)).toEqual(question.pitches)
    expect(firstNote(question)).toEqual(question.tonic)
  })

  it('sounds the same eight pitches either way', () => {
    for (const question of everyQuestion(FULL)) {
      const played = [...playOrder(question)] as Pitch[]
      expect(played.map(pitchKey).sort()).toEqual(
        [...question.pitches].map(pitchKey).sort(),
      )
    }
  })
})
