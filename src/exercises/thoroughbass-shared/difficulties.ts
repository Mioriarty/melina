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
 *
 * They come in **two runs**, because the vocabulary outgrew one list and a
 * second station on the path would have claimed that reading a ninth is a
 * different subject from reading a sixth. Within a run the rule above still
 * holds; between the runs the order is honest, since nothing in the second is
 * legible until the first is.
 */

const FOUNDATIONS = 'foundations'
const FURTHER = 'further'

const TRIADS = ['', '6', '6/4']
const SEVENTHS = ['7', '6/5', '4/3', '2']
const ALTERED = ['#6', 'b6', '6/#4', '6/b5', '#5', 'b5']
const AUGMENTED_SIXTHS = ['#6', '#6/b5', '#6/4/3']
const NINTHS = ['9', '9/7']
const SUSPENSIONS = ['4-3', '7-6', '9-8', '6-5']

export const THOROUGHBASS_DIFFICULTIES: readonly Difficulty<ThoroughbassSettings>[] = [
  {
    id: 'triads',
    section: FOUNDATIONS,
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6'] },
  },
  {
    id: 'six-four',
    section: FOUNDATIONS,
    settings: { ...DEFAULT_SETTINGS, figures: TRIADS },
  },
  {
    // The raised third — the dominant of every minor key, and the first figure
    // that is a sign rather than a number.
    id: 'accidentals',
    section: FOUNDATIONS,
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6', '#3', 'b3'] },
  },
  {
    id: 'sevenths',
    section: FOUNDATIONS,
    settings: { ...DEFAULT_SETTINGS, figures: ['', '6', '7'] },
  },
  {
    id: 'inverted-sevenths',
    section: FOUNDATIONS,
    settings: { ...DEFAULT_SETTINGS, figures: SEVENTHS },
  },
  {
    // Same vocabulary, more ink in front of it. A figure is read against the
    // signature, so the signature is a difficulty of its own.
    id: 'flat-keys',
    section: FOUNDATIONS,
    settings: {
      ...DEFAULT_SETTINGS,
      figures: [...TRIADS, ...SEVENTHS],
      keySignatures: ['1f', '2f', '3f', '4f'],
    },
  },
  {
    id: 'sharp-keys',
    section: FOUNDATIONS,
    settings: {
      ...DEFAULT_SETTINGS,
      figures: [...TRIADS, ...SEVENTHS],
      keySignatures: ['1s', '2s', '3s', '4s'],
    },
  },
  {
    id: 'everything',
    section: FOUNDATIONS,
    settings: {
      ...DEFAULT_SETTINGS,
      figures: ['', '6', '6/4', '#3', 'b3', 'n3', '7', '6/5', '4/3', '2'],
      keySignatures: ['0', '1s', '2s', '3s', '4s', '1f', '2f', '3f', '4f'],
    },
  },

  {
    // A sixth pushed out of the key either way — the first figure whose
    // accidental is on a number rather than standing alone.
    id: 'altered-sixths',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: ['6', '#6', 'b6'] },
  },
  {
    id: 'altered-fifths',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: ['', '#5', 'b5'] },
  },
  {
    id: 'augmented-fourths',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: ['6/4', '6/#4'] },
  },
  {
    // The shapes an augmented sixth is written with. Named for the figures
    // rather than for the chords, because a figure says which notes and never
    // what they are doing there.
    id: 'raised-sixths',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: AUGMENTED_SIXTHS },
  },
  {
    id: 'ninths',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: ['7', ...NINTHS] },
  },
  {
    // The first level in which a bass note carries more than one chord. Not a
    // harder figure but a wider question: the bass is held while the chord
    // over it moves, and the second figure writes only the line that moved.
    id: 'suspensions',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: [], suspensions: ['4-3', '7-6'] },
  },
  {
    id: 'more-suspensions',
    section: FURTHER,
    settings: { ...DEFAULT_SETTINGS, figures: [], suspensions: SUSPENSIONS },
  },
  {
    id: 'everything-further',
    section: FURTHER,
    settings: {
      ...DEFAULT_SETTINGS,
      figures: [...TRIADS, ...SEVENTHS, ...ALTERED, ...NINTHS],
      suspensions: SUSPENSIONS,
      keySignatures: ['0', '1s', '2s', '3s', '1f', '2f', '3f'],
    },
  },
]
