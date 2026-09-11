import { describe, expect, it } from 'vitest'

import {
  chordSize,
  closePosition,
  isSymmetric,
  readChord,
  sameChord,
  type ChordQuality,
} from '@/lib/music/chord'
import { getClef } from '@/lib/music/clef'
import { chromaticValue } from '@/lib/music/pitch'
import { createRandom } from '@/lib/utils/seededRandom'

import { CHORD_DIFFICULTIES } from './difficulties'
import {
  asksFor,
  availableInversions,
  buildQuestion,
  generateRound,
  type ChordRoundSpec,
} from './generate'
import { DEFAULT_SETTINGS, type ChordSettings } from './settings'

/**
 * The chord generator, measured rather than trusted.
 *
 * Two things are checked here that types cannot: that every shipped level can
 * actually fill a round — a level too narrow to place its chords would serve a
 * short one in silence — and that what comes out reads back as what went in,
 * which is the round trip `modeOf` does for scales.
 */

/** The three ways the exercises ask the generator for the same thing. */
const WAYS: readonly { name: string; byEar: boolean; namesRoot: boolean }[] = [
  { name: 'reading', byEar: false, namesRoot: true },
  { name: 'hearing', byEar: true, namesRoot: false },
  { name: 'writing', byEar: false, namesRoot: false },
]

const spec = (
  settings: ChordSettings,
  byEar: boolean,
  namesRoot: boolean,
): ChordRoundSpec => ({ ...settings, byEar, namesRoot })

describe('generating a chord round', () => {
  it('fills a full round for every level, in all three directions', () => {
    for (const level of CHORD_DIFFICULTIES) {
      for (const way of WAYS) {
        const round = generateRound(
          createRandom(12345),
          spec(level.settings, way.byEar, way.namesRoot),
        )
        expect(round, `${level.id} / ${way.name}`).toHaveLength(
          level.settings.questionsPerRound,
        )
      }
    }
  })

  it('reads every question it generates back to the chord that made it', () => {
    for (const level of CHORD_DIFFICULTIES) {
      for (const way of WAYS) {
        const round = generateRound(
          createRandom(777),
          spec(level.settings, way.byEar, way.namesRoot),
        )
        for (const question of round) {
          const read = readChord(question.pitches)
          expect(read, `${level.id}: ${JSON.stringify(question.chord)}`).toBeDefined()
          expect(sameChord(read!, question.chord)).toBe(true)
          expect(question.pitches).toHaveLength(chordSize(question.chord.quality))
        }
      }
    }
  })

  it('places every chord where its clef can show it', () => {
    for (const level of CHORD_DIFFICULTIES) {
      const round = generateRound(createRandom(99), spec(level.settings, false, true))
      for (const question of round) {
        const { lowest, highest } = getClef(question.clef)
        for (const note of question.pitches) {
          expect(chromaticValue(note), level.id).toBeGreaterThanOrEqual(
            chromaticValue(lowest),
          )
          expect(chromaticValue(note), level.id).toBeLessThanOrEqual(
            chromaticValue(highest),
          )
        }
      }
    }
  })

  it('never asks by ear for the inversion of a chord that has no audible one', () => {
    // The rule `hearableInversions` states, holding where it actually matters:
    // an augmented triad or a diminished seventh sounds like its own
    // inversions, so by ear it comes up in root position and the row is not
    // asked at all.
    const settings: ChordSettings = {
      ...DEFAULT_SETTINGS,
      qualities: ['augmented', 'diminished-seventh', 'major'],
      inversions: [0, 1, 2, 3],
      questionsPerRound: 30,
    }

    const round = generateRound(createRandom(4242), spec(settings, true, false))
    expect(round.length).toBeGreaterThan(0)

    for (const question of round) {
      if (!isSymmetric(question.chord.quality)) continue
      expect(question.chord.inversion).toBe(0)
      expect(question.asks.inversion).toBe(false)
    }
    // And the same level read rather than heard does invert them, because
    // there the spelling is on the page and the root can be seen.
    const seen = generateRound(createRandom(4242), spec(settings, false, true))
    expect(seen.some((q) => isSymmetric(q.chord.quality) && q.chord.inversion > 0)).toBe(
      true,
    )
  })

  it('asks for a row only where it has more than one answer', () => {
    // "Only enable the options if necessary" — a row with one key on it is not
    // a question. The same rule covers a first level that offers only root
    // position and a symmetric chord that can only be heard in one.
    const level = CHORD_DIFFICULTIES[0]!
    const round = generateRound(createRandom(5), spec(level.settings, false, true))
    for (const question of round) {
      expect(question.asks.inversion).toBe(false)
      expect(question.asks.lage).toBe(false)
      expect(question.asks.root).toBe(true)
    }

    // And hearing never names the root, however many the level offers.
    const heard = generateRound(createRandom(5), spec(level.settings, true, false))
    for (const question of heard) expect(question.asks.root).toBe(false)
  })

  it('offers every quality the level names, rather than spending a round on three', () => {
    const level = CHORD_DIFFICULTIES.find((entry) => entry.id === 'all-sevenths')!
    const round = generateRound(createRandom(31337), spec(level.settings, true, false))

    const seen = new Set(round.map((question) => question.chord.quality))
    for (const quality of level.settings.qualities) {
      expect(seen, quality).toContain(quality)
    }
  })

  it('stacks straight up when the level does not ask for a Lage', () => {
    for (const level of CHORD_DIFFICULTIES.filter((entry) => !entry.settings.lage)) {
      const round = generateRound(createRandom(64), spec(level.settings, false, true))
      for (const { chord } of round) {
        expect(chord.top, level.id).toBe(closePosition(chord.quality, chord.inversion))
      }
    }
  })

  it('reaches a Lage other than the stacked one where the level asks for it', () => {
    const level = CHORD_DIFFICULTIES.find((entry) => entry.id === 'lagen')!
    const round = generateRound(createRandom(808), spec(level.settings, false, true))
    expect(
      round.some(
        ({ chord }) => chord.top !== closePosition(chord.quality, chord.inversion),
      ),
    ).toBe(true)
    for (const question of round) expect(question.asks.lage).toBe(true)
  })

  it('falls back rather than serving nothing when a level asks the impossible', () => {
    // A level naming only third inversions and only triads has none to draw.
    // Root position is what it comes out as, rather than an empty round.
    const settings: ChordSettings = {
      ...DEFAULT_SETTINGS,
      qualities: ['major'],
      inversions: [3],
      questionsPerRound: 10,
    }
    const round = generateRound(createRandom(1), spec(settings, false, true))
    expect(round).toHaveLength(10)
    for (const { chord } of round) expect(chord.inversion).toBe(0)
    expect(availableInversions(spec(settings, false, true), 'major')).toEqual([0])
  })

  it('builds a question for every quality the vocabulary holds', () => {
    const qualities: ChordQuality[] = [
      'major',
      'minor',
      'diminished',
      'augmented',
      'dominant-seventh',
      'major-seventh',
      'minor-seventh',
      'half-diminished-seventh',
      'diminished-seventh',
    ]
    const settings: ChordSettings = {
      ...DEFAULT_SETTINGS,
      qualities,
      inversions: [0, 1, 2, 3],
      lage: true,
      clefs: ['treble', 'bass', 'alto', 'tenor'],
    }
    for (const quality of qualities) {
      const question = buildQuestion(
        createRandom(17),
        spec(settings, false, true),
        quality,
      )
      expect(question, quality).toBeDefined()
      expect(asksFor(spec(settings, false, true), question!.chord).lage).toBe(true)
    }
  })
})
