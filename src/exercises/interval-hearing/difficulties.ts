import type { Difficulty } from '@/exercises/shared/difficulty'
import { HEARABLE_INTERVAL_KEYS } from '@/lib/music/catalog'

import { DEFAULT_SETTINGS, type IntervalHearingSettings } from './settings'

/**
 * Levels for Interval Hearing.
 *
 * Hearing has different axes from reading: which intervals are in play, and
 * how they are sounded. Direction matters most — a descending sixth and an
 * ascending one are the same interval and nothing like the same skill — so
 * several levels differ only in that.
 *
 * Every interval set here is drawn from `HEARABLE_INTERVAL_KEYS`; two
 * spellings of one sound would make a question unanswerable.
 */

/** The unmistakable ones: nothing here is a step or a third apart. */
const OPEN = ['P1', 'P4', 'P5', 'P8'] as const
const THIRDS_AND_SIXTHS = ['m3', 'M3', 'm6', 'M6'] as const
const STEPS_AND_SEVENTHS = ['m2', 'M2', 'm7', 'M7'] as const

export const HEARING_DIFFICULTIES: readonly Difficulty<IntervalHearingSettings>[] = [
  {
    id: 'open-intervals',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...OPEN],
      directions: ['ascending'],
      clefs: ['treble'],
      keySignatures: ['0'],
      staffOnly: true,
      questionsPerRound: 10,
    },
  },
  {
    id: 'thirds-and-sixths',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...THIRDS_AND_SIXTHS],
      directions: ['ascending'],
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'steps-and-sevenths',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...STEPS_AND_SEVENTHS],
      directions: ['ascending'],
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'ascending',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...HEARABLE_INTERVAL_KEYS],
      directions: ['ascending'],
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
    },
  },
  {
    id: 'descending',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...HEARABLE_INTERVAL_KEYS],
      directions: ['descending'],
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
    },
  },
  {
    id: 'harmonic',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...HEARABLE_INTERVAL_KEYS],
      directions: ['harmonic'],
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      intervals: [...HEARABLE_INTERVAL_KEYS],
      directions: ['ascending', 'descending', 'harmonic'],
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      keySignatures: ['0', '2s', '2f'],
      questionsPerRound: 30,
    },
  },
]
