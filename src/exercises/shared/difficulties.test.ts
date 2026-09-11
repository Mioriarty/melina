import { describe, expect, it } from 'vitest'

import { CHORD_DIFFICULTIES } from '@/exercises/chord-shared/difficulties'
import {
  generateRound as generateChordRound,
  type ChordRoundSpec,
} from '@/exercises/chord-shared/generate'
import {
  INVERSION_CHOICES,
  QUALITY_CHOICES,
  ROOT_CHOICES,
  parseChordSettings,
} from '@/exercises/chord-shared/settings'
import { CHORD_READING_SETTINGS } from '@/exercises/chord-reading/settings'
import { isChordQuality } from '@/lib/music/chord'
import { HEARING_DIFFICULTIES } from '@/exercises/interval-hearing/difficulties'
import { INTERVAL_HEARING_SETTINGS } from '@/exercises/interval-hearing/settings'
import { READING_DIFFICULTIES } from '@/exercises/interval-reading/difficulties'
import {
  INTERVAL_READING_SETTINGS,
  READING_DIRECTIONS,
} from '@/exercises/interval-reading/settings'
import { generateRound, type RoundSpec } from '@/exercises/interval-shared/generate'
import { MELODY_DIFFICULTIES } from '@/exercises/melodic-dictation/difficulties'
import {
  allowedSteps,
  generateRound as generateMelodyRound,
  type MelodyRoundSpec,
} from '@/exercises/melodic-dictation/generate'
import { MELODY_SETTINGS, MAX_STEPS } from '@/exercises/melodic-dictation/settings'
import { RHYTHM_DIFFICULTIES } from '@/exercises/rhythm-dictation/difficulties'
import {
  generateRound as generateRhythmRound,
  type RhythmRoundSpec,
} from '@/exercises/rhythm-dictation/generate'
import { RHYTHM_SETTINGS } from '@/exercises/rhythm-dictation/settings'
import { DEGREE_DIFFICULTIES } from '@/exercises/scale-degrees/difficulties'
import {
  generateRound as generateDegreeRound,
  type DegreeRoundSpec,
} from '@/exercises/scale-degrees/generate'
import { DEGREE_SETTINGS } from '@/exercises/scale-degrees/settings'
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
import { FIGURING_SETTINGS } from '@/exercises/thoroughbass-figuring/settings'
import { REALIZING_SETTINGS } from '@/exercises/thoroughbass-realizing/settings'
import { THOROUGHBASS_DIFFICULTIES } from '@/exercises/thoroughbass-shared/difficulties'
import {
  acceptsFigure,
  generateRound as generateFiguredRound,
} from '@/exercises/thoroughbass-shared/generate'
import {
  FIGURE_CHOICES,
  SUSPENSION_CHOICES,
} from '@/exercises/thoroughbass-shared/settings'
import { figureKey, figurePitches } from '@/lib/music/figuredBass'
import { i18n } from '@/lib/i18n'
import { LANGUAGES } from '@/lib/i18n/languages'
import { CATALOG_KEYS, HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'
import { isClefId } from '@/lib/music/clef'
import { chromaticValue } from '@/lib/music/pitch'
import { isKeySignatureId } from '@/lib/music/keySignature'
import {
  DEGREE_NUMBERS,
  degreeKey,
  degreePitch,
  keySignatureFor,
  parseDegreeKey,
  stepIndex,
} from '@/lib/music/degree'
import { isMeterKey, meterKey, parseMeter } from '@/lib/music/meter'
import { barRhythm, impactCount, opensOnDownbeat } from '@/lib/music/phrase'
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
  difficultySectionKey,
  difficultyTitleKey,
  levelRuns,
  type DifficultyGroup,
} from './difficulty'

/**
 * Levels are data, and data can be wrong in ways a type cannot catch: a
 * misspelled interval key, a clef that does not exist, or a combination that
 * generates no questions at all and drops the player straight back out.
 */

interface NamedLevels {
  group: DifficultyGroup
  levels: readonly { id: string; section?: string }[]
}

