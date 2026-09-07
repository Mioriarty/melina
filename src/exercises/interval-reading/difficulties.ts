import type { Difficulty } from '@/exercises/shared/difficulty'
import { CATALOG_KEYS, DEFAULT_INTERVAL_KEYS } from '@/lib/music/catalog'

import { DEFAULT_SETTINGS, type IntervalReadingSettings } from './settings'

/**
 * Levels for Interval Reading.
 *
 * Reading is about spelling, so the levels move along three axes: which clefs
 * you have to read, how much the key signature is doing, and whether the
 * ambiguous augmented and diminished spellings are in play.
 */

/** The plain intervals, before any augmented or diminished ones. */
const SIMPLE = ['P1', 'M2', 'M3', 'P5', 'P8'] as const
const TRITONE_FOCUS = ['P4', 'A4', 'd5', 'P5'] as const

const SHARP_KEYS = ['0', '1s', '2s', '3s', '4s'] as const
const FLAT_KEYS = ['0', '1f', '2f', '3f', '4f'] as const
const ALL_KEYS = [
  '7f',
  '6f',
  '5f',
  '4f',
  '3f',
  '2f',
  '1f',
  '0',
  '1s',
  '2s',
  '3s',
  '4s',
  '5s',
  '6s',
  '7s',
] as const

export const READING_DIFFICULTIES: readonly Difficulty<IntervalReadingSettings>[] = [
  {
    id: 'first-steps',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble'],
      keySignatures: ['0'],
      intervals: [...SIMPLE],
      staffOnly: true,
      questionsPerRound: 10,
    },
  },
  {
    id: 'treble-and-bass',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
      intervals: [...DEFAULT_INTERVAL_KEYS],
    },
  },
  {
    id: 'ledger-lines',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass'],
      keySignatures: ['0'],
      intervals: [...DEFAULT_INTERVAL_KEYS],
      staffOnly: false,
      questionsPerRound: 20,
    },
  },
  {
    id: 'sharp-keys',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass'],
      keySignatures: [...SHARP_KEYS],
      intervals: [...DEFAULT_INTERVAL_KEYS],
    },
  },
  {
    id: 'flat-keys',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass'],
      keySignatures: [...FLAT_KEYS],
      intervals: [...DEFAULT_INTERVAL_KEYS],
    },
  },
  {
    id: 'c-clefs',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['alto', 'tenor'],
      keySignatures: ['0', '1s', '1f'],
      intervals: [...DEFAULT_INTERVAL_KEYS],
    },
  },
  {
    id: 'tritone',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass'],
      keySignatures: ['0', '2s', '2f'],
      intervals: [...TRITONE_FOCUS],
      questionsPerRound: 10,
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      keySignatures: [...ALL_KEYS],
      intervals: [...CATALOG_KEYS],
      questionsPerRound: 30,
    },
  },
]
