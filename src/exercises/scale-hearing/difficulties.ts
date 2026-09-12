import type { Difficulty } from '@/exercises/shared/difficulty'
import { NATURAL_TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, type ScaleHearingSettings } from './settings'

/**
 * Levels for Scale Hearing.
 *
 * The axis here is which modes are set against each other, because that is
 * what a mode is heard against. Lydian on its own is unmistakable; lydian
 * next to ionian is one raised note, and telling those two apart is a
 * different exercise from telling major from minor.
 *
 * Direction is the other axis: a mode falling from its octave is the same
 * seven notes and nothing like the same recognition.
 */

const MAJOR_FAMILY = ['ionian', 'lydian', 'mixolydian'] as const
const MINOR_FAMILY = ['aeolian', 'dorian', 'phrygian'] as const
/**
 * The three minors, which is the distinction an entrance exam actually asks
 * for. They share their first five notes exactly, so the whole of it is what
 * happens above the fifth — and it is why this level is ascending: melodic
 * minor coming down *is* natural minor, so a falling one would be two right
 * answers. `modeDirections` holds that, whatever a level asks for.
 */
const MINORS = ['aeolian', 'harmonicMinor', 'melodicMinor'] as const

export const SCALE_HEARING_DIFFICULTIES: readonly Difficulty<ScaleHearingSettings>[] = [
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
    id: 'major-family',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [...MAJOR_FAMILY],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'minor-family',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [...MINOR_FAMILY],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'altered-minors',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: [...MINORS],
      tonics: [...NATURAL_TONIC_KEYS],
      directions: ['ascending'],
      clefs: ['treble'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'flat-fifth',
    settings: {
      ...DEFAULT_SETTINGS,
      modes: ['phrygian', 'aeolian', 'locrian'],
      tonics: [...NATURAL_TONIC_KEYS],
      clefs: ['treble', 'bass'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'ascending',
    settings: {
      ...DEFAULT_SETTINGS,
      directions: ['ascending'],
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'descending',
    settings: {
      ...DEFAULT_SETTINGS,
      directions: ['descending'],
      clefs: ['treble', 'bass'],
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      directions: ['ascending', 'descending'],
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      questionsPerRound: 30,
    },
  },
]
