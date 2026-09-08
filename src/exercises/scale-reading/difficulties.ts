import type { Difficulty } from '@/exercises/shared/difficulty'
import { NATURAL_TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, type ScaleReadingSettings } from './settings'

/**
 * Levels for Scale Reading.
 *
 * Two axes, and they are independent: which modes are in play, and how far
 * round the circle of fifths the tonic sits. A scale on D♭ is not a harder
 * mode, it is more accidentals to hold in your head at once — and because the
 * staff is keyless, the tonic is what decides how much ink is on the page.
 *
 * "One Tonic" is the odd one out and the most useful: every mode on the same
 * D, so the only thing that can tell them apart is the pattern itself.
 */

const BRIGHT = ['lydian', 'ionian', 'mixolydian'] as const
const DARK = ['dorian', 'aeolian', 'phrygian', 'locrian'] as const
const FLAT_TONICS = ['F', 'Bb', 'Eb', 'Ab', 'Db'] as const
const SHARP_TONICS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const

export const SCALE_READING_DIFFICULTIES: readonly Difficulty<ScaleReadingSettings>[] = [
  {
    id: 'major-and-minor',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['ionian', 'aeolian'],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'bright-modes',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [...BRIGHT],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble', 'bass'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'dark-modes',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [...DARK],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble', 'bass'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'one-tonic',
    settings: {
      ...DEFAULT_SETTINGS,
      tonics: ['D'],
      clefs: ['treble', 'bass'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'flat-tonics',
    settings: {
      ...DEFAULT_SETTINGS,
      tonics: [...FLAT_TONICS],
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'sharp-tonics',
    settings: {
      ...DEFAULT_SETTINGS,
      tonics: [...SHARP_TONICS],
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'c-clefs',
    settings: {
      ...DEFAULT_SETTINGS,
      tonics: [...NATURAL_TONIC_KEYS, 'Bb', 'F#'],
      clefs: ['alto', 'tenor'],
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      questionsPerRound: 30,
    },
  },
]
