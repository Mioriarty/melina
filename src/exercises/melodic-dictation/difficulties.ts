import type { Difficulty } from '@/exercises/shared/difficulty'
import { NO_CELLS } from '@/lib/music/rhythmCells'
import { NATURAL_TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, type MelodySettings } from './settings'

/**
 * Levels for Melodic Dictation.
 *
 * The exercise has two axes and a ladder that moved both at once would be
 * unreadable — a player who missed a question would not know which half they
 * missed. So **each level moves one of them.** The rhythm is quarter notes
 * until the range has been opened out, and the range stays inside the first
 * five degrees until the rhythm has been subdivided.
 *
 * The first level is deliberately the easiest thing this exercise can ask: the
 * first five degrees, beats and held notes only, and the click running all the
 * way through. Everything to be heard there is *which note*, which is scale
 * degree identification with a bar around it — and that is the point, since
 * this is where the two halves meet.
 *
 * Nothing ships at four bars. See `BAR_COUNTS`: four systems is smaller than
 * anyone can read in the room the notation gets on a phone, so it stays a
 * Custom setting rather than a level that looks fine on the desk it was built
 * on.
 */
export const MELODY_DIFFICULTIES: readonly Difficulty<MelodySettings>[] = [
  {
    id: 'beats-and-steps',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 3 },
      tonics: [...NATURAL_TONIC_KEYS],
      low: '1',
      high: '5',
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'stepwise',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 2, eighth: 4 },
      tonics: [...NATURAL_TONIC_KEYS],
      low: '1',
      high: '5',
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'the-octave',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 2, eighth: 3 },
      low: '1',
      high: "1'",
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'below-the-tonic',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 2, eighth: 3 },
      low: '5_',
      high: '5',
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'off-the-beat',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 3, hold: 2, eighth: 4, offbeat: 5 },
      low: '1',
      high: '5',
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 3,
    },
  },
  {
    id: 'sixteenths',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: {
        ...NO_CELLS,
        quarter: 3,
        hold: 1,
        eighth: 4,
        sixteenth: 5,
        dotted: 2,
      },
      low: '1',
      high: '5',
      tempo: 60,
      minOnsets: 3,
    },
  },
  {
    id: 'minor',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['aeolian'],
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 2, eighth: 4 },
      low: '1',
      high: "1'",
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'two-bars',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 3, eighth: 3 },
      low: '1',
      high: '5',
      bars: 2,
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'triplets',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 1, eighth: 3, triplet: 5 },
      low: '1',
      high: '5',
      tempo: 60,
      minOnsets: 2,
    },
  },
  {
    id: 'three-four',
    settings: {
      ...DEFAULT_SETTINGS,
      meters: ['3/4'],
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 2, eighth: 4, sixteenth: 1 },
      low: '1',
      high: "1'",
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'outside-the-key',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 2, eighth: 3 },
      low: '1',
      high: "1'",
      alterations: true,
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian'],
      clefs: ['treble', 'bass'],
      meters: ['3/4', '4/4'],
      cellWeights: {
        quarter: 4,
        hold: 2,
        eighth: 4,
        offbeat: 2,
        sixteenth: 3,
        dotted: 2,
        triplet: 2,
        quintuplet: 1,
      },
      low: '5_',
      high: "1'",
      alterations: true,
      bars: 2,
      tempo: 60,
      minOnsets: 2,
      questionsPerRound: 20,
    },
  },
]