const ALL_GROUPS: readonly NamedLevels[] = [
  { group: 'interval-reading', levels: READING_DIFFICULTIES },
  { group: 'interval-hearing', levels: HEARING_DIFFICULTIES },
  { group: 'scale-reading', levels: SCALE_READING_DIFFICULTIES },
  { group: 'scale-hearing', levels: SCALE_HEARING_DIFFICULTIES },
  { group: 'rhythm-dictation', levels: RHYTHM_DIFFICULTIES },
  { group: 'scale-degrees', levels: DEGREE_DIFFICULTIES },
  { group: 'melodic-dictation', levels: MELODY_DIFFICULTIES },
  { group: 'thoroughbass-figuring', levels: THOROUGHBASS_DIFFICULTIES },
  { group: 'thoroughbass-realizing', levels: THOROUGHBASS_DIFFICULTIES },
  { group: 'chord-reading', levels: CHORD_DIFFICULTIES },
  { group: 'chord-hearing', levels: CHORD_DIFFICULTIES },
  { group: 'chord-writing', levels: CHORD_DIFFICULTIES },
]

describe.each(ALL_GROUPS)('$group levels', ({ group, levels }) => {
  it('offers at least six, before Custom', () => {
    expect(levels.length).toBeGreaterThanOrEqual(6)
  })

  it('has a unique id', () => {
    expect(new Set(levels.map((level) => level.id)).size).toBe(levels.length)
  })

  it('keeps each section in one run, and names it in every language', () => {
    // A section split in two would render as two headings with the same name,
    // which reads as two different things — and `levelRuns` preserves the
    // order the list is written in rather than sorting it, so the list itself
    // is the only place that can go wrong.
    const seen: string[] = []
    for (const level of levels) {
      const section = level.section
      if (section === undefined) continue
      if (seen[seen.length - 1] !== section) {
        expect(seen, `${section} is split into two runs`).not.toContain(section)
        seen.push(section)
      }
    }

    for (const { id: language } of LANGUAGES) {
      const t = i18n.getFixedT(language)
      for (const section of seen) {
        const key = difficultySectionKey(group, section)
        expect(t(key), `${language}: ${key}`).not.toBe(key)
      }
    }
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

/* --------------------------------------------------------------- degrees */

describe('scale-degrees settings', () => {
  it('only names modes, tonics, clefs and degrees that exist', () => {
    for (const { id, settings } of DEGREE_DIFFICULTIES) {
      expect(settings.modes.length, id).toBeGreaterThan(0)
      expect(settings.tonics.length, id).toBeGreaterThan(0)
      expect(settings.clefs.length, id).toBeGreaterThan(0)
      expect(settings.degrees.length, id).toBeGreaterThan(0)

      for (const mode of settings.modes)
        expect(isModeId(mode), `${id}: ${mode}`).toBe(true)
      for (const tonic of settings.tonics) {
        expect(isTonicKey(tonic), `${id}: ${tonic}`).toBe(true)
      }
      for (const clef of settings.clefs)
        expect(isClefId(clef), `${id}: ${clef}`).toBe(true)
      for (const degree of settings.degrees) {
        expect(DEGREE_NUMBERS, `${id}: ${degree}`).toContain(degree)
      }
    }
  })

  it('survives being stored and read back unchanged', () => {
    for (const { id, settings } of DEGREE_DIFFICULTIES) {
      expect(DEGREE_SETTINGS.parse(JSON.parse(JSON.stringify(settings))), id).toEqual(
        settings,
      )
    }
  })

  it('actually generates a full round', () => {
    // The failure a type cannot catch: a level whose modes will not spell on
    // any of its tonics, or whose scale fits no clef, serving a short round.
    for (const { id, settings } of DEGREE_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        const round = generateDegreeRound(createRandom(seed), settings as DegreeRoundSpec)
        expect(round.length, `${id} (seed ${seed})`).toBe(settings.questionsPerRound)
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const { id, settings } of DEGREE_DIFFICULTIES) {
      for (const question of generateDegreeRound(
        createRandom(7),
        settings as DegreeRoundSpec,
      )) {
        expect(settings.modes, id).toContain(question.mode)
        expect(settings.clefs, id).toContain(question.clef)
        expect(question.degrees.length, id).toBe(settings.melodyLength)
        for (const degree of question.degrees) {
          expect(settings.degrees, `${id}: degree ${degree.number}`).toContain(
            degree.number,
          )
          if (!settings.alterations) expect(degree.alteration, id).toBe(0)
        }
      }
    }
  })

  it('can write down every question it asks', () => {
    // A key with no signature, or a degree that needs a triple accidental,
    // would be unanswerable however well it was heard.
    for (const { id, settings } of DEGREE_DIFFICULTIES) {
      for (const question of generateDegreeRound(
        createRandom(13),
        settings as DegreeRoundSpec,
      )) {
        expect(keySignatureFor(question.tonic, question.mode), id).toBe(
          question.keySignature,
        )
        for (const degree of question.degrees) {
          expect(degreePitch(question.tonic, question.mode, degree), id).toBeDefined()
        }
      }
    }
  })
})

describe('scale degree levels', () => {
  it('starts inside the chord and ends on the whole scale', () => {
    const smallest = Math.min(
      ...DEGREE_DIFFICULTIES.map((l) => l.settings.degrees.length),
    )
    const largest = Math.max(...DEGREE_DIFFICULTIES.map((l) => l.settings.degrees.length))

    expect(smallest).toBeLessThanOrEqual(3)
    expect(largest).toBe(DEGREE_NUMBERS.length)
  })

  it('has a level that stays in the key and one that leaves it', () => {
    expect(DEGREE_DIFFICULTIES.some((level) => level.settings.alterations)).toBe(true)
    expect(DEGREE_DIFFICULTIES.some((level) => !level.settings.alterations)).toBe(true)
  })

  it('has a level that gives the tonic away and one that does not', () => {
    expect(DEGREE_DIFFICULTIES.some((level) => level.settings.startOnTonic)).toBe(true)
    expect(DEGREE_DIFFICULTIES.some((level) => !level.settings.startOnTonic)).toBe(true)
  })

  it('covers major and minor somewhere', () => {
    const modes = new Set(DEGREE_DIFFICULTIES.flatMap((level) => level.settings.modes))
    expect(modes.has('ionian')).toBe(true)
    expect(modes.has('aeolian')).toBe(true)
  })
})

/* --------------------------------------------------------------- melodies */

describe('melodic-dictation settings', () => {
  it('only names modes, tonics, clefs, metres and cell groups that exist', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      expect(settings.modes.length, id).toBeGreaterThan(0)
      expect(settings.tonics.length, id).toBeGreaterThan(0)
      expect(settings.clefs.length, id).toBeGreaterThan(0)
      expect(settings.meters.length, id).toBeGreaterThan(0)

      for (const mode of settings.modes)
        expect(isModeId(mode), `${id}: ${mode}`).toBe(true)
      for (const tonic of settings.tonics) {
        expect(isTonicKey(tonic), `${id}: ${tonic}`).toBe(true)
      }
      for (const clef of settings.clefs)
        expect(isClefId(clef), `${id}: ${clef}`).toBe(true)
      for (const meter of settings.meters) {
        expect(isMeterKey(meter), `${id}: ${meter}`).toBe(true)
      }
      for (const group of Object.keys(settings.cellWeights)) {
        expect(isCellGroupId(group), `${id}: ${group}`).toBe(true)
      }
      expect(
        CELL_GROUP_IDS.some((group) => settings.cellWeights[group] > 0),
        `${id} allows no cells`,
      ).toBe(true)
    }
  })

  it('names a range that runs upwards and fits on a keyboard', () => {
    // The range *is* the key count, so one that is inverted or absurdly wide
    // is a keyboard that cannot be laid out rather than a level that is merely
    // hard.
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      const low = parseDegreeKey(settings.low)
      const high = parseDegreeKey(settings.high)
      expect(low, `${id}: ${settings.low}`).toBeDefined()
      expect(high, `${id}: ${settings.high}`).toBeDefined()

      const span = stepIndex(high!) - stepIndex(low!)
      expect(span, `${id} range runs downwards`).toBeGreaterThanOrEqual(1)
      expect(span + 1, `${id} range is too wide for a keyboard`).toBeLessThanOrEqual(
        MAX_STEPS,
      )
    }
  })

  it('asks for fewer impacts per bar than the shortest bar has beats', () => {
    // A floor at or above the beat count is not a floor but a demand that
    // every beat be struck, and the level then cannot deliver the held notes
    // it declares. The floor is per bar, so it is read against the shortest
    // metre the level offers.
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      const shortest = Math.min(
        ...settings.meters.map((key) => parseMeter(key)?.beats ?? Infinity),
      )
      expect(settings.minOnsets, `${id} in ${shortest} beats`).toBeLessThan(shortest)
    }
  })

  it('survives being stored and read back unchanged', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      expect(MELODY_SETTINGS.parse(JSON.parse(JSON.stringify(settings))), id).toEqual(
        settings,
      )
    }
  })

  it('actually generates a full round', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        const round = generateMelodyRound(createRandom(seed), settings as MelodyRoundSpec)
        expect(round.length, `${id} (seed ${seed})`).toBe(settings.questionsPerRound)
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      const steps = allowedSteps(settings as MelodyRoundSpec)
      const lowest = steps[0]
      const highest = steps[steps.length - 1]

      for (const question of generateMelodyRound(
        createRandom(7),
        settings as MelodyRoundSpec,
      )) {
        expect(settings.modes, id).toContain(question.mode)
        expect(settings.clefs, id).toContain(question.clef)
        expect(settings.meters, id).toContain(meterKey(question.phrase.meter))
        expect(question.phrase.bars.length, id).toBe(settings.bars)
        expect(question.tempo, id).toBe(settings.tempo)

        // **Checked by sound, not by name.** A chromatic note is spelled as
        // whichever neighbouring degree the line is heading towards, so its
        // printed number can sit outside the range even though the note it
        // names does not — ♯7 and ♭1 of the octave are one sound. The bound
        // the level actually promises is the one `stepNotes` enforces: no note
        // below its lowest step or above its highest.
        const floor = degreePitch(question.tonic, question.mode, lowest!)!
        const ceiling = degreePitch(question.tonic, question.mode, highest!)!

        for (const [index, degree] of question.degrees.entries()) {
          if (!settings.alterations) expect(degree.alteration, id).toBe(0)

          const sounding = chromaticValue(question.pitches[index]!)
          expect(
            sounding,
            `${id}: ${degreeKey(degree)} sits below the range`,
          ).toBeGreaterThanOrEqual(chromaticValue(floor))
          expect(
            sounding,
            `${id}: ${degreeKey(degree)} sits above the range`,
          ).toBeLessThanOrEqual(chromaticValue(ceiling))
        }
      }
    }
  })

  it('always gives the first note somewhere to sit, and something to ask after it', () => {
    // The first note is shown, so beat one of bar one must be struck — and a
    // phrase whose only impact was the one being given away would answer
    // itself the moment it appeared.
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      for (const seed of [1, 2, 3]) {
        for (const question of generateMelodyRound(
          createRandom(seed),
          settings as MelodyRoundSpec,
        )) {
          expect(opensOnDownbeat(question.phrase), id).toBe(true)
          expect(impactCount(question.phrase), id).toBeGreaterThan(1)
        }
      }
    }
  })

  it('gives every impact exactly one note', () => {
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      for (const question of generateMelodyRound(
        createRandom(13),
        settings as MelodyRoundSpec,
      )) {
        expect(question.pitches.length, id).toBe(impactCount(question.phrase))
        expect(question.degrees.length, id).toBe(question.pitches.length)
      }
    }
  })

  it('can write down every phrase it asks', () => {
    // A bar the engraver cannot spell, or a degree needing a triple
    // accidental, would be unanswerable however well it was heard.
    for (const { id, settings } of MELODY_DIFFICULTIES) {
      for (const question of generateMelodyRound(
        createRandom(13),
        settings as MelodyRoundSpec,
      )) {
        expect(keySignatureFor(question.tonic, question.mode), id).toBe(
          question.keySignature,
        )
        for (const degree of question.degrees) {
          expect(degreePitch(question.tonic, question.mode, degree), id).toBeDefined()
        }
        for (let bar = 0; bar < question.phrase.bars.length; bar += 1) {
          const rhythm = barRhythm(question.phrase, bar)
          expect(isValidRhythm(rhythm), `${id}: ${rhythm.onsets}`).toBe(true)
          expect(onsetsOf(notateRhythm(rhythm)), `${id}: ${rhythm.onsets}`).toEqual([
            ...rhythm.onsets,
          ])
        }
      }
    }
  })
})

