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
 * notes from outside the key come last of all. Only the very first level opens
 * every melody on the tonic.
 */
const FIRST_FIVE: readonly string[] = ['1', '2', '3', '4', '5']
const WHOLE_SCALE: readonly string[] = [...FIRST_FIVE, '6', '7']

export const DEGREE_DIFFICULTIES: readonly Difficulty<DegreeSettings>[] = [
  {
    id: 'tonic-and-fifth',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: ['1', '3', '5'],
      tonics: [...NATURAL_TONIC_KEYS],
      melodyLength: 3,
      // The only level that hands over the first note. A melody opening on
      // its tonic is a crutch real music does not offer — the tonic triad
      // before every question is anchor enough — so it is let go at once.
      startOnTonic: true,
    },
  },
  {
    id: 'first-five',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: FIRST_FIVE,
      tonics: [...NATURAL_TONIC_KEYS],
      melodyLength: 3,
    },
  },
  {
    id: 'whole-scale',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: WHOLE_SCALE,
      melodyLength: 3,
    },
  },
  {
    // Steps are octave-specific, so the sixth and seventh *under* the tonic
    // are their own keys: the leading note below is where half of all tunes
    // start, and it is a different note to hear from the seventh above.
    id: 'below-the-tonic',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: ['6_', '7_', ...FIRST_FIVE],
      melodyLength: 4,
    },
  },
  {
    id: 'minor',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['aeolian'],
      degrees: WHOLE_SCALE,
      melodyLength: 4,
    },
  },
  {
    id: 'harmonic-minor',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['harmonicMinor'],
      degrees: WHOLE_SCALE,
      melodyLength: 4,
    },
  },
  {
    id: 'longer-melodies',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: WHOLE_SCALE,
      melodyLength: 6,
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'outside-the-key',
    settings: {
      ...DEFAULT_SETTINGS,
      degrees: WHOLE_SCALE,
      alterations: true,
      melodyLength: 4,
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [
        'ionian',
        'dorian',
        'phrygian',
        'lydian',
        'mixolydian',
        'aeolian',
        'harmonicMinor',
      ],
      degrees: WHOLE_SCALE,
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      alterations: true,
      melodyLength: 5,
      questionsPerRound: 20,
    },
  },
]
