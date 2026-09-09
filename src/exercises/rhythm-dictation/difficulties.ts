import type { Difficulty } from '@/exercises/shared/difficulty'
import { NO_CELLS } from '@/lib/music/rhythmCells'

import { DEFAULT_SETTINGS, type RhythmSettings } from './settings'

/**
 * Levels for Rhythmic Dictation.
 *
 * The axis is **what the bar is divided into** — that is what makes a rhythm
 * hard to hear, far more than how many impacts are in it. After that come the
 * two other things that genuinely change the task: whether anything lands off
 * the beat, and whether the click keeps going underneath. A bar counted in and
 * then left alone has to be held against a pulse you are keeping yourself,
 * which is most of what dictation actually is.
 *
 * The metre is a level of its own rather than a difficulty step: 3/4 is not
 * harder than 4/4, it is a different bar to feel.
 */
export const RHYTHM_DIFFICULTIES: readonly Difficulty<RhythmSettings>[] = [
  {
    id: 'quarters',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 3 },
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'eighths',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 2, eighth: 5 },
      metronome: 'throughout',
      tempo: 80,
      minOnsets: 3,
    },
  },
  {
    id: 'off-the-beat',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 3, hold: 2, eighth: 4, offbeat: 5 },
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
      tempo: 60,
      minOnsets: 5,
    },
  },
  {
    id: 'triplets',
    settings: {
      ...DEFAULT_SETTINGS,
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 1, eighth: 3, triplet: 5 },
      tempo: 60,
      minOnsets: 4,
    },
  },
  {
    id: 'three-four',
    settings: {
      ...DEFAULT_SETTINGS,
      meters: ['3/4'],
      cellWeights: { ...NO_CELLS, quarter: 4, hold: 2, eighth: 4, sixteenth: 2 },
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'odd-meters',
    settings: {
      ...DEFAULT_SETTINGS,
      meters: ['2/4', '3/4', '5/4'],
      cellWeights: { ...NO_CELLS, quarter: 5, hold: 2, eighth: 4, offbeat: 1 },
      tempo: 80,
      minOnsets: 2,
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      meters: ['2/4', '3/4', '4/4', '5/4'],
      cellWeights: {
        ...NO_CELLS,
        quarter: 4,
        hold: 2,
        eighth: 4,
        offbeat: 2,
        sixteenth: 3,
        dotted: 2,
        triplet: 2,
        quintuplet: 1,
      },
      tempo: 60,
      allowInitialRest: true,
      minOnsets: 3,
      questionsPerRound: 20,
    },
  },
]