describe('melodic dictation levels', () => {
  it('covers every subdivision somewhere', () => {
    const covered = new Set(
      MELODY_DIFFICULTIES.flatMap((level) =>
        CELL_GROUP_IDS.filter((group) => level.settings.cellWeights[group] > 0),
      ),
    )
    expect([...covered].sort()).toEqual([...CELL_GROUP_IDS].sort())
  })

  it('starts with beats and the first five degrees', () => {
    // The first level has to be the easiest thing this exercise can ask, or
    // the two halves arrive at once and a miss says nothing about which.
    const [first] = MELODY_DIFFICULTIES
    expect(first).toBeDefined()
    expect(first!.settings.bars).toBe(1)
    expect(first!.settings.alterations).toBe(false)
    expect(
      CELL_GROUP_IDS.filter((group) => first!.settings.cellWeights[group] > 0).sort(),
    ).toEqual(['hold', 'quarter'])
  })

  it('has a level that reaches below the tonic and one that reaches above it', () => {
    const rungs = MELODY_DIFFICULTIES.map((level) => ({
      low: stepIndex(parseDegreeKey(level.settings.low)!),
      high: stepIndex(parseDegreeKey(level.settings.high)!),
    }))
    expect(Math.min(...rungs.map((range) => range.low))).toBeLessThan(0)
    // Past the seventh, which is where the octave above the tonic starts.
    expect(Math.max(...rungs.map((range) => range.high))).toBeGreaterThanOrEqual(7)
  })

  it('has a level that stays in the key and one that leaves it', () => {
    expect(MELODY_DIFFICULTIES.some((level) => level.settings.alterations)).toBe(true)
    expect(MELODY_DIFFICULTIES.some((level) => !level.settings.alterations)).toBe(true)
  })

  it('covers both ways of using the click', () => {
    const covered = new Set(MELODY_DIFFICULTIES.map((level) => level.settings.metronome))
    expect([...covered].sort()).toEqual(['count-in', 'throughout'])
  })

  it('offers more than one bar somewhere, and never the four-bar page', () => {
    // Four bars is four systems, which is smaller than anyone can read in the
    // room the notation gets on a phone. It stays a Custom setting.
    const counts = new Set(MELODY_DIFFICULTIES.map((level) => level.settings.bars))
    expect(counts.has(2)).toBe(true)
    expect(counts.has(4)).toBe(false)
  })

  it('offers a metre other than four four', () => {
    const meters = new Set(MELODY_DIFFICULTIES.flatMap((level) => level.settings.meters))
    expect(meters.size).toBeGreaterThan(1)
  })

  it('covers both melodic shapes, and is mostly paced', () => {
    // Paced is what keeps a run of sixteenths singable, so it is the rule
    // nearly everywhere; the one steady level is what the other shape is for,
    // and without it the option would be reachable only from Custom.
    const shapes = MELODY_DIFFICULTIES.map((level) => level.settings.shape)
    expect(new Set(shapes)).toEqual(new Set(['paced', 'steady']))
    expect(shapes.filter((shape) => shape === 'steady')).toHaveLength(1)
  })
})

