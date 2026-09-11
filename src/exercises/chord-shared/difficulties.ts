import type { Difficulty } from '@/exercises/shared/difficulty'
import { SEVENTH_QUALITIES, TRIAD_QUALITIES } from '@/lib/music/chord'
import { NATURAL_TONIC_KEYS, TONIC_KEYS } from '@/lib/music/scale'

import { DEFAULT_SETTINGS, type ChordSettings } from './settings'

/**
 * Levels for all three chord exercises.
 *
 * **One list, three exercises**, the way thoroughbass shares one across its two
 * directions: reading a chord, hearing one and writing one are the same ladder
 * climbed from three sides, and a level that means something on one of them
 * means the same thing on the others.
 *
 * The list comes in **runs** rather than one flat ladder — triads, then
 * sevenths, then the positions — because the vocabulary genuinely has stages:
 * you cannot hear a Quintsextakkord before you can hear a Sextakkord. Within a
 * run the rule at the top of `difficulty.ts` still holds: these are weaknesses
 * rather than rungs.
 *
 * Two axes move, never both at once: the **vocabulary** (which qualities) and
 * the **positions** (which inversions, and whether the Lage is asked). Clefs
 * and playback widen with them — treble alone at first, the C-clefs only at the
 * very top, and a block chord only once the arpeggio is easy, because a block
 * chord is the harder thing to take apart.
 */

/** Roots with at most one accidental to read past, once naturals are easy. */
const SIMPLE_ROOTS = [...NATURAL_TONIC_KEYS, 'Bb', 'Eb', 'F#']

export const CHORD_DIFFICULTIES: readonly Difficulty<ChordSettings>[] = [
  {
    id: 'major-minor',
    section: 'triads',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: ['major', 'minor'],
      inversions: [0],
      lage: false,
      roots: NATURAL_TONIC_KEYS,
      clefs: ['treble'],
      directions: ['ascending'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'all-triads',
    section: 'triads',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: [...TRIAD_QUALITIES],
      inversions: [0],
      lage: false,
      roots: SIMPLE_ROOTS,
      clefs: ['treble'],
      directions: ['ascending', 'descending'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'triad-inversions',
    section: 'triads',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: [...TRIAD_QUALITIES],
      inversions: [0, 1, 2],
      lage: false,
      roots: SIMPLE_ROOTS,
      clefs: ['treble', 'bass'],
      directions: ['ascending'],
      questionsPerRound: 20,
    },
  },
  {
    id: 'dominant-seventh',
    section: 'sevenths',
    settings: {
      ...DEFAULT_SETTINGS,
      // Against the two triads it is heard among, so the seventh is what is
      // being listened for rather than the only thing there is to say.
      qualities: ['major', 'minor', 'dominant-seventh'],
      inversions: [0],
      lage: false,
      roots: SIMPLE_ROOTS,
      clefs: ['treble'],
      directions: ['ascending'],
      questionsPerRound: 10,
    },
  },
  {
    id: 'all-sevenths',
    section: 'sevenths',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: [...SEVENTH_QUALITIES],
      inversions: [0],
      lage: false,
      roots: SIMPLE_ROOTS,
      clefs: ['treble', 'bass'],
      directions: ['ascending', 'harmonic'],
      questionsPerRound: 20,
    },
  },
  {
    id: 'seventh-inversions',
    section: 'sevenths',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: [...SEVENTH_QUALITIES],
      inversions: [0, 1, 2, 3],
      lage: false,
      roots: SIMPLE_ROOTS,
      clefs: ['treble', 'bass'],
      directions: ['harmonic'],
      questionsPerRound: 20,
    },
  },
  {
    id: 'lagen',
    section: 'positions',
    settings: {
      ...DEFAULT_SETTINGS,
      // Triads again, because the Lage is the new thing and the vocabulary
      // should not be. One axis at a time.
      qualities: [...TRIAD_QUALITIES],
      inversions: [0, 1, 2],
      lage: true,
      roots: SIMPLE_ROOTS,
      clefs: ['treble', 'bass'],
      directions: ['ascending', 'descending'],
      questionsPerRound: 20,
    },
  },
  {
    id: 'everything',
    section: 'positions',
    settings: {
      ...DEFAULT_SETTINGS,
      qualities: [...TRIAD_QUALITIES, ...SEVENTH_QUALITIES],
      inversions: [0, 1, 2, 3],
      lage: true,
      roots: TONIC_KEYS,
      // The C-clefs arrive here and nowhere earlier. They pay back across
      // every reading exercise the app has, and this is the level that is
      // meant to be uncomfortable.
      clefs: ['treble', 'bass', 'alto', 'tenor'],
      directions: ['harmonic'],
      questionsPerRound: 20,
    },
  },
]
