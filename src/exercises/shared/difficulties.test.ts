import { describe, expect, it } from 'vitest'

import { HEARING_DIFFICULTIES } from '@/exercises/interval-hearing/difficulties'
import { INTERVAL_HEARING_SETTINGS } from '@/exercises/interval-hearing/settings'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import {
  INTERVAL_READING_SETTINGS,
  READING_DIRECTIONS,
} from '@/exercises/interval-reading/settings'
import { generateRound, type RoundSpec } from '@/exercises/interval-shared/generate'
import { RHYTHM_DIFFICULTIES } from '@/exercises/rhythm-dictation/difficulties'
import {
  generateRound as generateRhythmRound,
  type RhythmRoundSpec,
} from '@/exercises/rhythm-dictation/generate'
import { RHYTHM_SETTINGS } from '@/exercises/rhythm-dictation/settings'
import { SCALE_HEARING_DIFFICULTIES } from '@/exercises/scale-hearing/difficulties'
import { SCALE_HEARING_SETTINGS } from '@/exercises/scale-hearing/settings'
import { SCALE_READING_DIFFICULTIES } from '@/exercises/scale-reading/difficulties'
import {
  READING_DIRECTIONS as SCALE_READING_DIRECTIONS,
  SCALE_READING_SETTINGS,
} from '@/exercises/scale-reading/settings'
import {
  generateRound as generateScaleRound,
  type ScaleRoundSpec,
} from '@/exercises/scale-shared/generate'
import { i18n } from '@/lib/i18n'
import { LANGUAGES } from '@/lib/i18n/languages'
import { CATALOG_KEYS, HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'
import { isClefId } from '@/lib/music/clef'
import { isKeySignatureId } from '@/lib/music/keySignature'
import { isMeterKey, meterKey } from '@/lib/music/meter'
import { isValidRhythm } from '@/lib/music/rhythm'
import { CELL_GROUP_IDS, isCellGroupId } from '@/lib/music/rhythmCells'
import { notateRhythm, onsetsOf } from '@/lib/notation/rhythmNotation'
import {
  MODE_IDS,
  isModeId,
  isTonicKey,
  printedAccidentals,
  parseTonicKey,
} from '@/lib/music/scale'
import { createRandom } from '@/lib/utils/seededRandom'

import {
  difficultyBlurbKey,
  difficultyTitleKey,
  type DifficultyGroup,
} from './difficulty'

/**
 * Levels are data, and data can be wrong in ways a type cannot catch: a
 * misspelled interval key, a clef that does not exist, or a combination that
 * generates no questions at all and drops the player straight back out.
 */

interface NamedLevels {
  group: DifficultyGroup
  levels: readonly { id: string }[]
}

const ALL_GROUPS: readonly NamedLevels[] = [
  { group: 'interval-reading', levels: READING_DIFFICULTIES },
  { group: 'interval-hearing', levels: HEARING_DIFFICULTIES },
  { group: 'scale-reading', levels: SCALE_READING_DIFFICULTIES },
  { group: 'scale-hearing', levels: SCALE_HEARING_DIFFICULTIES },
  { group: 'rhythm-dictation', levels: RHYTHM_DIFFICULTIES },
]

describe.each(ALL_GROUPS)('$group levels', ({ group, levels }) => {
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
        const title = t(difficultyTitleKey(group, level.id))
        const blurb = t(difficultyBlurbKey(group, level.id))

        expect(title, `${language}: ${level.id} title`).not.toBe(
          difficultyTitleKey(group, level.id),
        )
        expect(blurb.length, `${language}: ${level.id} blurb`).toBeGreaterThan(10)
        titles.add(title)
      }

      // Two levels sharing a name would make the list unusable.
      expect(titles.size, language).toBe(levels.length)
    }
  })
})

/* -------------------------------------------------------------- intervals */

interface IntervalLevelCase {
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

interface IntervalSuite {
  name: DifficultyGroup
  levels: readonly IntervalLevelCase[]
  /** The interval keys this exercise is allowed to name. */
  keys: readonly string[]
  parse: (value: unknown) => unknown
}

const INTERVAL_SUITES: readonly IntervalSuite[] = [
  {
    name: 'interval-reading',
    keys: CATALOG_KEYS,
    parse: (value) => INTERVAL_READING_SETTINGS.parse(value),
    levels: READING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: { ...level.settings, directions: READING_DIRECTIONS },
      raw: level.settings,
    })),
  },
  {
    name: 'interval-hearing',
    keys: HEARABLE_INTERVAL_KEYS,
    parse: (value) => INTERVAL_HEARING_SETTINGS.parse(value),
    levels: HEARING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: level.settings,
      raw: level.settings,
    })),
  },
]