/**
 * Thoroughbass levels.
 *
 * Both directions share one list, because reading a figure and writing one are
 * the same ladder climbed from opposite ends. They are checked twice all the
 * same — once under each exercise's own settings parser, since that is the
 * thing that could quietly differ.
 */
describe.each([
  { direction: 'figuring', spec: FIGURING_SETTINGS },
  { direction: 'realizing', spec: REALIZING_SETTINGS },
] as const)('thoroughbass $direction levels', ({ spec }) => {
  it.each(THOROUGHBASS_DIFFICULTIES)('$id names real figures and keys', (level) => {
    for (const key of level.settings.keySignatures) {
      expect(isKeySignatureId(key), key).toBe(true)
    }
    for (const figure of level.settings.figures) {
      expect(FIGURE_CHOICES, figure).toContain(figure)
    }
    for (const suspension of level.settings.suspensions) {
      expect(SUSPENSION_CHOICES, suspension).toContain(suspension)
    }
    // A level may be nothing but suspensions, but it has to ask *something*.
    expect(
      level.settings.figures.length + level.settings.suspensions.length,
    ).toBeGreaterThan(0)
    expect(level.settings.events).toBeGreaterThanOrEqual(1)
  })

  it.each(THOROUGHBASS_DIFFICULTIES)('$id survives its own settings parser', (level) => {
    // A level is written by hand and then read back through the parser that
    // guards against a stale stored value. If the two disagree, picking the
    // level and reloading the page give different rounds.
    const raw = JSON.parse(JSON.stringify(level.settings)) as unknown
    expect(spec.parse(raw)).toEqual(level.settings)
  })

  it.each(THOROUGHBASS_DIFFICULTIES)('$id generates a full round', (level) => {
    for (const seed of [1, 2, 3]) {
      const round = generateFiguredRound(createRandom(seed), level.settings)
      expect(round.length, `seed ${seed}`).toBe(level.settings.questionsPerRound)
    }
  })

  it.each(THOROUGHBASS_DIFFICULTIES)('$id only asks answerable questions', (level) => {
    // **The one that matters under canonical-required grading.** A question
    // whose figure is not one of the conventional ways to write its own chord
    // is a question whose right answer is marked wrong, and nothing about the
    // types would say so.
    //
    // Held to `acceptsFigure` rather than to a second reading of the rules:
    // that is the function the exercise actually grades with, so a question it
    // would reject is a question that is wrong however the rules are read.
    for (const seed of [1, 2, 3]) {
      for (const question of generateFiguredRound(createRandom(seed), level.settings)) {
        question.events.forEach((event, index) => {
          expect(event.notes).toHaveLength(event.figures.length)
          expect(event.chords).toHaveLength(event.figures.length)

          event.figures.forEach((figure, position) => {
            expect(figurePitches(event.bass, question.keySignature, figure)).toEqual(
              event.notes[position],
            )
            expect(
              acceptsFigure(question, index, position, figure),
              `${figureKey(figure)} on ${question.keySignature}`,
            ).toBe(true)
          })
        })
      }
    }
  })

  it('covers the triads, the sevenths and an accidental across the level list', () => {
    const offered = new Set(THOROUGHBASS_DIFFICULTIES.flatMap((l) => l.settings.figures))
    for (const figure of ['', '6', '6/4', '7', '6/5', '4/3', '2', '#3']) {
      expect(offered, figure).toContain(figure)
    }
  })

  it('covers every suspension it offers, somewhere in the list', () => {
    const offered = new Set(
      THOROUGHBASS_DIFFICULTIES.flatMap((level) => level.settings.suspensions),
    )
    expect([...offered].sort()).toEqual([...SUSPENSION_CHOICES].sort())
  })
})

