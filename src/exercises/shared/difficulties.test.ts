import { describe, expect, it } from 'vitest'

import { HEARING_DIFFICULTIES } from '@/exercises/interval-hearing/difficulties'
import { INTERVAL_HEARING_SETTINGS } from '@/exercises/interval-hearing/settings'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import {
  INTERVAL_READING_SETTINGS,
  READING_DIRECTIONS,
} from '@/exercises/interval-reading/settings'
import { CATALOG_KEYS, HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'
import { isClefId } from '@/lib/music/clef'
import { isKeySignatureId } from '@/lib/music/keySignature'
import { i18n } from '@/lib/i18n'
import { LANGUAGES } from '@/lib/i18n/languages'
import { createRandom } from '@/lib/utils/seededRandom'

import {
  difficultyBlurbKey,
  difficultyTitleKey,
  type DifficultyGroup,
} from './difficulty'
import { generateRound, type RoundSpec } from './generate'

/**
 * Levels are data, and data can be wrong in ways a type cannot catch: a
 * misspelled interval key, a clef that does not exist, or a combination that
 * generates no questions at all and drops the player straight back out.
 */
interface LevelCase {
  id: string
  settings: {
    clefs: readonly string[]
    keySignatures: readonly string[]
    intervals: readonly string[]
    questionsPerRound: number
  }
  /** Precomputed, so the shared assertions never see a union of settings. */
  spec: RoundSpec
  raw: unknown
}

interface Suite {
  name: DifficultyGroup
  levels: readonly LevelCase[]
  /** The interval keys this exercise is allowed to name. */
  keys: readonly string[]
  parse: (value: unknown) => unknown
}

const SUITES: readonly Suite[] = [
  {
    name: 'reading',
    keys: CATALOG_KEYS,
    parse: (value) => INTERVAL_READING_SETTINGS.parse(value),
    levels: READING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: { ...level.settings, directions: READING_DIRECTIONS },
      raw: level.settings,
    })),
  },
  {
    name: 'hearing',
    keys: HEARABLE_INTERVAL_KEYS,
    parse: (value) => INTERVAL_HEARING_SETTINGS.parse(value),
    levels: HEARING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: level.settings,
      raw: level.settings,
    })),
  },
]

describe.each(SUITES)('$name levels', ({ name, levels, keys, parse }) => {
  it('offers at least six, before Custom', () => {
    expect(levels.length).toBeGreaterThanOrEqual(6)
  })

  it('has a unique id', () => {
    expect(new Set(levels.map((level) => level.id)).size).toBe(levels.length)
  })

  it('is named and described in every language', () => {
    // Levels are the landing screen, so a missing translation here is a list
    // of raw keys rather than a subtly odd sentence somewhere.
    for (const { id: language } of LANGUAGES) {
      const t = i18n.getFixedT(language)
      const titles = new Set<string>()

      for (const level of levels) {
        const title = t(difficultyTitleKey(name, level.id))
        const blurb = t(difficultyBlurbKey(name, level.id))

        expect(title, `${language}: ${level.id} title`).not.toBe(
          difficultyTitleKey(name, level.id),
        )
        expect(blurb.length, `${language}: ${level.id} blurb`).toBeGreaterThan(10)
        titles.add(title)
      }

      // Two levels sharing a name would make the list unusable.
      expect(titles.size, language).toBe(levels.length)
    }
  })

  it('only names clefs, keys and intervals that exist', () => {
    for (const { id, settings } of levels) {
      expect(settings.clefs.length, id).toBeGreaterThan(0)
      expect(settings.keySignatures.length, id).toBeGreaterThan(0)
      expect(settings.intervals.length, id).toBeGreaterThan(0)

      for (const clef of settings.clefs)
        expect(isClefId(clef), `${id}: ${clef}`).toBe(true)
      for (const key of settings.keySignatures) {
        expect(isKeySignatureId(key), `${id}: ${key}`).toBe(true)
      }
      for (const interval of settings.intervals) {
        expect(keys, `${id}: ${interval}`).toContain(interval)
      }
    }
  })

  it('survives being stored and read back unchanged', () => {
    // A level is written into the settings table when picked, so anything it
    // contains must round-trip through the defensive parser intact.
    for (const { id, raw } of levels) {
      expect(parse(JSON.parse(JSON.stringify(raw))), id).toEqual(raw)
    }
  })

  it('actually generates a full round', () => {
    // The real failure mode: a level so narrow that the generator cannot
    // place its intervals, leaving a short round or none at all.
    for (const { id, settings, spec } of levels) {
      for (const seed of [1, 2, 3]) {
        const round = generateRound(createRandom(seed), spec)
        expect(round.length, `${id} (seed ${seed})`).toBe(settings.questionsPerRound)
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const { id, settings, spec } of levels) {
      for (const question of generateRound(createRandom(7), spec)) {
        expect(settings.clefs, id).toContain(question.clef)
        expect(settings.keySignatures, id).toContain(question.keySignature)
      }
    }
  })
})

describe('hearing levels', () => {
  it('never offers two intervals that sound the same', () => {
    for (const { id, settings } of HEARING_DIFFICULTIES) {
      for (const interval of settings.intervals) {
        expect(HEARABLE_INTERVAL_KEYS, `${id}: ${interval}`).toContain(interval)
      }
    }
  })

  it('covers each way of playing an interval somewhere', () => {
    const covered = new Set(
      HEARING_DIFFICULTIES.flatMap((level) => level.settings.directions),
    )
    expect([...covered].sort()).toEqual(['ascending', 'descending', 'harmonic'])
  })

  it('covers both instruments somewhere', () => {
    const covered = new Set(
      HEARING_DIFFICULTIES.map((level) => level.settings.instrument),
    )
    expect([...covered].sort()).toEqual(['harp', 'piano'])
  })
})

describe('reading levels', () => {
  it('covers all four clefs somewhere', () => {
    const covered = new Set(READING_DIFFICULTIES.flatMap((level) => level.settings.clefs))
    expect([...covered].sort()).toEqual(['alto', 'bass', 'tenor', 'treble'])
  })

  it('reaches the ambiguous spellings, which hearing cannot', () => {
    // Telling an augmented fourth from a diminished fifth is reading-only.
    const covered = new Set(
      READING_DIFFICULTIES.flatMap((level) => level.settings.intervals),
    )
    expect(covered.has('A4')).toBe(true)
    expect(covered.has('d5')).toBe(true)
  })

  it('has a level that stays on the staff and one that does not', () => {
    expect(READING_DIFFICULTIES.some((level) => level.settings.staffOnly)).toBe(true)
    expect(READING_DIFFICULTIES.some((level) => !level.settings.staffOnly)).toBe(true)
  })
})