describe.each(INTERVAL_SUITES)('$name settings', ({ levels, keys, parse }) => {
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

describe('interval hearing levels', () => {
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
})

describe('interval reading levels', () => {
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

/* ----------------------------------------------------------------- scales */

interface ScaleLevelCase {
  id: string
  settings: {
    clefs: readonly string[]
    modes: readonly string[]
    tonics: readonly string[]
    questionsPerRound: number
  }
  spec: ScaleRoundSpec
  raw: unknown
}

interface ScaleSuite {
  name: DifficultyGroup
  levels: readonly ScaleLevelCase[]
  parse: (value: unknown) => unknown
}

const SCALE_SUITES: readonly ScaleSuite[] = [
  {
    name: 'scale-reading',
    parse: (value) => SCALE_READING_SETTINGS.parse(value),
    levels: SCALE_READING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: { ...level.settings, directions: SCALE_READING_DIRECTIONS },
      raw: level.settings,
    })),
  },
  {
    name: 'scale-hearing',
    parse: (value) => SCALE_HEARING_SETTINGS.parse(value),
    levels: SCALE_HEARING_DIFFICULTIES.map((level) => ({
      ...level,
      spec: level.settings,
      raw: level.settings,
    })),
  },
]

describe.each(SCALE_SUITES)('$name settings', ({ levels, parse }) => {
  it('only names clefs, modes and tonics that exist', () => {
    for (const { id, settings } of levels) {
      expect(settings.clefs.length, id).toBeGreaterThan(0)
      expect(settings.modes.length, id).toBeGreaterThan(0)
      expect(settings.tonics.length, id).toBeGreaterThan(0)

      for (const clef of settings.clefs)
        expect(isClefId(clef), `${id}: ${clef}`).toBe(true)
      for (const mode of settings.modes)
        expect(isModeId(mode), `${id}: ${mode}`).toBe(true)
      for (const tonic of settings.tonics) {
        expect(isTonicKey(tonic), `${id}: ${tonic}`).toBe(true)
      }
    }
  })

  it('survives being stored and read back unchanged', () => {
    for (const { id, raw } of levels) {
      expect(parse(JSON.parse(JSON.stringify(raw))), id).toEqual(raw)
    }
  })

  it('actually generates a full round', () => {
    // The failure mode a type cannot catch: a level whose modes will not
    // spell on any of its tonics — A♭ locrian and the like — serving a short
    // round, or none at all.
    for (const { id, settings, spec } of levels) {
      for (const seed of [1, 2, 3]) {
        const round = generateScaleRound(createRandom(seed), spec)
        expect(round.length, `${id} (seed ${seed})`).toBe(settings.questionsPerRound)
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const { id, settings, spec } of levels) {
      for (const question of generateScaleRound(createRandom(7), spec)) {
        expect(settings.clefs, id).toContain(question.clef)
        expect(settings.modes, id).toContain(question.mode)
      }
    }
  })
})

describe('scale hearing levels', () => {
  it('covers both directions somewhere', () => {
    const covered = new Set(
      SCALE_HEARING_DIFFICULTIES.flatMap((level) => level.settings.directions),
    )
    expect([...covered].sort()).toEqual(['ascending', 'descending'])
  })

  it('sets the modes that sound alike against each other', () => {
    // A level of seven unrelated modes trains recognition; a level of three
    // that differ by one note trains the distinction. There has to be at
    // least one of the second kind.
    const narrow = SCALE_HEARING_DIFFICULTIES.filter(
      (level) => level.settings.modes.length <= 3,
    )
    expect(narrow.length).toBeGreaterThanOrEqual(3)
  })
})

describe('scale reading levels', () => {
  it('covers every mode and all four clefs somewhere', () => {
    const modes = new Set(SCALE_READING_DIFFICULTIES.flatMap((l) => l.settings.modes))
    expect([...modes].sort()).toEqual([...MODE_IDS].sort())

    const clefs = new Set(SCALE_READING_DIFFICULTIES.flatMap((l) => l.settings.clefs))
    expect([...clefs].sort()).toEqual(['alto', 'bass', 'tenor', 'treble'])
  })

  it('has a level that prints almost no accidentals and one that prints many', () => {
    // On a keyless staff the tonic decides how much ink is on the page, which
    // is a real difficulty axis and the reason tonics are a setting at all.
    // An unspellable pairing counts for nothing: the generator never asks it.
    const weights = (level: (typeof SCALE_READING_DIFFICULTIES)[number]) =>
      level.settings.tonics
        .flatMap((key) => {
          const tonic = parseTonicKey(key)
          if (tonic === undefined) return []
          return level.settings.modes.map((mode) => printedAccidentals(tonic, mode))
        })
        .filter(Number.isFinite)

    const lightest = SCALE_READING_DIFFICULTIES.map((level) =>
      Math.min(...weights(level)),
    )
    const heaviest = SCALE_READING_DIFFICULTIES.map((level) =>
      Math.max(...weights(level)),
    )

    // Somewhere to start: a level that can ask a scale with nothing printed.
    expect(Math.min(...lightest)).toBe(0)
    // Somewhere to end up: a level that can ask one covered in accidentals.
    expect(Math.max(...heaviest)).toBeGreaterThanOrEqual(5)
  })
})

/* ---------------------------------------------------------------- rhythms */

describe('rhythm-dictation settings', () => {
  it('only names meters and cell groups that exist', () => {
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      expect(settings.meters.length, id).toBeGreaterThan(0)
      for (const meter of settings.meters) {
        expect(isMeterKey(meter), `${id}: ${meter}`).toBe(true)
      }
      for (const group of Object.keys(settings.cellWeights)) {
        expect(isCellGroupId(group), `${id}: ${group}`).toBe(true)
      }
      // A level with everything switched off would generate an empty round.
      expect(
        CELL_GROUP_IDS.some((group) => settings.cellWeights[group] > 0),
        `${id} allows no cells`,
      ).toBe(true)
    }
  })

  it('survives being stored and read back unchanged', () => {
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      expect(RHYTHM_SETTINGS.parse(JSON.parse(JSON.stringify(settings))), id).toEqual(
        settings,
      )
    }
  })

  it('actually generates a full round', () => {
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        const round = generateRhythmRound(createRandom(seed), settings as RhythmRoundSpec)
        expect(round.length, `${id} (seed ${seed})`).toBe(settings.questionsPerRound)
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      for (const question of generateRhythmRound(
        createRandom(7),
        settings as RhythmRoundSpec,
      )) {
        expect(settings.meters, id).toContain(meterKey(question.rhythm.meter))
        expect(question.tempo, id).toBe(settings.tempo)
        expect(question.metronome, id).toBe(settings.metronome)
      }
    }
  })

  it('asks for no more impacts than its own cells can spell', () => {
    // `minOnsets` is capped by one impact per beat, so a level demanding more
    // than that would quietly serve thinner bars than it claims.
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        for (const { rhythm } of generateRhythmRound(
          createRandom(seed),
          settings as RhythmRoundSpec,
        )) {
          expect(
            rhythm.onsets.length,
            `${id}: ${meterKey(rhythm.meter)} ${rhythm.onsets}`,
          ).toBeGreaterThanOrEqual(settings.minOnsets)
        }
      }
    }
  })

  it('generates bars that can be written down and read back', () => {
    // The failure a type cannot catch: a level whose cells produce a bar the
    // engraver cannot spell, which would be unanswerable however well heard.
    for (const { id, settings } of RHYTHM_DIFFICULTIES) {
      for (const { rhythm } of generateRhythmRound(
        createRandom(13),
        settings as RhythmRoundSpec,
      )) {
        expect(isValidRhythm(rhythm), `${id}: ${rhythm.onsets}`).toBe(true)
        expect(onsetsOf(notateRhythm(rhythm)), `${id}: ${rhythm.onsets}`).toEqual([
          ...rhythm.onsets,
        ])
      }
    }
  })
})

describe('rhythm dictation levels', () => {
  it('covers every subdivision somewhere', () => {
    const covered = new Set(
      RHYTHM_DIFFICULTIES.flatMap((level) =>
        CELL_GROUP_IDS.filter((group) => level.settings.cellWeights[group] > 0),
      ),
    )
    expect([...covered].sort()).toEqual([...CELL_GROUP_IDS].sort())
  })

  it('covers both ways of using the click', () => {
    // Counted in and then left alone is a different exercise from counted all
    // the way through, so there has to be at least one of each.
    const covered = new Set(RHYTHM_DIFFICULTIES.map((level) => level.settings.metronome))
    expect([...covered].sort()).toEqual(['count-in', 'throughout'])
  })

  it('offers a metre other than four four', () => {
    const meters = new Set(RHYTHM_DIFFICULTIES.flatMap((level) => level.settings.meters))
    expect(meters.size).toBeGreaterThan(1)
  })
})
