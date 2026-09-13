import type { Difficulty } from '@/exercises/shared/difficulty'
import {
  DEFAULT_SETTINGS,
  type HarmonySettings,
} from '@/exercises/harmony-shared/settings'

/**
 * The levels, and the two runs they come in.
 *
 * **Weaknesses rather than rungs**, as everywhere else here: the Trugschluss
 * level is not harder than the plain cadences one, it is a different thing to
 * miss. Between the two *sections* the order is honest, though, because
 * nothing in the second is audible until the first is — you cannot hear a
 * secondary dominant as a borrowed chord until you can hear where the key is.
 *
 * A level's vocabulary is named one Satztechnik at a time. That is what lets
 * "Trugschluss only" exist as a level at all, and it is why the setting is a
 * list of ids rather than a switch per family.
 */

const MAJOR: readonly string[] = [
  'C:ionian',
  'G:ionian',
  'F:ionian',
  'D:ionian',
  'Bb:ionian',
]
const MINOR: readonly string[] = ['A:aeolian', 'E:aeolian', 'D:aeolian', 'G:aeolian']
const BOTH: readonly string[] = [...MAJOR, ...MINOR]

const level = (
  id: string,
  section: string,
  settings: Partial<HarmonySettings>,
): Difficulty<HarmonySettings> => ({
  id,
  section,
  settings: { ...DEFAULT_SETTINGS, ...settings },
})

export const BASS_DIFFICULTIES: readonly Difficulty<HarmonySettings>[] = [
  level('erste-schritte', 'diatonik', {
    keys: ['C:ionian', 'G:ionian', 'F:ionian'],
    chords: [4],
    cadences: ['ganzschluss-vollkommen', 'halbschluss'],
    blocks: [],
    freedom: 'free',
    tempo: 56,
  }),
  level('dur', 'diatonik', {
    keys: MAJOR,
    chords: [5, 6],
    cadences: [
      'ganzschluss-vollkommen',
      'ganzschluss-unvollkommen',
      'halbschluss',
      'plagalschluss',
    ],
    blocks: ['tonika-prolongation', 'tonika-sextakkord', 'subdominant-prolongation'],
  }),
  level('moll', 'diatonik', {
    keys: MINOR,
    chords: [5, 6],
    cadences: [
      'ganzschluss-vollkommen',
      'halbschluss',
      'phrygischer-halbschluss',
      'trugschluss',
    ],
    blocks: ['tonika-prolongation', 'subdominant-prolongation'],
  }),
  level('trugschluss', 'diatonik', {
    keys: BOTH,
    chords: [5, 6],
    cadences: ['trugschluss', 'ganzschluss-vollkommen'],
    blocks: ['tonika-prolongation', 'dominant-prolongation'],
  }),
  level('quartsext', 'diatonik', {
    keys: BOTH,
    chords: [5, 6],
    cadences: ['kadenz-quartsext'],
    blocks: ['durchgangs-quartsext', 'wechsel-quartsext', 'tonika-prolongation'],
  }),

  level('zwischendominanten', 'chromatik', {
    keys: MAJOR,
    chords: [6, 7],
    cadences: ['ganzschluss-vollkommen', 'kadenz-quartsext', 'halbschluss'],
    blocks: ['zwischendominante', 'doppeldominante'],
  }),
  level('neapolitaner', 'chromatik', {
    keys: MINOR,
    chords: [6, 7],
    cadences: ['ganzschluss-vollkommen', 'kadenz-quartsext'],
    blocks: ['neapolitaner', 'zwischendominante'],
  }),

  level('quintfall', 'modelle', {
    keys: BOTH,
    // Two links of a falling-fifths sequence is four chords, and with no free
    // motion allowed the length is arithmetic rather than a range: four, plus
    // the cadence's two, plus the opening tonic.
    chords: [7],
    cadences: ['ganzschluss-vollkommen', 'ganzschluss-unvollkommen'],
    blocks: ['quintfall', 'quintfall-septakkorde'],
    freedom: 'strict',
  }),
  level('monte-fonte', 'modelle', {
    keys: BOTH,
    chords: [7],
    cadences: ['ganzschluss-vollkommen', 'halbschluss'],
    blocks: ['monte', 'fonte'],
    freedom: 'strict',
  }),
  level('fauxbourdon', 'modelle', {
    keys: BOTH,
    chords: [6, 7],
    cadences: ['ganzschluss-vollkommen', 'kadenz-quartsext'],
    blocks: ['fauxbourdon', 'quintanstieg'],
    freedom: 'strict',
  }),
  level('alles', 'modelle', {
    keys: BOTH,
    chords: [6, 7, 8],
    cadences: [
      'ganzschluss-vollkommen',
      'ganzschluss-unvollkommen',
      'kadenz-quartsext',
      'halbschluss',
      'phrygischer-halbschluss',
      'trugschluss',
      'plagalschluss',
    ],
    blocks: [
      'tonika-prolongation',
      'tonika-sextakkord',
      'dominant-prolongation',
      'subdominant-prolongation',
      'durchgangs-quartsext',
      'wechsel-quartsext',
      'quintfall',
      'quintfall-septakkorde',
      'quintanstieg',
      'monte',
      'fonte',
      'fauxbourdon',
      'zwischendominante',
      'doppeldominante',
      'neapolitaner',
    ],
    tempo: 88,
    questionsPerRound: 10,
  }),
]