describe('level runs', () => {
  it('keeps every level, in the order it was written', () => {
    // `levelRuns` is what the levels screen renders from, so a level dropped
    // or reordered here is a level the player cannot reach.
    for (const { levels } of ALL_GROUPS) {
      const flattened = levelRuns(levels).flatMap((run) =>
        run.levels.map(({ level, index }) => ({ id: level.id, index })),
      )
      expect(flattened.map((entry) => entry.id)).toEqual(levels.map((level) => level.id))
      // The index is what the accuracy for a level is looked up by, so it has
      // to stay the level's place in the whole list and not in its run.
      expect(flattened.map((entry) => entry.index)).toEqual(levels.map((_, i) => i))
    }
  })

  it('leaves a list with no sections as one unnamed run', () => {
    // Which is every exercise but thoroughbass, and they must render exactly
    // as they always did — no heading at all.
    const plain = ALL_GROUPS.find(({ levels }) =>
      levels.every((level) => level.section === undefined),
    )
    expect(plain, 'no unsectioned level list left to check').toBeDefined()
    const runs = levelRuns(plain?.levels ?? [])
    expect(runs).toHaveLength(1)
    expect(runs[0]?.section).toBeUndefined()
  })
})

/* ----------------------------------------------------------------- chords */

describe('chord settings', () => {
  it('only names qualities, inversions, roots and clefs that exist', () => {
    for (const { id, settings } of CHORD_DIFFICULTIES) {
      expect(settings.qualities.length, id).toBeGreaterThan(0)
      expect(settings.inversions.length, id).toBeGreaterThan(0)
      expect(settings.roots.length, id).toBeGreaterThan(0)
      expect(settings.clefs.length, id).toBeGreaterThan(0)
      expect(settings.directions.length, id).toBeGreaterThan(0)

      for (const quality of settings.qualities) {
        expect(isChordQuality(quality), `${id}: ${quality}`).toBe(true)
        expect(QUALITY_CHOICES, id).toContain(quality)
      }
      for (const inversion of settings.inversions) {
        expect(INVERSION_CHOICES, `${id}: ${inversion}`).toContain(inversion)
      }
      for (const root of settings.roots) {
        expect(ROOT_CHOICES, `${id}: ${root}`).toContain(root)
      }
      for (const clef of settings.clefs) expect(isClefId(clef), id).toBe(true)
    }
  })

  it('survives being stored and read back unchanged', () => {
    // A level is settings, and settings go through Dexie. A preset the
    // defensive parser would quietly rewrite is a level that means one thing
    // on the list and another in the round.
    for (const level of CHORD_DIFFICULTIES) {
      expect(parseChordSettings(level.settings), level.id).toEqual(level.settings)
      expect(CHORD_READING_SETTINGS.parse(level.settings), level.id).toEqual(
        level.settings,
      )
    }
  })

  it('actually generates a full round, read and heard alike', () => {
    for (const level of CHORD_DIFFICULTIES) {
      for (const byEar of [false, true]) {
        const spec: ChordRoundSpec = {
          ...level.settings,
          byEar,
          namesRoot: !byEar,
        }
        const round = generateChordRound(createRandom(4242), spec)
        expect(round.length, `${level.id} byEar=${byEar}`).toBe(
          level.settings.questionsPerRound,
        )
      }
    }
  })

  it('asks only what the level allows', () => {
    for (const level of CHORD_DIFFICULTIES) {
      const spec: ChordRoundSpec = {
        ...level.settings,
        byEar: false,
        namesRoot: true,
      }
      for (const question of generateChordRound(createRandom(99), spec)) {
        expect(level.settings.qualities, level.id).toContain(question.chord.quality)
        expect(level.settings.clefs, level.id).toContain(question.clef)
        expect(level.settings.directions, level.id).toContain(question.direction)
        // The inversion may fall back to root position where the level names
        // one no quality of its has, which is the only widening there is.
        expect(
          level.settings.inversions.includes(question.chord.inversion) ||
            question.chord.inversion === 0,
          level.id,
        ).toBe(true)
      }
    }
  })

  it('covers every quality, every inversion and both kinds of playback somewhere', () => {
    const qualities = new Set(CHORD_DIFFICULTIES.flatMap((l) => l.settings.qualities))
    const inversions = new Set(CHORD_DIFFICULTIES.flatMap((l) => l.settings.inversions))
    const directions = new Set(CHORD_DIFFICULTIES.flatMap((l) => l.settings.directions))
    const clefs = new Set(CHORD_DIFFICULTIES.flatMap((l) => l.settings.clefs))

    for (const quality of QUALITY_CHOICES) expect(qualities).toContain(quality)
    for (const inversion of INVERSION_CHOICES) expect(inversions).toContain(inversion)
    // A block chord is the hard one and an arpeggio the way in, so both have
    // to be somewhere on the ladder.
    expect(directions).toContain('harmonic')
    expect(directions).toContain('ascending')
    expect(clefs.size).toBe(4)
    // And the Lage is asked somewhere, or the row would never be seen.
    expect(CHORD_DIFFICULTIES.some((level) => level.settings.lage)).toBe(true)
  })
})
