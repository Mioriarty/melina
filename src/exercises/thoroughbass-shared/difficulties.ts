import type { Difficulty } from '@/exercises/shared/difficulty'

import { DEFAULT_SETTINGS, type ThoroughbassSettings } from './settings'

/**
 * The levels, shared by both directions.
 *
 * Reading a figure and writing one are the same ladder climbed from opposite
 * ends, so the rungs are the same rungs. What differs is only which half of the
 * page is blank, and that is the exercise rather than the level.
 *
 * **Each level moves one axis** — the figures, or the keys, never both. That is
 * the rule the melodic dictation levels already follow, and it is what makes a
 * level a diagnosis rather than a difficulty setting: "Sevenths" and "Flat
 * Keys" are not harder or easier than one another, they are different
 * weaknesses.
 */

const TRIADS = ['', '6', '6/4']
const SEVENTHS = ['7', '6/5', '4/3', '2']

export const THOROUGHBASS_DIFFICULTIES: readonly Difficulty<ThoroughbassSettings>[] = [
  {
    id: 'triads',
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6'] },
  },
  {
    id: 'six-four',
    settings: { ...DEFAULT_SETTINGS, figures: TRIADS },
  },
  {
    // The raised third — the dominant of every minor key, and the first figure
    // that is a sign rather than a number.
    id: 'accidentals',
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6', '#3', 'b3'] },
  },
  {
    id: 'sevenths',
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6', '7'] },
  },
  {
    id: 'inverted-sevenths',
    settings: { ...DEFAULT_SETTINGS, figures: SEVENTHS },
  },
  {
    // Same vocabulary, more ink in front of it. A figure is read against the
    // signature, so the signature is a difficulty of its own.
    id: 'flat-keys',
    settings: {
      ...DEFAULT_SETTINGS,
      figures: [...TRIADS, ...SEVENTHS],
      keySignatures: ['1f', '2f', '3f', '4f'],
    },
  },
  {
    id: 'sharp-keys',
    settings: {
      ...DEFAULT_SETTINGS,
      figures: [...TRIADS, ...SEVENTHS],
      keySignatures: ['1s', '2s', '3s', '4s'],
    },
  },
  {
    id: 'everything',
    settings: {
      ...DEFAULT_SETTINGS,
      figures: ['', '6', '6/4', '#3', 'b3', 'n3', '7', '6/5', '4/3', '2'],
      keySignatures: ['0', '1s', '2s', '3s', '4s', '1f', '2f', '3f', '4f'],
    },
  },
]
