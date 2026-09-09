import type { Difficulty } from '@/exercises/shared/difficulty'
import { NATURAL_TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, type DegreeSettings } from './settings'

/**
 * Levels for Scale Degrees.
 *
 * The axis is **which degrees are in play**, because that is what makes the
 * task hard: three notes around the tonic is a different exercise from all
 * seven, and telling the sixth from the seventh is the last thing to come. How
 * long the melody is comes second — it is memory rather than hearing — and
 * notes from outside the key come last of all.
 */
export const DEGREE_DIFFICULTIES: readonly Difficulty<DegreeSettings>[] = [
  {
    id: 'tonic-and-fifth',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 3, 5],
      tonics: [...NATURAL_TONIC_KEYS],
      melodyLength: 3,
    },
  },
  {
    id: 'first-five',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 2, 3, 4, 5],
      tonics: [...NATURAL_TONIC_KEYS],
      melodyLength: 3,
    },
  },
  {
    id: 'whole-scale',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 2, 3, 4, 5, 6, 7],
      melodyLength: 3,
    },
  },
  {
    id: 'minor',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['aeolian'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      melodyLength: 4,
    },
  },
  {
    id: 'no-anchor',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 2, 3, 4, 5, 6, 7],
      startOnTonic: false,
      melodyLength: 4,
    },
  },
  {
    id: 'longer-melodies',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 2, 3, 4, 5, 6, 7],
      melodyLength: 6,
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'outside-the-key',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: [1, 2, 3, 4, 5, 6, 7],
      alterations: true,
      melodyLength: 4,
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian'],
      degrees: [1, 2, 3, 4, 5, 6, 7],
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      alterations: true,
      startOnTonic: false,
      melodyLength: 5,
      questionsPerRound: 20,
    },
  },
]
